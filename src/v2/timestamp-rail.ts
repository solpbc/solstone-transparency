// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import {
	lstat,
	mkdir,
	open,
	readFile,
	rename,
	rm,
	writeFile,
} from "node:fs/promises";
import { dirname, isAbsolute, join } from "node:path";
import {
	type PublicationTransport,
	publicationSha256,
	publishTransaction,
	validatePublicationKey,
	validatePublicationPrefix,
} from "./publication";
import {
	type AuthenticatedRepositoryView,
	type PublicFetch,
	authenticateRepository,
} from "./release-verifier";
import { loadR2Transport } from "./s3-transport";
import {
	metadataDescription,
	parseClientMetadata,
	parseRootDeclarations,
	validateMetadataDescription,
	validateMetadataFreshnessAndSpec,
	verifyClientMetadata,
} from "./tuf/client-metadata";
import type { TufResult } from "./tuf/outcome";
import { TOP_LEVEL_ROLES } from "./tuf/role-config";
import { targetStoragePath } from "./tuf/target-storage";
import { openFileTrustStore } from "./tuf/trust-store";

export interface TimestampRailConfig {
	schema: "timestamp-rail-config-v1";
	repositoryBase: string;
	prefix: string;
	rootPath: string;
	timestampKeysPath: string;
	credentialsPath: string;
	bucket: string;
	stateDir: string;
	runtimePath: string;
	cliPath: string;
	/** Absolute path to a local module whose default export supplies the timestamp
	 * key passphrase without a terminal. Omitted for attended runs, which prompt. */
	passphraseProviderPath?: string;
	alertArgv?: string[];
}
export interface CommandResult {
	exitCode: number | null;
	timedOut: boolean;
}
export interface TimestampRailDependencies {
	authenticate?: typeof authenticateRepository;
	runCommand?: (argv: string[]) => Promise<CommandResult>;
	transport?: PublicationTransport;
	now?: () => Date;
	fetch?: PublicFetch;
}
export interface TimestampRailResult {
	schema: "timestamp-rail-result-v1";
	runId: string;
	ok: boolean;
	reason: string | null;
	detail: string | null;
	advisories: string[];
	refreshExitCode: number | null;
	alert: { attempted: boolean; exitCode: number | null; delivered: boolean };
	publicationReceipt: string | null;
	scratch: string | null;
	nextAction: "none" | "inspect-retained-evidence-without-redelivery";
}
class RailError extends Error {
	constructor(
		readonly reason: string,
		readonly detail: string | null = null,
	) {
		super(reason);
	}
}
function must<T>(result: TufResult<T>): T {
	if (!result.ok) throw new RailError("candidate-invalid", result.reason);
	return result.value;
}
function configValue(value: unknown): TimestampRailConfig {
	if (!value || typeof value !== "object")
		throw new RailError("invalid-config");
	const c = value as TimestampRailConfig;
	if (c.schema !== "timestamp-rail-config-v1")
		throw new RailError("invalid-config");
	validatePublicationPrefix(c.prefix);
	for (const field of [
		"rootPath",
		"timestampKeysPath",
		"credentialsPath",
		"stateDir",
		"runtimePath",
		"cliPath",
	] as const) {
		if (
			typeof c[field] !== "string" ||
			!isAbsolute(c[field]) ||
			c[field].includes("\0")
		)
			throw new RailError("invalid-config");
	}
	if (
		c.passphraseProviderPath !== undefined &&
		(typeof c.passphraseProviderPath !== "string" ||
			!isAbsolute(c.passphraseProviderPath) ||
			c.passphraseProviderPath.includes("\0"))
	)
		throw new RailError("invalid-config");
	if (
		typeof c.bucket !== "string" ||
		!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(c.bucket)
	)
		throw new RailError("invalid-config");
	const base = new URL(c.repositoryBase);
	if (
		base.protocol !== "https:" ||
		base.username ||
		base.password ||
		base.search ||
		base.hash ||
		base.pathname !== `/${c.prefix}`
	)
		throw new RailError("invalid-config");
	if (
		c.alertArgv !== undefined &&
		(!Array.isArray(c.alertArgv) ||
			c.alertArgv.length === 0 ||
			!c.alertArgv.every(
				(arg) =>
					typeof arg === "string" && arg.length > 0 && !arg.includes("\0"),
			))
	)
		throw new RailError("invalid-config");
	return { ...c, alertArgv: c.alertArgv?.slice() };
}

