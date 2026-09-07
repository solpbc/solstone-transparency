// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

import { createHash } from "node:crypto";
import { loadDsseAuthorizationPolicy } from "./records/authorization-policy";
import { IN_TOTO_PAYLOAD_TYPE, verifyDsseEnvelope } from "./records/dsse";
import { RELEASE_RECORD_PREDICATE_TYPE } from "./records/predicates";
import { parseEvidenceRecord, verifyEvidenceRecord } from "./records/record";
import {
	type ReleaseArtifact,
	validateReleaseRecordPredicate,
} from "./records/release-record";
import { parseInTotoStatementV1 } from "./records/statement";
import { DEFAULT_MAX_METADATA_BYTES, admitTufJson } from "./tuf/admission";
import { canonicalizeTufJson } from "./tuf/canonical";
import { updateTufRepository } from "./tuf/client";
import { parseDelegations, parseRootDeclarations } from "./tuf/client-metadata";
import type { ConsumedVersions } from "./tuf/client-result";
import type { TufResult } from "./tuf/outcome";
import { validateTargetPath } from "./tuf/role-graph";
import { metadataFilename } from "./tuf/serializer";
import type { TrustStoreState, TufTrustStore } from "./tuf/trust-store";

export type ReleaseVerificationLink =
	| "root"
	| "tuf"
	| "record"
	| "policy"
	| "dsse"
	| "subject"
	| "artifact"
	| "lane";
export type ReleaseVerificationResult =
	| {
			ok: true;
			product: string;
			version: string;
			recordPath: string;
			policyVersion: number;
			artifacts: readonly ReleaseArtifact[];
			fingerprint: string;
	  }
	| { ok: false; link: ReleaseVerificationLink; reason: string };
export type PublicFetch = (
	url: string,
	init?: RequestInit,
) => Promise<Response>;

export interface ReleaseVerifierOptions {
	bootstrapRoot: Uint8Array;
	trustStore: TufTrustStore;
	metadataBase: string;
	targetsBase: string;
	now: Date;
	fetch?: PublicFetch;
	timeoutMs?: number;
	maxArtifactBytes?: number;
}
export interface VerifyReleaseInput extends ReleaseVerifierOptions {
	product: string;
	version: string;
}

class VerificationFailure extends Error {
	constructor(
		readonly link: ReleaseVerificationLink,
		readonly reason: string,
	) {
		super(reason);
	}
}
function fail(link: ReleaseVerificationLink, reason: string): never {
	throw new VerificationFailure(link, reason);
}
function must<T>(result: TufResult<T>, link: ReleaseVerificationLink): T {
	if (!result.ok) fail(link, result.reason);
	return result.value;
}
function failure(
	error: unknown,
	fallback: ReleaseVerificationLink,
): ReleaseVerificationResult & { ok: false } {
	return error instanceof VerificationFailure
		? { ok: false, link: error.link, reason: error.reason }
		: { ok: false, link: fallback, reason: "verification-unavailable" };
}
function object(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}
function httpsUrl(value: string, link: ReleaseVerificationLink): URL {
	let url: URL;
	try {
		url = new URL(value);
	} catch {
		return fail(link, "unsafe-url");
	}
	if (
		url.protocol !== "https:" ||
		url.username ||
		url.password ||
		value.includes("#") ||
		Array.from(value).some((character) => character.charCodeAt(0) <= 32)
	)
		fail(link, "unsafe-url");
	return url;
}
function coordinate(value: string): boolean {
	return (
		typeof value === "string" &&
		/^[A-Za-z0-9][A-Za-z0-9._+-]*$/.test(value) &&
		value !== "." &&
		value !== ".."
	);
}
function sha256(bytes: Uint8Array): string {
	return createHash("sha256").update(bytes).digest("hex");
}

