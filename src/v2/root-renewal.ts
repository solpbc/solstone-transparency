// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

import { admitTufJson } from "./tuf/admission";
import { canonicalizeTufJson } from "./tuf/canonical";
import {
	parseClientMetadata,
	parseRootDeclarations,
	validateMetadataFreshnessAndSpec,
} from "./tuf/client-metadata";
import {
	type Ed25519SigningKey,
	computeKeyId,
	signEd25519,
} from "./tuf/ed25519";
import type { TufJsonValue, TufResult } from "./tuf/outcome";
import {
	type TufSignature,
	checkMetadataType,
	evaluateRoleAuthorization,
	validateRoleConfiguration,
} from "./tuf/role-graph";

const ROOT_VALIDITY_MS = 1095 * 86_400_000;

export class RootRenewalError extends Error {
	constructor(readonly reason: string) {
		super(reason);
		this.name = "RootRenewalError";
	}
}

function requireResult<T>(result: TufResult<T>): T {
	if (!result.ok) throw new RootRenewalError(result.reason);
	return result.value;
}

function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
	return (
		left.length === right.length &&
		left.every((byte, index) => byte === right[index])
	);
}

function expiryMillis(signed: Record<string, TufJsonValue>): number {
	if (typeof signed.expires !== "string")
		throw new RootRenewalError("malformed-expiry");
	const millis = Date.parse(signed.expires);
	if (
		!Number.isFinite(millis) ||
		new Date(millis).toISOString().replace(/\.\d{3}Z$/, "Z") !== signed.expires
	)
		throw new RootRenewalError("malformed-expiry");
	return millis;
}

function requireDistinctSignatures(signatures: readonly TufSignature[]): void {
	if (!Array.isArray(signatures)) throw new RootRenewalError("malformed");
	const seen = new Set<string>();
	for (const signature of signatures) {
		if (
			signature === null ||
			typeof signature !== "object" ||
			typeof signature.keyid !== "string" ||
			typeof signature.sig !== "string"
		)
			throw new RootRenewalError("malformed");
		if (seen.has(signature.keyid))
			throw new RootRenewalError("duplicate-signer");
		seen.add(signature.keyid);
	}
}

/** The caller supplies an already trusted root, never an unpinned network root. */
async function readPreviousRoot(previousRootBytes: Uint8Array) {
	const metadata = requireResult(
		parseClientMetadata("root", "previous.root.json", previousRootBytes),
	);
	requireResult(checkMetadataType(metadata.signed, "root"));
	const expires = expiryMillis(metadata.signed);
	// An expired trusted root can authorize recovery. Validate its syntax/spec here;
	// the successor must be fresh when merge publishes it, as in the TUF client.
	requireResult(
		validateMetadataFreshnessAndSpec(metadata.signed, new Date(expires - 1)),
	);
	const declarations = requireResult(parseRootDeclarations(metadata.signed));
	for (const role of Object.values(declarations.roles))
		requireResult(validateRoleConfiguration(role, declarations.keys));
	for (const [keyid, keyObject] of Object.entries(declarations.keys)) {
		if (requireResult(await computeKeyId(keyObject)) !== keyid)
			throw new RootRenewalError("keyid-mismatch");
	}
	requireDistinctSignatures(metadata.signatures);
	const message = requireResult(canonicalizeTufJson(metadata.signed));
	requireResult(
		await evaluateRoleAuthorization({
			role: declarations.roles.root,
			keys: declarations.keys,
			// A trusted rotated root may retain endorsements by its former quorum.
			// Like the TUF client, evaluate only its current self-signing authority.
			signatures: metadata.signatures.filter((signature) =>
				declarations.roles.root.keyids.includes(signature.keyid),
			),
			message,
		}),
	);
	return { metadata, declarations, expires };
}

type PreviousRoot = Awaited<ReturnType<typeof readPreviousRoot>>;