/** Fixed argv, no shell, no captured child output that could contain key material. */
export async function runRailCommand(argv: string[]): Promise<CommandResult> {
	return new Promise((resolve) => {
		const signal = AbortSignal.timeout(120_000);
		const child = spawn(argv[0] ?? "", argv.slice(1), {
			shell: false,
			stdio: "ignore",
			signal,
		});
		child.once("error", () =>
			resolve({ exitCode: null, timedOut: signal.aborted }),
		);
		child.once("close", (exitCode) => {
			resolve({ exitCode, timedOut: signal.aborted });
		});
	});
}
async function persist(path: string, value: unknown): Promise<void> {
	const temporary = `${path}.${randomUUID()}.tmp`;
	const handle = await open(temporary, "wx", 0o600);
	try {
		await handle.writeFile(`${JSON.stringify(value, null, 2)}\n`);
		await handle.sync();
	} finally {
		await handle.close();
	}
	await rename(temporary, path);
	const directory = await open(dirname(path), "r");
	try {
		await directory.sync();
	} finally {
		await directory.close();
	}
}
async function publicReadback(
	response: Response,
	expected: Uint8Array,
): Promise<void> {
	if (response.status !== 200 || !response.body)
		throw new RailError("public-readback-mismatch");
	const reader = response.body.getReader();
	const hash = createHash("sha256");
	let length = 0;
	try {
		while (true) {
			const chunk = await reader.read();
			if (chunk.done) break;
			length += chunk.value.length;
			if (length > expected.length)
				throw new RailError("public-readback-mismatch");
			hash.update(chunk.value);
		}
		if (
			length !== expected.length ||
			hash.digest("hex") !== publicationSha256(expected)
		)
			throw new RailError("public-readback-mismatch");
	} finally {
		await reader.cancel();
		reader.releaseLock();
	}
}
async function capture(
	view: AuthenticatedRepositoryView,
	directory: string,
): Promise<void> {
	const root = must(
		parseRootDeclarations(
			must(parseClientMetadata("root", "root.json", view.rootBytes)).signed,
		),
	);
	for (const [filename, bytes] of view.metadata) {
		validatePublicationKey("v2/", `v2/metadata/${filename}`);
		await mkdir(join(directory, "metadata"), { recursive: true, mode: 0o700 });
		await writeFile(join(directory, "metadata", filename), bytes, {
			flag: "wx",
			mode: 0o600,
		});
	}
	for (const [logical, bytes] of view.bytes) {
		const storage = must(
			targetStoragePath(logical, {
				sha256: publicationSha256(bytes),
				consistentSnapshot: root.consistentSnapshot,
			}),
		);
		validatePublicationKey("v2/", `v2/targets/${storage}`);
		const path = join(directory, "targets", storage);
		await mkdir(dirname(path), { recursive: true, mode: 0o700 });
		await writeFile(path, bytes, { flag: "wx", mode: 0o600 });
	}
}

