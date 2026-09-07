// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	mergeRootRenewal,
	prepareRootRenewal,
	signRootRenewal,
} from "./root-renewal";
import { buildRepository } from "./tuf/builder";
import { canonicalizeTufJson } from "./tuf/canonical";
import { updateTufRepository } from "./tuf/client";
import { generateEd25519SigningKey, signEd25519 } from "./tuf/ed25519";
import type { TufFetchResponse } from "./tuf/fetch";
import {
	generateSyntheticKeySet,
	loadRepositorySigningKeys,
} from "./tuf/keyset";
import type { TufResult } from "./tuf/outcome";
import { metadataFilename } from "./tuf/serializer";
import { openFileTrustStore } from "./tuf/trust-store";

const genesisTime = new Date("2030-01-02T03:04:05Z");
const renewalTime = new Date("2030-01-03T03:04:05Z");
const day = 86_400_000;

function must<T>(result: TufResult<T>): T {
	if (!result.ok) throw new Error(`synthetic fixture failed: ${result.reason}`);
	return result.value;
}

function canonical(value: unknown): Uint8Array {
	return must(canonicalizeTufJson(value));
}

function json(bytes: Uint8Array): Record<string, unknown> {
	return JSON.parse(new TextDecoder().decode(bytes));
}

async function fixture() {
	// All keys are generated in memory for this test and never persisted.
	const keys = must(
		await loadRepositorySigningKeys(await generateSyntheticKeySet()),
	);
	const repository = must(
		await buildRepository({
			signingKeys: keys.signingKeys,
			targets: {},
			consistentSnapshot: true,
			now: genesisTime,
		}),
	);
	const [first, second, third] = keys.signingKeys.root;
	if (!first || !second || !third) throw new Error("missing synthetic roots");
	return {
		keys,
		repository,
		previous: repository.root.bytes,
		first,
		second,
		third,
	};
}

async function detachedFixture() {
	const built = await fixture();
	const payload = await prepareRootRenewal(built.previous, renewalTime);
	// Separate single-key operations. Neither receives the other key.
	const firstSignature = await signRootRenewal(
		built.previous,
		payload,
		built.first,
	);
	const secondSignature = await signRootRenewal(
		built.previous,
		payload,
		built.second,
	);
	return { ...built, payload, firstSignature, secondSignature };
}

test("root renewal rejects one signer, then merges detached two-of-three in deterministic order", async () => {
	const built = await detachedFixture();
	await expect(
		mergeRootRenewal(
			built.previous,
			built.payload,
			[built.firstSignature],
			renewalTime,
		),
	).rejects.toThrow("threshold-unmet");
	const forward = await mergeRootRenewal(
		built.previous,
		built.payload,
		[built.firstSignature, built.secondSignature],
		renewalTime,
	);
	const reverse = await mergeRootRenewal(
		built.previous,
		built.payload,
		[built.secondSignature, built.firstSignature],
		renewalTime,
	);
	expect(forward).toEqual(reverse);
	const signed = json(built.payload);
	expect(signed).toEqual({
		...built.repository.root.envelope.signed,
		version: 2,
		expires: new Date(renewalTime.getTime() + 1095 * day)
			.toISOString()
			.replace(".000Z", "Z"),
	});
	expect(json(forward).signatures).toEqual(
		[built.firstSignature, built.secondSignature].sort((a, b) =>
			a.keyid.localeCompare(b.keyid),
		),
	);
});