/** Stream every remote response under a deadline and byte ceiling; no redirects or credentials. */
async function download(
	urlString: string,
	maximum: number,
	options: ReleaseVerifierOptions,
	link: ReleaseVerificationLink,
	collect = true,
): Promise<{ bytes: Uint8Array; length: number; sha256: string }> {
	const url = httpsUrl(urlString, link);
	const timeout = options.timeoutMs ?? 30_000;
	if (
		!Number.isSafeInteger(maximum) ||
		maximum < 0 ||
		!Number.isSafeInteger(timeout) ||
		timeout < 1 ||
		timeout > 120_000
	)
		fail(link, "invalid-limit");
	const signal = AbortSignal.timeout(timeout);
	let reader:
		| {
				read(): Promise<{ done?: boolean; value?: Uint8Array }>;
				cancel(): Promise<void>;
				releaseLock(): void;
		  }
		| undefined;
	try {
		const response = await (options.fetch ?? fetch)(url.href, {
			redirect: "error",
			credentials: "omit",
			signal,
			headers: {
				Accept: "application/octet-stream, application/json, text/plain",
			},
		});
		if (response.status === 404) fail(link, "http-404");
		if (!response.ok) fail(link, `http-${response.status}`);
		const announced = response.headers.get("content-length");
		if (
			announced !== null &&
			/^\d+$/.test(announced) &&
			Number(announced) > maximum
		) {
			await response.body?.cancel();
			fail(link, "response-too-large");
		}
		const chunks: Uint8Array[] = [];
		const digest = createHash("sha256");
		let length = 0;
		reader = response.body?.getReader();
		if (reader) {
			while (true) {
				const chunk = await reader.read();
				if (chunk.done) break;
				if (!chunk.value) fail(link, "retrieval-failed");
				length += chunk.value.byteLength;
				if (length > maximum) fail(link, "response-too-large");
				digest.update(chunk.value);
				if (collect) chunks.push(chunk.value.slice());
			}
		}
		const bytes = collect ? new Uint8Array(length) : new Uint8Array();
		let offset = 0;
		for (const chunk of chunks) {
			bytes.set(chunk, offset);
			offset += chunk.length;
		}
		return { bytes, length, sha256: digest.digest("hex") };
	} catch (error) {
		if (error instanceof VerificationFailure) throw error;
		return fail(link, signal.aborted ? "timeout" : "retrieval-failed");
	} finally {
		if (reader) {
			try {
				await reader.cancel();
			} catch {
				/* Preserve the verification failure. */
			}
			reader.releaseLock();
		}
	}
}

export interface AuthenticatedRepositoryView {
	rootBytes: Uint8Array;
	metadata: ReadonlyMap<string, Uint8Array>;
	versions: ConsumedVersions;
	bytes: ReadonlyMap<string, Uint8Array>;
	topLevelTargets: ReadonlySet<string>;
	tufKeyids: ReadonlySet<string>;
	fingerprint: string;
}

function objectUrl(path: string, options: ReleaseVerifierOptions): string {
	must(validateTargetPath(path), "tuf");
	const isMetadata =
		/^(?:[1-9][0-9]*\.)?(?:root|timestamp|snapshot|targets(?:-[A-Za-z0-9_-]+)?)\.json$/.test(
			path,
		);
	const base = httpsUrl(
		isMetadata ? options.metadataBase : options.targetsBase,
		"tuf",
	);
	if (base.search) fail("tuf", "unsafe-base-url");
	if (!base.pathname.endsWith("/")) base.pathname += "/";
	return new URL(path, base).href;
}