function readRenewalPayload(previous: PreviousRoot, bytes: Uint8Array) {
	const parsed = requireResult(admitTufJson(bytes));
	if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed))
		throw new RootRenewalError("malformed");
	const expires = expiryMillis(parsed);
	const version = previous.metadata.version + 1;
	if (!Number.isSafeInteger(version) || parsed.version !== version)
		throw new RootRenewalError("version-rollback");
	if (expires <= previous.expires)
		throw new RootRenewalError("renewal-does-not-extend-expiry");
	const expected = requireResult(
		canonicalizeTufJson({
			...previous.metadata.signed,
			version,
			expires: parsed.expires,
		}),
	);
	// Exact canonical bytes also prevent key/role/consistent-snapshot changes,
	// unknown-field changes and ambiguous signatures over alternative encodings.
	if (!sameBytes(expected, bytes))
		throw new RootRenewalError("renewal-payload-mismatch");
	return { signed: parsed, expires };
}

/** Prepares one immutable canonical proposal; it carries no private key material. */
export async function prepareRootRenewal(
	previousRootBytes: Uint8Array,
	now: Date,
): Promise<Uint8Array> {
	const nowMillis = now.getTime();
	if (
		!Number.isFinite(nowMillis) ||
		!Number.isFinite(nowMillis + ROOT_VALIDITY_MS)
	)
		throw new RootRenewalError("invalid-time");
	const expiry = new Date(nowMillis + ROOT_VALIDITY_MS);
	if (!Number.isFinite(expiry.getTime()))
		throw new RootRenewalError("invalid-time");
	const previous = await readPreviousRoot(previousRootBytes);
	const payload = requireResult(
		canonicalizeTufJson({
			...previous.metadata.signed,
			version: previous.metadata.version + 1,
			expires: expiry.toISOString().replace(/\.\d{3}Z$/, "Z"),
		}),
	);
	readRenewalPayload(previous, payload);
	return payload;
}

/** Signs exactly one prepared proposal with one already-decrypted root key. */
export async function signRootRenewal(
	previousRootBytes: Uint8Array,
	signedPayloadBytes: Uint8Array,
	key: Ed25519SigningKey,
): Promise<TufSignature> {
	// Snapshot mutable input buffers before any asynchronous cryptographic operation.
	const previousBytes = new Uint8Array(previousRootBytes);
	const payload = new Uint8Array(signedPayloadBytes);
	const previous = await readPreviousRoot(previousBytes);
	readRenewalPayload(previous, payload);
	if (!previous.declarations.roles.root.keyids.includes(key.keyId))
		throw new RootRenewalError("key-not-in-role");
	if (requireResult(await computeKeyId(key.keyObject)) !== key.keyId)
		throw new RootRenewalError("keyid-mismatch");
	const sig = requireResult(await signEd25519(key.privateKey, payload));
	const signature = { keyid: key.keyId, sig: Buffer.from(sig).toString("hex") };
	// Prove private/public correspondence against trusted authority, not key labels.
	requireResult(
		await evaluateRoleAuthorization({
			role: { ...previous.declarations.roles.root, threshold: 1 },
			keys: previous.declarations.keys,
			signatures: [signature],
			message: payload,
		}),
	);
	return signature;
}

/** Merges detached signatures only after both old and successor thresholds verify. */
export async function mergeRootRenewal(
	previousRootBytes: Uint8Array,
	payloadBytes: Uint8Array,
	signatures: readonly TufSignature[],
	now: Date,
): Promise<Uint8Array> {
	const previousBytes = new Uint8Array(previousRootBytes);
	const payload = new Uint8Array(payloadBytes);
	const nowMillis = now.getTime();
	if (!Number.isFinite(nowMillis)) throw new RootRenewalError("invalid-time");
	requireDistinctSignatures(signatures);
	const detached = signatures.map(({ keyid, sig }) => ({ keyid, sig }));
	const previous = await readPreviousRoot(previousBytes);
	const candidate = readRenewalPayload(previous, payload);
	if (candidate.expires > nowMillis + ROOT_VALIDITY_MS)
		throw new RootRenewalError("renewal-from-future");
	requireResult(
		validateMetadataFreshnessAndSpec(candidate.signed, new Date(nowMillis)),
	);
	const candidateAuthority = requireResult(
		parseRootDeclarations(candidate.signed),
	);
	for (const authority of [previous.declarations, candidateAuthority]) {
		requireResult(
			await evaluateRoleAuthorization({
				role: authority.roles.root,
				keys: authority.keys,
				signatures: detached,
				message: payload,
			}),
		);
	}
	detached.sort((left, right) => left.keyid.localeCompare(right.keyid));
	return requireResult(
		canonicalizeTufJson({ signed: candidate.signed, signatures: detached }),
	);
}
