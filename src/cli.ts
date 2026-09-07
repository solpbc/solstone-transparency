// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

import { readFile } from "node:fs/promises";
import { VERSION } from "./index";
import { buildPortalModel } from "./legacy/adapter";
import { buildSitemap } from "./portal/sitemap";
import {
	type ReplacedMetadata,
	composeRepositoryFiles,
	writePreparationOutput,
} from "./v2/preparation-output";
import { publishRepository } from "./v2/publish-cli";
import { buildDsseAuthorizationPolicyTargets } from "./v2/records/dsse-policy-builder";
import { validateReleaseRecordPredicate } from "./v2/records/release-record";
import {
	type RootDeclarations,
	parseDelegations,
	parseRootDeclarations,
} from "./v2/tuf/client-metadata";
import {
	loadIncrementalReleaseSigningKeys,
	loadMetadataRenewalSigningKeys,
	loadTimestampSigningKey,
} from "./v2/tuf/incremental-keyset";
import { authenticateLocalRepository } from "./v2/tuf/local-repository";
import { refreshTimestamp, renewTufMetadata } from "./v2/tuf/metadata-renewal";
import { type TufJsonValue, type TufResult, rejection } from "./v2/tuf/outcome";
import { prepareIncrementalRelease } from "./v2/tuf/release-preparation";
import { targetStoragePath } from "./v2/tuf/target-storage";
import { verifyRepository } from "./v2/verify-cli";