export async function authenticateRepository(
	options: ReleaseVerifierOptions,
): Promise<AuthenticatedRepositoryView> {
	if (options.bootstrapRoot.length > DEFAULT_MAX_METADATA_BYTES)
		fail("root", "oversized");
	if (!Number.isFinite(options.now.getTime())) fail("tuf", "invalid-time");
	// Expose only a successful view tied to this invocation's exact store commit.
	let written: TrustStoreState | undefined;
	const result = await updateTufRepository({
		bootstrapRoot: options.bootstrapRoot.slice(),
		now: new Date(options.now.getTime()),
		trustStore: {
			read: () => options.trustStore.read(),
			async replace(revision, state) {
				const proposed = structuredClone(state);
				const stored = await options.trustStore.replace(
					revision,
					structuredClone(proposed),
				);
				if (stored.ok) written = proposed;
				return stored;
			},
		},
		fetcher: {
			async fetch(path, maxBytes) {
				try {
					const response = await download(
						objectUrl(path, options),
						Math.min(maxBytes, 16 * DEFAULT_MAX_METADATA_BYTES),
						options,
						"tuf",
					);
					return { kind: "ok", bytes: response.bytes };
				} catch (error) {
					if (
						error instanceof VerificationFailure &&
						error.reason === "http-404"
					)
						return { kind: "not-found" };
					return { kind: "error", error };
				}
			},
		},
	});
	if (!result.ok)
		fail(
			result.classification.kind === "role" &&
				result.classification.roleName === "root"
				? "root"
				: "tuf",
			result.reason,
		);
	if (!written || written.trustedRoot.version !== result.value.versions.root)
		fail("tuf", "authenticated-view-unavailable");
	const authenticated = result.value;
	const rootMetadata = authenticated.authenticatedMetadata.root;
	if (!rootMetadata || rootMetadata.version !== written.trustedRoot.version)
		fail("tuf", "authenticated-view-unavailable");
	const committedRoot = must(
		canonicalizeTufJson(written.trustedRoot.envelope),
		"root",
	);
	const authenticatedRoot = must(
		canonicalizeTufJson(rootMetadata.envelope),
		"root",
	);
	if (!Buffer.from(committedRoot).equals(Buffer.from(authenticatedRoot)))
		fail("tuf", "authenticated-view-unavailable");
	const root = must(
		parseRootDeclarations(rootMetadata.envelope.signed),
		"root",
	);
	const tufKeyids = new Set(Object.keys(root.keys));
	const rootBytes = rootMetadata.bytes.slice();
	const metadataBytes = new Map<string, Uint8Array>();
	for (const metadata of Object.values(authenticated.authenticatedMetadata)) {
		// Bootstrap and stored roots use internal filenames; captures need the public name.
		const filename =
			metadata.roleName === "root"
				? must(metadataFilename("root", metadata.version, true), "root")
				: metadata.filename;
		metadataBytes.set(filename, metadata.bytes.slice());
		if (metadata.envelope.signed.delegations !== undefined) {
			const delegations = must(
				parseDelegations(metadata.envelope.signed.delegations),
				"tuf",
			);
			for (const id of Object.keys(delegations.keys)) tufKeyids.add(id);
		}
	}
	const bytes = new Map<string, Uint8Array>();
	const topLevelTargets = new Set<string>();
	for (const [roleName, targets] of Object.entries(
		authenticated.authenticatedTargets,
	)) {
		for (const [path, target] of Object.entries(targets)) {
			const existing = bytes.get(path);
			if (existing && !Buffer.from(existing).equals(Buffer.from(target.bytes)))
				fail("tuf", "authenticated-target-conflict");
			bytes.set(path, target.bytes.slice());
			if (roleName === "targets") topLevelTargets.add(path);
		}
	}
	return {
		bytes,
		topLevelTargets,
		tufKeyids,
		fingerprint: result.value.fingerprint,
		rootBytes,
		metadata: metadataBytes,
		versions: structuredClone(authenticated.versions),
	};
}

/** The descriptor preimage used by descriptorDigest, not canonical JSON. */
export function releaseDescriptorBytes(
	artifacts: readonly ReleaseArtifact[],
): Uint8Array {
	return new TextEncoder().encode(
		[...artifacts]
			.sort((a, b) => a.url.localeCompare(b.url))
			.map(
				(artifact) =>
					`${artifact.url}\n${artifact.length}\n${artifact.sha256}\n`,
			)
			.join(""),
	);
}