/** The CLI-output adapter is intentionally a single timestamp file, never an upload manifest. */
async function validateCandidate(
	view: AuthenticatedRepositoryView,
	candidate: string,
	now: Date,
): Promise<{ bytes: Uint8Array; remaining: number }> {
	const path = join(candidate, "metadata/timestamp.json");
	if (
		(await lstat(join(candidate, "metadata"))).isSymbolicLink() ||
		(await lstat(path)).isSymbolicLink()
	)
		throw new RailError("candidate-invalid", "unsafe-path");
	const bytes = new Uint8Array(await readFile(path));
	const timestamp = must(
		parseClientMetadata("timestamp", "timestamp.json", bytes),
	);
	const root = must(
		parseClientMetadata(
			"root",
			`${view.versions.root}.root.json`,
			view.rootBytes,
		),
	);
	const declarations = must(parseRootDeclarations(root.signed));
	must(
		await verifyClientMetadata(
			timestamp,
			"timestamp",
			declarations.roles.timestamp,
			declarations.keys,
			undefined,
		),
	);
	const expires = must(validateMetadataFreshnessAndSpec(timestamp.signed, now));
	if (timestamp.version <= view.versions.timestamp)
		throw new RailError("candidate-invalid", "version-rollback");
	const snapshotFilename = `${view.versions.snapshot}.snapshot.json`;
	const snapshotBytes = view.metadata.get(snapshotFilename);
	if (!snapshotBytes)
		throw new RailError("candidate-invalid", "snapshot-missing");
	const snapshot = must(
		parseClientMetadata("snapshot", snapshotFilename, snapshotBytes),
	);
	must(
		await validateMetadataDescription(
			must(metadataDescription(timestamp.signed, "snapshot.json")),
			snapshot,
		),
	);
	return { bytes, remaining: expires - now.getTime() };
}