test("a client trusting the previous root accepts the detached renewal", async () => {
	const built = await detachedFixture();
	const renewed = await mergeRootRenewal(
		built.previous,
		built.payload,
		[built.firstSignature, built.secondSignature],
		renewalTime,
	);
	const objects = new Map<string, TufFetchResponse>();
	for (const metadata of [
		built.repository.root,
		built.repository.timestamp,
		built.repository.snapshot,
		built.repository.targets,
		...built.repository.delegatedTargets,
	]) {
		objects.set(
			must(metadataFilename(metadata.roleName, metadata.version, true)),
			{
				kind: "ok",
				bytes: metadata.bytes,
			},
		);
	}
	const directory = await mkdtemp(join(tmpdir(), "synthetic-root-renewal-"));
	try {
		const store = openFileTrustStore(join(directory, "trust.json"));
		const fetcher = {
			async fetch(path: string): Promise<TufFetchResponse> {
				return objects.get(path) ?? { kind: "not-found" };
			},
		};
		const initial = await updateTufRepository({
			bootstrapRoot: built.previous,
			now: genesisTime,
			trustStore: store,
			fetcher,
		});
		expect(initial).toMatchObject({
			ok: true,
			value: { versions: { root: 1 } },
		});
		objects.set("2.root.json", { kind: "ok", bytes: renewed });
		const accepted = await updateTufRepository({
			bootstrapRoot: built.previous,
			now: renewalTime,
			trustStore: store,
			fetcher,
		});
		expect(accepted).toMatchObject({
			ok: true,
			value: { versions: { root: 2 } },
		});
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
});

test("duplicate signer, unknown signer and a damaged detached signature fail", async () => {
	const built = await detachedFixture();
	await expect(
		mergeRootRenewal(
			built.previous,
			built.payload,
			[built.firstSignature, built.firstSignature],
			renewalTime,
		),
	).rejects.toThrow("duplicate-signer");
	await expect(
		mergeRootRenewal(
			built.previous,
			built.payload,
			[
				built.firstSignature,
				{ ...built.secondSignature, keyid: "0".repeat(64) },
			],
			renewalTime,
		),
	).rejects.toThrow("key-not-in-role");
	await expect(
		mergeRootRenewal(
			built.previous,
			built.payload,
			[
				built.firstSignature,
				{ ...built.secondSignature, sig: "0".repeat(128) },
			],
			renewalTime,
		),
	).rejects.toThrow("signature-invalid");
});

test("a substituted private key or untrusted public identity cannot sign a renewal", async () => {
	const built = await detachedFixture();
	const stranger = must(await generateEd25519SigningKey());
	await expect(
		signRootRenewal(built.previous, built.payload, stranger),
	).rejects.toThrow("key-not-in-role");
	await expect(
		signRootRenewal(built.previous, built.payload, {
			...built.first,
			privateKey: stranger.privateKey,
		}),
	).rejects.toThrow("signature-invalid");
	await expect(
		signRootRenewal(built.previous, built.payload, {
			...built.first,
			keyObject: stranger.keyObject,
		}),
	).rejects.toThrow("keyid-mismatch");
});

test("payload mutations cannot change keys, roles, consistent snapshots or other signed fields", async () => {
	const built = await detachedFixture();
	const signed = json(built.payload);
	for (const changes of [
		{ keys: {} },
		{ roles: {} },
		{ consistent_snapshot: false },
		{ _type: "targets" },
		{ unexpected: true },
	]) {
		const mutated = canonical({ ...signed, ...changes });
		await expect(
			signRootRenewal(built.previous, mutated, built.first),
		).rejects.toThrow("renewal-payload-mismatch");
		await expect(
			mergeRootRenewal(
				built.previous,
				mutated,
				[built.firstSignature, built.secondSignature],
				renewalTime,
			),
		).rejects.toThrow("renewal-payload-mismatch");
	}
	const alteredExpiry = canonical({
		...signed,
		expires: new Date(Date.parse(String(signed.expires)) - 3600_000)
			.toISOString()
			.replace(".000Z", "Z"),
	});
	await expect(
		mergeRootRenewal(
			built.previous,
			alteredExpiry,
			[built.firstSignature, built.secondSignature],
			renewalTime,
		),
	).rejects.toThrow("signature-invalid");
});

test("malformed, ambiguous and noncanonical renewal payloads fail before signing", async () => {
	const built = await detachedFixture();
	for (const payload of [
		new TextEncoder().encode("{broken"),
		new TextEncoder().encode('{"version":2,"version":2}'),
		new TextEncoder().encode(JSON.stringify(json(built.payload), null, 2)),
		canonical([]),
	]) {
		await expect(
			signRootRenewal(built.previous, payload, built.first),
		).rejects.toThrow();
	}
});

test("the previous root must authenticate itself and retain the approved quorum", async () => {
	const built = await fixture();
	const envelope = json(built.previous);
	const tampered = canonical({
		...envelope,
		signed: { ...built.repository.root.envelope.signed, version: 9 },
	});
	await expect(prepareRootRenewal(tampered, renewalTime)).rejects.toThrow(
		"signature-invalid",
	);
	const insufficient = canonical({
		...envelope,
		signatures: [built.repository.root.envelope.signatures[0]],
	});
	await expect(prepareRootRenewal(insufficient, renewalTime)).rejects.toThrow(
		"threshold-unmet",
	);
	await expect(
		prepareRootRenewal(new TextEncoder().encode("{}"), renewalTime),
	).rejects.toThrow("malformed");
});

test("stale versions, non-extended expiry and invalid dates fail", async () => {
	const built = await detachedFixture();
	for (const version of [1, 3, -1]) {
		await expect(
			signRootRenewal(
				built.previous,
				canonical({ ...json(built.payload), version }),
				built.first,
			),
		).rejects.toThrow("version-rollback");
	}
	await expect(prepareRootRenewal(built.previous, genesisTime)).rejects.toThrow(
		"renewal-does-not-extend-expiry",
	);
	await expect(
		prepareRootRenewal(built.previous, new Date("invalid")),
	).rejects.toThrow("invalid-time");
	await expect(
		prepareRootRenewal(built.previous, new Date(8.64e15)),
	).rejects.toThrow("invalid-time");
	await expect(
		signRootRenewal(
			built.previous,
			canonical({ ...json(built.payload), expires: "not-a-date" }),
			built.first,
		),
	).rejects.toThrow("malformed-expiry");
	const renewed = await mergeRootRenewal(
		built.previous,
		built.payload,
		[built.firstSignature, built.secondSignature],
		renewalTime,
	);
	await expect(
		signRootRenewal(renewed, built.payload, built.first),
	).rejects.toThrow("version-rollback");
});

test("merge rejects future-dated or expired proposals and permits detached-signing delay", async () => {
	const built = await detachedFixture();
	const signatures = [built.firstSignature, built.secondSignature];
	await expect(
		mergeRootRenewal(built.previous, built.payload, signatures, genesisTime),
	).rejects.toThrow("renewal-from-future");
	await expect(
		mergeRootRenewal(
			built.previous,
			built.payload,
			signatures,
			new Date(String(json(built.payload).expires)),
		),
	).rejects.toThrow("expired");
	await expect(
		mergeRootRenewal(
			built.previous,
			built.payload,
			signatures,
			new Date("invalid"),
		),
	).rejects.toThrow("invalid-time");
	const delayed = await mergeRootRenewal(
		built.previous,
		built.payload,
		signatures,
		new Date(renewalTime.getTime() + day),
	);
	expect(json(delayed).signed).toEqual(json(built.payload));
});

test("an expired but authentic previous root can authorize a fresh recovery renewal", async () => {
	const built = await fixture();
	const later = new Date(genesisTime.getTime() + 1096 * day);
	const payload = await prepareRootRenewal(built.previous, later);
	const first = await signRootRenewal(built.previous, payload, built.first);
	const third = await signRootRenewal(built.previous, payload, built.third);
	const renewed = await mergeRootRenewal(
		built.previous,
		payload,
		[first, third],
		later,
	);
	expect(json(renewed).signed).toEqual(json(payload));
});

test("renewal after a root rotation tolerates retained former-root endorsements", async () => {
	const built = await fixture();
	const replacement = must(await generateEd25519SigningKey());
	const oldSigned = built.repository.root.envelope.signed;
	const signed = {
		...oldSigned,
		version: 2,
		keys: {
			...(oldSigned.keys as Record<string, unknown>),
			[replacement.keyId]: replacement.keyObject,
		},
		roles: {
			...(oldSigned.roles as Record<string, unknown>),
			root: {
				keyids: [built.first.keyId, built.second.keyId, replacement.keyId],
				threshold: 2,
			},
		},
	};
	const payload = canonical(signed);
	const signatures = [];
	for (const key of [built.first, built.second, built.third, replacement]) {
		signatures.push({
			keyid: key.keyId,
			sig: Buffer.from(
				must(await signEd25519(key.privateKey, payload)),
			).toString("hex"),
		});
	}
	// A previously authenticated rotation legitimately retains the old-only signer.
	const previous = canonical({ signed, signatures });
	const proposal = await prepareRootRenewal(previous, renewalTime);
	const first = await signRootRenewal(previous, proposal, built.first);
	const second = await signRootRenewal(previous, proposal, built.second);
	const renewed = await mergeRootRenewal(
		previous,
		proposal,
		[first, second],
		renewalTime,
	);
	expect(json(proposal).version).toBe(3);
	expect(json(renewed).signed).toEqual(json(proposal));
});