const HELP = `solstone-transparency ${VERSION}

Usage: solstone-transparency [--version] [--help]
       solstone-transparency legacy-model --out <path>
       solstone-transparency sitemap --out <path>
       solstone-transparency verify-v2 [--metadata-base URL] [--targets-base URL]
                                       --root <local-root-file> [--store PATH] [--json]
       solstone-transparency publish-v2 --artifacts <path> --product <name>
                                        --keys <path> --policy-sha256 <hex>
                                        --out <dir> [--now <iso-8601>]
       solstone-transparency policy build --root <file> --repository <dir>
                                          --expected-timestamp-sha256 <hex> --version <n>
                                          --effective-from <instant> --producer-release-keys <path>
                                          --out <dir> [--now <instant>] [--json]
       solstone-transparency release prepare --root <file> --repository <dir>
                                               --expected-timestamp-sha256 <hex>
                                               --keys <path> --release-record <path> --out <dir>
                                               [--now <instant>] [--json]
       solstone-transparency timestamp refresh --root <file> --repository <dir>
                                                --expected-timestamp-sha256 <hex>
                                                --keys <path> --out <dir>
                                                [--now <instant>] [--json]
       solstone-transparency metadata renew <role>
                                               --root <file> --repository <dir>
                                               --expected-timestamp-sha256 <hex>
                                               --keys <path> --out <dir>
                                               [--now <instant>] [--json]

This build implements the read-side v1 legacy verifier/adapter, its typed
portal model (src/legacy/), a read-only HTML presentation layer
(src/portal/), and the Cloudflare Worker (worker.ts) that serves
trust.solstone.app from a build-time snapshot of that model.

Options:
  --version           Print the installed version and exit
  --help              Show this help text and exit
  legacy-model --out  Fetch and verify the live v1 register from
                      transparency.solstone.app and write the resulting
                      typed portal model as JSON to the given path.
                      Read-only: makes no write to the evidence host.
  sitemap --out       Fetch and verify the live v1 register (same as
                      legacy-model) and write sitemap.xml listing every
                      HTML route the portal actually serves with a 200
                      response.
  verify-v2           Bootstrap from a pinned v2 root and verify a TUF
                      repository end to end: root, timestamp, snapshot,
                      targets, every delegated role, and each target's
                      recorded digest. Prints the accepted repository
                      fingerprint, per-role state, and any renewal
                      advisories. Read-only; holds no credential and never
                      writes to the evidence host.
                      --root is required and is a local, out-of-band root
                      metadata file; this command never bootstraps trust from
                      the evidence channel. --metadata-base / --targets-base
                      default to the v2 prefix. --json emits a machine-readable
                      result.
                      Exit 0 accepted, 1 rejected, 2 could not run.
  publish-v2          Build and publish a v2 TUF repository containing
                      the v1-to-v2 legacy migration manifest and a signed
                      release record for the specified release artifacts.
                      Writes <dir>/metadata/ with signed TUF metadata
                      (root, targets, snapshot, timestamp, and delegated
                      roles) and <dir>/targets/ with signed EvidenceRecord
                      payloads.
                      --product <name> selects which product's committed v1
                      inventory becomes the migration-manifest half; it must
                      be one of journal, linux, windows.
                      Input shapes:
                        --artifacts <path>: JSON object with fields:
                          - product (free-form string naming the release;
                            not limited to journal/linux/windows -- this is
                            independent of the --product flag above)
                          - version (string, e.g. 1.0.23)
                          - artifacts: array of { url, length, sha256 }
                          - does_prove: non-empty array of strings
                          - does_not_prove: non-empty array of strings
                          - _comment: array of explanatory strings
                        --keys <path>: JSON object with 11 signing keys:
                          - root: array of 3 key entries
                          - targets, snapshot, timestamp: array of 1 key each
                          - delegated: object with 1 key entry for each of
                            targets-software, targets-services,
                            targets-verification, targets-legacy
                          - dsseSigner: 1 key entry
                          Key entries are { keyid, public, pkcs8 } (hex keyid,
                          hex public key, base64-encoded PKCS8 private key).
                        --policy-sha256 <hex>: 64-character lowercase hex
                          digest (placeholder pending real policy publication).
                      Missing or malformed inputs or an unknown product name
                      fail closed writing nothing.
  policy build        Prepare canonical DSSE authorization policy and public-key
                      targets after authenticating the pinned repository state.
                      --producer-release-keys <path>: JSON array of exactly
                      { public: <64-lowercase-hex> } objects. It contains no
                      private material or keyid; key IDs are computed.
  release prepare     Prepare one incremental release. --keys <path>: exactly
                      {"targets-software":{keyid,public,pkcs8},"snapshot":
                      {keyid,public,pkcs8},"timestamp":{keyid,public,pkcs8},
                      "producer.release":{keyid,public,pkcs8}}. --release-record
                      <path>: JSON {product,version,releasePredicate,
                      artifactDescriptors}, with artifact descriptors as
                      {url,length,sha256} objects.
  timestamp refresh   Refresh only timestamp metadata. --keys <path> is exactly
                      {"timestamp":{keyid,public,pkcs8}}.
  metadata renew      Renew snapshot, targets, or one delegated targets role plus
                      its dependency chain. Accepted roles: snapshot, targets,
                      targets-software, targets-services, targets-verification,
                      targets-legacy. Timestamp has its own timestamp refresh
                      command; root renewal is not supported here.
                      Snapshot keys are exactly {"snapshot":{keyid,public,pkcs8},
                      "timestamp":{keyid,public,pkcs8}}. Any targets-role keys
                      are exactly {"<role>":{keyid,public,pkcs8},"snapshot":
                      {keyid,public,pkcs8},"timestamp":{keyid,public,pkcs8}}.

The v2 rail is under construction and represents no released product or
operated service. Every key on it is synthetic.
`;

function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

async function readJson(
	path: string,
	label: string,
): Promise<unknown | undefined> {
	try {
		return JSON.parse(await readFile(path, "utf-8"));
	} catch (error) {
		console.error(
			`could not read or parse ${label}: ${error instanceof Error ? error.message : String(error)}`,
		);
		return undefined;
	}
}

function nowFromFlag(value: string | undefined): Date | undefined {
	const now = value === undefined ? new Date() : new Date(value);
	if (!Number.isFinite(now.getTime())) {
		console.error("--now must be a valid ISO-8601 instant");
		return undefined;
	}
	return now;
}

function recoveryGuidance(reason: string): string {
	switch (reason) {
		case "hash-mismatch":
			return "refresh --expected-timestamp-sha256 from the authenticated repository state.";
		case "expired":
			return "renew the expired metadata role before preparing another change.";
		case "key-not-in-role":
		case "unknown-key":
		case "dangling-keyid":
			return "supply an authorized signing key for the selected role.";
		case "unavailable":
			return "refresh the repository state and ensure all required metadata and targets are present.";
		default:
			return "correct the reported input and choose a fresh --out directory before retrying.";
	}
}