export async function runTimestampRail(
	value: unknown,
	dependencies: TimestampRailDependencies = {},
): Promise<TimestampRailResult> {
	const result: TimestampRailResult = {
		schema: "timestamp-rail-result-v1",
		runId: randomUUID(),
		ok: false,
		reason: null,
		detail: null,
		advisories: [],
		refreshExitCode: null,
		alert: { attempted: false, exitCode: null, delivered: false },
		publicationReceipt: null,
		scratch: null,
		nextAction: "inspect-retained-evidence-without-redelivery",
	};
	let config: TimestampRailConfig | undefined;
	let resultPath: string | undefined;
	const run = dependencies.runCommand ?? runRailCommand;
	try {
		config = configValue(value);
		const now = dependencies.now?.() ?? new Date();
		await mkdir(join(config.stateDir, "receipts"), {
			recursive: true,
			mode: 0o700,
		});
		resultPath = join(config.stateDir, "receipts", `${result.runId}.rail.json`);
		result.scratch = join(config.stateDir, "scratch", result.runId);
		await mkdir(result.scratch, { recursive: true, mode: 0o700 });
		await persist(resultPath, result);
		const bootstrapRoot = new Uint8Array(await readFile(config.rootPath));
		const verification = {
			bootstrapRoot,
			trustStore: openFileTrustStore(join(config.stateDir, "trust.json")),
			metadataBase: `${config.repositoryBase}metadata/`,
			targetsBase: `${config.repositoryBase}targets/`,
			now,
			fetch: dependencies.fetch,
		};
		let view: AuthenticatedRepositoryView;
		try {
			view = await (dependencies.authenticate ?? authenticateRepository)(
				verification,
			);
		} catch {
			throw new RailError("authentication-failed");
		}
		const prior = view.metadata.get("timestamp.json");
		if (!prior)
			throw new RailError("authentication-failed", "timestamp-missing");
		const priorTimestamp = must(
			parseClientMetadata("timestamp", "timestamp.json", prior),
		);
		const priorExpiry = must(
			validateMetadataFreshnessAndSpec(priorTimestamp.signed, now),
		);
		const margin = TOP_LEVEL_ROLES.timestamp.alertAtRemainingDays * 86_400_000;
		if (priorExpiry - now.getTime() < margin)
			result.advisories.push("prior-timestamp-near-expiry");
		const captured = join(result.scratch, "repository");
		await capture(view, captured);
		const pin = join(result.scratch, "current-root.json");
		await writeFile(pin, view.rootBytes, { flag: "wx", mode: 0o600 });
		const candidate = join(result.scratch, "candidate");
		const command = await run([
			config.runtimePath,
			config.cliPath,
			"timestamp",
			"refresh",
			"--repository",
			captured,
			"--root",
			pin,
			"--expected-timestamp-sha256",
			publicationSha256(prior),
			"--keys",
			config.timestampKeysPath,
			"--out",
			candidate,
			"--json",
			...(config.passphraseProviderPath === undefined
				? []
				: ["--passphrase-provider", config.passphraseProviderPath]),
		]);
		result.refreshExitCode = command.exitCode;
		if (command.exitCode !== 0 || command.timedOut)
			throw new RailError(
				command.timedOut ? "refresh-timeout" : "refresh-command-failed",
			);
		const renewed = await validateCandidate(view, candidate, now);
		if (renewed.remaining < margin)
			result.advisories.push("renewed-timestamp-near-expiry");
		result.publicationReceipt = join(
			config.stateDir,
			"receipts",
			`${result.runId}.publication.json`,
		);
		const publication = await publishTransaction({
			repositoryDir: candidate,
			prefix: config.prefix,
			manifest: {
				schema: "publication-manifest-v1",
				files: [
					{
						path: "metadata/timestamp.json",
						sha256: publicationSha256(renewed.bytes),
						length: renewed.bytes.length,
					},
				],
				expectedTimestampSha256: publicationSha256(prior),
			},
			receiptPath: result.publicationReceipt,
			timestampOnly: true,
			transport:
				dependencies.transport ??
				(await loadR2Transport({
					credentialsPath: config.credentialsPath,
					bucket: config.bucket,
					prefix: config.prefix,
				})),
		});
		if (!publication.ok)
			throw new RailError("publication-failed", publication.reason);
		const publicTimestamp = await (dependencies.fetch ?? fetch)(
			`${config.repositoryBase}metadata/timestamp.json`,
			{
				redirect: "error",
				credentials: "omit",
				signal: AbortSignal.timeout(30_000),
				headers: { "Cache-Control": "no-cache" },
			},
		);
		await publicReadback(publicTimestamp, renewed.bytes);
		// Remember the version just published; otherwise the next run could accept its predecessor.
		try {
			const published = await (
				dependencies.authenticate ?? authenticateRepository
			)(verification);
			const timestamp = published.metadata.get("timestamp.json");
			if (
				!timestamp ||
				timestamp.byteLength !== renewed.bytes.byteLength ||
				publicationSha256(timestamp) !== publicationSha256(renewed.bytes)
			) {
				throw new RailError("public-verification-failed", "timestamp-changed");
			}
		} catch (error) {
			if (error instanceof RailError) throw error;
			throw new RailError("public-verification-failed");
		}
		result.ok = true;
		result.nextAction = "none";
	} catch (error) {
		result.reason = error instanceof RailError ? error.reason : "rail-failed";
		result.detail = error instanceof RailError ? error.detail : null;
	}
	async function alert(): Promise<void> {
		if (
			result.alert.attempted ||
			(result.ok && result.advisories.length === 0) ||
			!config?.alertArgv
		)
			return;
		result.alert.attempted = true;
		const message = `timestamp rail ${result.ok ? "advisory" : "failed"}: ${result.reason ?? result.advisories.join(",")}; run ${result.runId}`;
		try {
			const alert = await run(
				config.alertArgv.map((arg) => arg.replaceAll("{message}", message)),
			);
			result.alert.exitCode = alert.exitCode;
			result.alert.delivered = alert.exitCode === 0 && !alert.timedOut;
		} catch {
			result.alert.delivered = false;
		}
		if (result.ok && !result.alert.delivered) {
			result.ok = false;
			result.reason = "alert-failed";
			result.nextAction = "inspect-retained-evidence-without-redelivery";
		}
	}
	await alert();
	if (resultPath) {
		try {
			await persist(resultPath, result);
			if (result.ok && result.scratch) {
				await rm(result.scratch, { recursive: true });
				result.scratch = null;
				await persist(resultPath, result);
			}
		} catch {
			if (result.reason === null) result.reason = "result-persistence-failed";
			result.ok = false;
			result.nextAction = "inspect-retained-evidence-without-redelivery";
			await alert();
		}
	}
	return result;
}