async function verifyFromView(
	input: VerifyReleaseInput,
	view: AuthenticatedRepositoryView,
): Promise<ReleaseVerificationResult & { ok: true }> {
	if (!coordinate(input.product) || !coordinate(input.version))
		fail("record", "invalid-coordinate");
	const recordPath = `software/${input.product}/${input.version}/release-record.json`;
	const recordBytes = view.bytes.get(recordPath);
	if (!recordBytes) fail("record", "record-missing");
	const record = must(parseEvidenceRecord(recordBytes), "record");
	if (Date.parse(record.issued_at) > input.now.getTime())
		fail("record", "future-issued-at");
	const matches = [...view.topLevelTargets].filter(
		(path) =>
			/^policy\/dsse-authorization\/[1-9][0-9]*\.json$/.test(path) &&
			sha256(view.bytes.get(path) ?? new Uint8Array()) === record.policy_sha256,
	);
	if (matches.length !== 1) fail("policy", "policy-sha256-mismatch");
	const policyPath = matches[0];
	if (!policyPath) fail("policy", "policy-unavailable");
	const versionText = policyPath.slice(policyPath.lastIndexOf("/") + 1, -5);
	const policyVersion = Number(versionText);
	if (!Number.isSafeInteger(policyVersion))
		fail("policy", "policy-version-mismatch");
	const keyPath = `keys/dsse/${versionText}.json`;
	const keyBytes = view.bytes.get(keyPath);
	if (!keyBytes || !view.topLevelTargets.has(keyPath))
		fail("policy", "evidence-keys-unavailable");
	const keyDocument = must(admitTufJson(keyBytes), "policy");
	if (
		!object(keyDocument) ||
		keyDocument.schema !== "solstone-transparency/dsse-keys/v1" ||
		!object(keyDocument.keys)
	)
		fail("policy", "evidence-keys-malformed");
	const policyBytes = view.bytes.get(policyPath);
	if (!policyBytes) fail("policy", "policy-unavailable");
	const policy = must(
		await loadDsseAuthorizationPolicy({
			bytes: policyBytes,
			now: input.now,
			evidenceKeys: keyDocument.keys,
			tufRoleKeyids: view.tufKeyids,
		}),
		"policy",
	);
	if (policy.policy.version !== policyVersion)
		fail("policy", "policy-version-mismatch");
	// Authenticate the payload before interpreting even its product/version/artifact list.
	const envelope = must(
		await verifyDsseEnvelope({
			envelope: record.envelope,
			expectedPayloadType: IN_TOTO_PAYLOAD_TYPE,
			keys: policy.keyMap,
		}),
		"dsse",
	);
	if (
		envelope.verifiedSignatures.some(
			(signature) => signature.state === "key-unavailable",
		)
	)
		fail("dsse", "unknown-key");
	const statement = must(parseInTotoStatementV1(envelope.payload), "subject");
	if (statement.predicateType !== RELEASE_RECORD_PREDICATE_TYPE)
		fail("record", "wrong-predicate");
	const predicate = must(
		await validateReleaseRecordPredicate(statement.predicate),
		"record",
	);
	const subject = `software/${input.product}/${input.version}`;
	if (
		statement.subject.length !== 1 ||
		statement.subject[0]?.name !== subject ||
		predicate.product !== input.product ||
		predicate.version !== input.version
	)
		fail("subject", "subject-mismatch");
	if (predicate.artifacts.length === 0) fail("artifact", "artifacts-empty");
	const verified = await verifyEvidenceRecord({
		record,
		policy,
		subjectBytes: new Map([
			[subject, releaseDescriptorBytes(predicate.artifacts)],
		]),
	});
	if (verified.state === "rejected")
		fail(
			verified.reason === "subject-mismatch" ? "subject" : "dsse",
			verified.reason,
		);
	if (verified.state === "suspect") fail("dsse", "suspect-key");
	if (verified.role.id !== "producer.release")
		fail("dsse", "role-not-authorized");
	const maximum = input.maxArtifactBytes ?? 2_147_483_648;
	if (!Number.isSafeInteger(maximum) || maximum < 0)
		fail("artifact", "invalid-limit");
	for (const artifact of predicate.artifacts) {
		if (artifact.length > maximum) fail("artifact", "artifact-too-large");
		const actual = await download(
			artifact.url,
			artifact.length,
			input,
			"artifact",
			false,
		);
		if (actual.length !== artifact.length) fail("artifact", "length-mismatch");
		if (actual.sha256 !== artifact.sha256) fail("artifact", "hash-mismatch");
	}
	return {
		ok: true,
		product: input.product,
		version: input.version,
		recordPath,
		policyVersion,
		artifacts: predicate.artifacts,
		fingerprint: view.fingerprint,
	};
}