function reportRejection(
	command: string,
	result: { reason: string; detail: unknown },
): number {
	console.error(
		`${command} rejected: ${result.reason} (${JSON.stringify(result.detail)})`,
	);
	console.error(`recovery: ${recoveryGuidance(result.reason)}`);
	return 1;
}

function emitPreparation(
	json: boolean,
	operation: string,
	manifest: unknown,
): number {
	if (json) console.log(JSON.stringify(manifest, null, 2));
	else console.log(`${operation} preparation written`);
	return 0;
}

function requiredFlag(
	command: string,
	flag: (name: string) => string | undefined,
	name: string,
): string | undefined {
	const value = flag(name);
	if (value === undefined || value === "") {
		console.error(`${command} requires ${name} <value>`);
		return undefined;
	}
	return value;
}

function authenticatedRoleKeyids(state: {
	authenticatedMetadata: Readonly<
		Record<string, { envelope: { signed: Record<string, TufJsonValue> } }>
	>;
}): TufResult<{ root: RootDeclarations; keyids: readonly string[] }> {
	const root = state.authenticatedMetadata.root;
	const targets = state.authenticatedMetadata.targets;
	if (root === undefined || targets === undefined) {
		return rejection("unavailable", {
			path: ["authenticatedMetadata"],
			expected: "authenticated root and targets metadata",
			observed: "missing",
		});
	}
	const rootDeclarations = parseRootDeclarations({ ...root.envelope.signed });
	if (!rootDeclarations.ok) return rootDeclarations;
	const delegations = parseDelegations(targets.envelope.signed.delegations);
	if (!delegations.ok) return delegations;
	return {
		ok: true,
		value: {
			root: rootDeclarations.value,
			keyids: [
				...Object.keys(rootDeclarations.value.keys),
				...Object.keys(delegations.value.keys),
			],
		},
	};
}

const METADATA_RENEWAL_ROLES = [
	"snapshot",
	"targets",
	"targets-software",
	"targets-services",
	"targets-verification",
	"targets-legacy",
] as const;

type MetadataRenewalRole = (typeof METADATA_RENEWAL_ROLES)[number];

function isMetadataRenewalRole(value: unknown): value is MetadataRenewalRole {
	return (
		typeof value === "string" &&
		(METADATA_RENEWAL_ROLES as readonly string[]).includes(value)
	);
}

function replacedMetadata(
	roleNames: readonly string[],
	metadata: readonly { filename: string; version: number; bytes: Uint8Array }[],
): TufResult<ReplacedMetadata[]> {
	if (roleNames.length !== metadata.length) {
		return rejection("malformed", {
			path: ["renewedRoles"],
			expected: roleNames,
			observed: metadata.length,
		});
	}
	return {
		ok: true,
		value: roleNames.map((roleName, index) => ({
			roleName,
			metadata: metadata[index] as ReplacedMetadata["metadata"],
		})),
	};
}