export async function verifyRelease(
	input: VerifyReleaseInput,
): Promise<ReleaseVerificationResult> {
	try {
		if (!coordinate(input.product) || !coordinate(input.version))
			fail("record", "invalid-coordinate");
		return await verifyFromView(input, await authenticateRepository(input));
	} catch (error) {
		return failure(error, "tuf");
	}
}

export interface DeliveryLane {
	product: string;
	latestUrl: string;
	format: "version-line" | "github-release";
}
export const DEFAULT_DELIVERY_LANES: readonly DeliveryLane[] = [
	{
		product: "journal",
		latestUrl: "https://updates.solstone.app/solstone-journal/release/latest",
		format: "version-line",
	},
];
export type DeliveryHeadResult =
	| { state: "accepted"; product: string; version: string }
	| { state: "gap"; product: string; version: string; reason: "record-missing" }
	| {
			state: "rejected";
			product: string;
			version: string;
			link: ReleaseVerificationLink;
			reason: string;
	  }
	| { state: "lane-unavailable"; product: string; reason: string };
export interface DeliveryAuditResult {
	coverage: "delivery-heads-only";
	ok: boolean;
	heads: readonly DeliveryHeadResult[];
}

/** Compares independently discovered delivery heads with authenticated release evidence. */
export async function auditDeliveryHeads(
	lanes: readonly DeliveryLane[],
	options: ReleaseVerifierOptions,
): Promise<DeliveryAuditResult> {
	const heads: DeliveryHeadResult[] = [];
	let view: Promise<AuthenticatedRepositoryView> | undefined;
	if (!Array.isArray(lanes) || lanes.length === 0 || lanes.length > 64)
		return {
			coverage: "delivery-heads-only",
			ok: false,
			heads: [
				{ state: "lane-unavailable", product: "", reason: "invalid-lanes" },
			],
		};
	for (const lane of lanes) {
		let version: string;
		try {
			if (!lane || !coordinate(lane.product)) fail("lane", "invalid-lane");
			const response = await download(
				lane.latestUrl,
				DEFAULT_MAX_METADATA_BYTES,
				options,
				"lane",
			);
			if (lane.format === "version-line") {
				const lines = new TextDecoder("utf-8", { fatal: true })
					.decode(response.bytes)
					.split(/\r?\n/)
					.filter((line) => line.startsWith("version="));
				if (lines.length !== 1) fail("lane", "lane-version-malformed");
				version = lines[0]?.slice(8) ?? "";
			} else if (lane.format === "github-release") {
				const release = must(admitTufJson(response.bytes), "lane");
				if (
					!object(release) ||
					typeof release.tag_name !== "string" ||
					release.draft === true
				)
					fail("lane", "lane-version-malformed");
				version = release.tag_name.replace(/^v(?=\d)/, "");
			} else fail("lane", "invalid-lane");
			if (!coordinate(version)) fail("lane", "lane-version-malformed");
		} catch (error) {
			heads.push({
				state: "lane-unavailable",
				product: lane?.product ?? "",
				reason: failure(error, "lane").reason,
			});
			continue;
		}
		try {
			view ??= authenticateRepository(options);
			const result = await verifyFromView(
				{ ...options, product: lane.product, version },
				await view,
			);
			heads.push({
				state: "accepted",
				product: lane.product,
				version: result.version,
			});
		} catch (error) {
			const result = failure(error, "tuf");
			heads.push(
				result.link === "record" && result.reason === "record-missing"
					? {
							state: "gap",
							product: lane.product,
							version,
							reason: "record-missing",
						}
					: {
							state: "rejected",
							product: lane.product,
							version,
							link: result.link,
							reason: result.reason,
						},
			);
		}
	}
	return {
		coverage: "delivery-heads-only",
		ok: heads.every((head) => head.state === "accepted"),
		heads,
	};
}