/** Runs the CLI against argv (excluding the node/bun/script entries) and returns the process exit code. */
export async function run(argv: string[]): Promise<number> {
	if (argv[0] === "--version") {
		console.log(VERSION);
		return 0;
	}
	if (argv[0] === "publish-v2") {
		const flag = (name: string): string | undefined => {
			const index = argv.indexOf(name);
			return index >= 0 ? argv[index + 1] : undefined;
		};
		const artifactsPath = flag("--artifacts");
		if (!artifactsPath) {
			console.error("publish-v2 requires --artifacts <path>");
			return 1;
		}
		const product = flag("--product");
		if (!product) {
			console.error("publish-v2 requires --product <name>");
			return 1;
		}
		const keysPath = flag("--keys");
		if (!keysPath) {
			console.error("publish-v2 requires --keys <path>");
			return 1;
		}
		const policySha256 = flag("--policy-sha256");
		if (!policySha256) {
			console.error("publish-v2 requires --policy-sha256 <hex>");
			return 1;
		}
		const outDir = flag("--out");
		if (!outDir) {
			console.error("publish-v2 requires --out <dir>");
			return 1;
		}
		const nowStr = flag("--now");
		const now = nowStr ? new Date(nowStr) : undefined;
		return publishRepository({
			artifactsPath,
			product,
			keysPath,
			policySha256,
			outDir,
			now,
		});
	}
	if (argv[0] === "policy" && argv[1] === "build") {
		const flag = (name: string): string | undefined => {
			const index = argv.indexOf(name);
			return index >= 0 ? argv[index + 1] : undefined;
		};
		const rootPath = requiredFlag("policy build", flag, "--root");
		const repositoryDirectory = requiredFlag(
			"policy build",
			flag,
			"--repository",
		);
		const expectedTimestampSha256 = requiredFlag(
			"policy build",
			flag,
			"--expected-timestamp-sha256",
		);
		const versionText = requiredFlag("policy build", flag, "--version");
		const effectiveFrom = requiredFlag(
			"policy build",
			flag,
			"--effective-from",
		);
		const producerKeysPath = requiredFlag(
			"policy build",
			flag,
			"--producer-release-keys",
		);
		const outputDirectory = requiredFlag("policy build", flag, "--out");
		const now = nowFromFlag(flag("--now"));
		if (
			rootPath === undefined ||
			repositoryDirectory === undefined ||
			expectedTimestampSha256 === undefined ||
			versionText === undefined ||
			effectiveFrom === undefined ||
			producerKeysPath === undefined ||
			outputDirectory === undefined ||
			now === undefined
		)
			return 1;
		const version = Number(versionText);
		if (!Number.isSafeInteger(version) || version <= 0) {
			console.error("policy build --version must be a positive safe integer");
			return 1;
		}
		const producerKeys = await readJson(
			producerKeysPath,
			"--producer-release-keys file",
		);
		if (
			!Array.isArray(producerKeys) ||
			producerKeys.some(
				(key) =>
					!isRecord(key) ||
					Object.keys(key).length !== 1 ||
					typeof key.public !== "string" ||
					!/^[0-9a-f]{64}$/.test(key.public),
			)
		) {
			console.error(
				"--producer-release-keys must be an array of exactly {public:<64-lowercase-hex>} objects",
			);
			return 1;
		}
		const prior = await authenticateLocalRepository({
			repositoryDirectory,
			rootPath,
			expectedTimestampSha256,
			now,
		});
		if (!prior.ok) return reportRejection("policy build", prior);
		const authenticated = authenticatedRoleKeyids(prior.value);
		if (!authenticated.ok)
			return reportRejection("policy build", authenticated);
		const built = await buildDsseAuthorizationPolicyTargets({
			version,
			effectiveFrom,
			now,
			producerReleaseKeys: producerKeys.map((key) => ({
				keyObject: {
					keytype: "ed25519" as const,
					scheme: "ed25519" as const,
					keyval: { public: String(key.public) },
				},
			})),
			tufRoleKeyids: authenticated.value.keyids,
		});
		if (!built.ok) return reportRejection("policy build", built);
		const policyStorage = targetStoragePath(built.value.policyLogicalPath, {
			sha256: built.value.policySha256,
			consistentSnapshot: authenticated.value.root.consistentSnapshot,
		});
		if (!policyStorage.ok)
			return reportRejection("policy build", policyStorage);
		const keysStorage = targetStoragePath(built.value.keysLogicalPath, {
			sha256: built.value.keysTargetSha256,
			consistentSnapshot: authenticated.value.root.consistentSnapshot,
		});
		if (!keysStorage.ok) return reportRejection("policy build", keysStorage);
		const written = await writePreparationOutput({
			outputDirectory,
			files: [
				{
					relativePath: `targets/${policyStorage.value}`,
					bytes: built.value.policyBytes,
				},
				{
					relativePath: `targets/${keysStorage.value}`,
					bytes: built.value.keysTargetBytes,
				},
			],
			operation: "policy build",
			expectedPriorTimestampSha256: expectedTimestampSha256,
			newTimestampSha256: null,
		});
		if (!written.ok) return reportRejection("policy build", written);
		return emitPreparation(
			argv.includes("--json"),
			"policy build",
			written.value,
		);
	}
	if (argv[0] === "release" && argv[1] === "prepare") {
		const flag = (name: string): string | undefined => {
			const index = argv.indexOf(name);
			return index >= 0 ? argv[index + 1] : undefined;
		};
		const rootPath = requiredFlag("release prepare", flag, "--root");
		const repositoryDirectory = requiredFlag(
			"release prepare",
			flag,
			"--repository",
		);
		const expectedTimestampSha256 = requiredFlag(
			"release prepare",
			flag,
			"--expected-timestamp-sha256",
		);
		const keysPath = requiredFlag("release prepare", flag, "--keys");
		const releasePath = requiredFlag(
			"release prepare",
			flag,
			"--release-record",
		);
		const outputDirectory = requiredFlag("release prepare", flag, "--out");
		const now = nowFromFlag(flag("--now"));
		if (
			rootPath === undefined ||
			repositoryDirectory === undefined ||
			expectedTimestampSha256 === undefined ||
			keysPath === undefined ||
			releasePath === undefined ||
			outputDirectory === undefined ||
			now === undefined
		)
			return 1;
		const rawKeys = await readJson(keysPath, "--keys file");
		if (rawKeys === undefined) return 1;
		const keys = await loadIncrementalReleaseSigningKeys(rawKeys);
		if (!keys.ok) return reportRejection("release prepare", keys);
		const release = await readJson(releasePath, "--release-record file");
		if (
			!isRecord(release) ||
			typeof release.product !== "string" ||
			typeof release.version !== "string" ||
			!Array.isArray(release.artifactDescriptors)
		) {
			console.error(
				"--release-record must be {product,version,releasePredicate,artifactDescriptors}",
			);
			return 1;
		}
		const predicate = await validateReleaseRecordPredicate(
			release.releasePredicate as TufJsonValue,
		);
		if (!predicate.ok) return reportRejection("release prepare", predicate);
		const artifactDescriptors = release.artifactDescriptors;
		if (
			artifactDescriptors.some(
				(descriptor) =>
					!isRecord(descriptor) ||
					typeof descriptor.url !== "string" ||
					typeof descriptor.length !== "number" ||
					!Number.isSafeInteger(descriptor.length) ||
					descriptor.length < 0 ||
					typeof descriptor.sha256 !== "string" ||
					!/^[0-9a-f]{64}$/.test(descriptor.sha256),
			)
		) {
			console.error(
				"artifactDescriptors must contain {url,length,sha256} objects",
			);
			return 1;
		}
		const prior = await authenticateLocalRepository({
			repositoryDirectory,
			rootPath,
			expectedTimestampSha256,
			now,
		});
		if (!prior.ok) return reportRejection("release prepare", prior);
		const prepared = await prepareIncrementalRelease({
			priorState: prior.value,
			expectedPriorTimestampSha256: expectedTimestampSha256,
			product: release.product,
			version: release.version,
			artifactDescriptors: artifactDescriptors as {
				url: string;
				length: number;
				sha256: string;
			}[],
			releasePredicate: predicate.value,
			keys: keys.value,
			now,
		});
		if (!prepared.ok) return reportRejection("release prepare", prepared);
		const composed = composeRepositoryFiles({
			priorState: prior.value,
			replacedMetadata: [
				{
					roleName: "targets-software",
					metadata: prepared.value.targetsSoftware,
				},
				{ roleName: "snapshot", metadata: prepared.value.snapshot },
				{ roleName: "timestamp", metadata: prepared.value.timestamp },
			],
			newTargets: [
				{
					logicalPath: prepared.value.releaseRecordLogicalPath,
					bytes: prepared.value.releaseRecordBytes,
					sha256: prepared.value.releaseRecordSha256,
				},
			],
		});
		if (!composed.ok) return reportRejection("release prepare", composed);
		const written = await writePreparationOutput({
			outputDirectory,
			files: composed.value,
			operation: "release prepare",
			expectedPriorTimestampSha256: expectedTimestampSha256,
			newTimestampSha256: prepared.value.newTimestampSha256,
		});
		if (!written.ok) return reportRejection("release prepare", written);
		return emitPreparation(
			argv.includes("--json"),
			"release prepare",
			written.value,
		);
	}
	if (argv[0] === "timestamp" && argv[1] === "refresh") {
		const flag = (name: string): string | undefined => {
			const index = argv.indexOf(name);
			return index >= 0 ? argv[index + 1] : undefined;
		};
		const rootPath = requiredFlag("timestamp refresh", flag, "--root");
		const repositoryDirectory = requiredFlag(
			"timestamp refresh",
			flag,
			"--repository",
		);
		const expectedTimestampSha256 = requiredFlag(
			"timestamp refresh",
			flag,
			"--expected-timestamp-sha256",
		);
		const keysPath = requiredFlag("timestamp refresh", flag, "--keys");
		const outputDirectory = requiredFlag("timestamp refresh", flag, "--out");
		const now = nowFromFlag(flag("--now"));
		if (
			rootPath === undefined ||
			repositoryDirectory === undefined ||
			expectedTimestampSha256 === undefined ||
			keysPath === undefined ||
			outputDirectory === undefined ||
			now === undefined
		)
			return 1;
		const rawKeys = await readJson(keysPath, "--keys file");
		if (rawKeys === undefined) return 1;
		const timestampKey = await loadTimestampSigningKey(rawKeys);
		if (!timestampKey.ok)
			return reportRejection("timestamp refresh", timestampKey);
		const prior = await authenticateLocalRepository({
			repositoryDirectory,
			rootPath,
			expectedTimestampSha256,
			now,
		});
		if (!prior.ok) return reportRejection("timestamp refresh", prior);
		const refreshed = await refreshTimestamp({
			priorState: prior.value,
			expectedPriorTimestampSha256: expectedTimestampSha256,
			timestampKey: timestampKey.value,
			now,
		});
		if (!refreshed.ok) return reportRejection("timestamp refresh", refreshed);
		const replacements = replacedMetadata(
			["timestamp"],
			refreshed.value.renewedRoles,
		);
		if (!replacements.ok)
			return reportRejection("timestamp refresh", replacements);
		const composed = composeRepositoryFiles({
			priorState: prior.value,
			replacedMetadata: replacements.value,
		});
		if (!composed.ok) return reportRejection("timestamp refresh", composed);
		const written = await writePreparationOutput({
			outputDirectory,
			files: composed.value,
			operation: "timestamp refresh",
			expectedPriorTimestampSha256: expectedTimestampSha256,
			newTimestampSha256: refreshed.value.newTimestampSha256,
		});
		if (!written.ok) return reportRejection("timestamp refresh", written);
		return emitPreparation(
			argv.includes("--json"),
			"timestamp refresh",
			written.value,
		);
	}
	if (argv[0] === "metadata" && argv[1] === "renew") {
		const roleName = argv[2];
		if (!isMetadataRenewalRole(roleName)) {
			console.error(
				`metadata renew requires role <${METADATA_RENEWAL_ROLES.join("|")}>`,
			);
			return 1;
		}
		const flag = (name: string): string | undefined => {
			const index = argv.indexOf(name);
			return index >= 0 ? argv[index + 1] : undefined;
		};
		const rootPath = requiredFlag("metadata renew", flag, "--root");
		const repositoryDirectory = requiredFlag(
			"metadata renew",
			flag,
			"--repository",
		);
		const expectedTimestampSha256 = requiredFlag(
			"metadata renew",
			flag,
			"--expected-timestamp-sha256",
		);
		const keysPath = requiredFlag("metadata renew", flag, "--keys");
		const outputDirectory = requiredFlag("metadata renew", flag, "--out");
		const now = nowFromFlag(flag("--now"));
		if (
			rootPath === undefined ||
			repositoryDirectory === undefined ||
			expectedTimestampSha256 === undefined ||
			keysPath === undefined ||
			outputDirectory === undefined ||
			now === undefined
		)
			return 1;
		const rawKeys = await readJson(keysPath, "--keys file");
		if (rawKeys === undefined) return 1;
		const keys = await loadMetadataRenewalSigningKeys(rawKeys, roleName);
		if (!keys.ok) return reportRejection("metadata renew", keys);
		const prior = await authenticateLocalRepository({
			repositoryDirectory,
			rootPath,
			expectedTimestampSha256,
			now,
		});
		if (!prior.ok) return reportRejection("metadata renew", prior);
		const renewed = await renewTufMetadata({
			priorState: prior.value,
			expectedPriorTimestampSha256: expectedTimestampSha256,
			roleName,
			keys: keys.value,
			now,
		});
		if (!renewed.ok) return reportRejection("metadata renew", renewed);
		const roleNames =
			roleName === "snapshot"
				? ["snapshot", "timestamp"]
				: [roleName, "snapshot", "timestamp"];
		const replacements = replacedMetadata(
			roleNames,
			renewed.value.renewedRoles,
		);
		if (!replacements.ok)
			return reportRejection("metadata renew", replacements);
		const composed = composeRepositoryFiles({
			priorState: prior.value,
			replacedMetadata: replacements.value,
		});
		if (!composed.ok) return reportRejection("metadata renew", composed);
		const written = await writePreparationOutput({
			outputDirectory,
			files: composed.value,
			operation: "metadata renew",
			expectedPriorTimestampSha256: expectedTimestampSha256,
			newTimestampSha256: renewed.value.newTimestampSha256,
		});
		if (!written.ok) return reportRejection("metadata renew", written);
		return emitPreparation(
			argv.includes("--json"),
			"metadata renew",
			written.value,
		);
	}
	if (argv[0] === "verify-v2") {
		const flag = (name: string): string | undefined => {
			const index = argv.indexOf(name);
			return index >= 0 ? argv[index + 1] : undefined;
		};
		const rootPath = flag("--root");
		if (!rootPath) {
			console.error(
				"verify-v2 requires --root <file>; supply --root pointing at a locally-trusted root metadata file; this verifier does not bootstrap trust from the evidence channel it is verifying",
			);
			return 1;
		}
		const base = "https://transparency.solstone.app/v2";
		return verifyRepository({
			metadataBase: flag("--metadata-base") ?? `${base}/metadata`,
			targetsBase: flag("--targets-base") ?? `${base}/targets`,
			rootPath,
			storePath: flag("--store") ?? ".solstone-transparency-trust.json",
			json: argv.includes("--json"),
		});
	}
	if (argv[0] === "legacy-model") {
		const outIdx = argv.indexOf("--out");
		const outPath = outIdx >= 0 ? argv[outIdx + 1] : undefined;
		if (!outPath) {
			console.error("legacy-model requires --out <path>");
			return 1;
		}
		const result = await buildPortalModel();
		if (!result.ok) {
			console.error(
				`model degraded (http ${result.degraded.httpStatus}): ${result.degraded.reason}`,
			);
			return 1;
		}
		// Write the complete PortalModelResult (the `{ ok: true, model }` shape),
		// not just the bare model -- this is what `handle()`/`renderAll()` in
		// `src/portal` consume directly, with no re-wrapping required by whoever
		// builds and deploys the portal from this output.
		await Bun.write(outPath, `${JSON.stringify(result, null, 2)}\n`);
		console.log(`wrote portal model to ${outPath}`);
		return 0;
	}
	if (argv[0] === "sitemap") {
		const outIdx = argv.indexOf("--out");
		const outPath = outIdx >= 0 ? argv[outIdx + 1] : undefined;
		if (!outPath) {
			console.error("sitemap requires --out <path>");
			return 1;
		}
		const result = await buildPortalModel();
		if (!result.ok) {
			console.error(
				`model degraded (http ${result.degraded.httpStatus}): ${result.degraded.reason}`,
			);
			return 1;
		}
		await Bun.write(outPath, buildSitemap(result));
		console.log(`wrote sitemap to ${outPath}`);
		return 0;
	}
	console.log(HELP);
	return 0;
}
