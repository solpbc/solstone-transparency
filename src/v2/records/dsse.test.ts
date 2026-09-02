// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

import { describe, expect, test } from "bun:test";
import { canonicalizeTufJson } from "../tuf/canonical";
import { signEd25519 } from "../tuf/ed25519";
import {
	IN_TOTO_PAYLOAD_TYPE,
	dssePreAuthenticationEncoding,
	encodeDsseBase64,
	parseDsseEnvelope,
	verifyDsseEnvelope,
} from "./dsse";
import { generatedKey } from "./records.test-support";

describe("DSSE PAE and envelope verification", () => {
	test("AC 1: PAE counts UTF-8 bytes, including astral characters", () => {
		const type = new TextEncoder().encode("type/é");
		const payload = new TextEncoder().encode("é😀");
		const preimage = dssePreAuthenticationEncoding(type, payload);
		expect(new TextDecoder().decode(preimage)).toBe("DSSEv1 7 type/é 6 é😀");
	});

	test("AC 2: a valid envelope verifies and a payloadType-only mutation is distinct", async () => {
		const key = await generatedKey();
		const payload = new TextEncoder().encode('{"ok":true}');
		const signature = await signEd25519(
			key.privateKey,
			dssePreAuthenticationEncoding(
				new TextEncoder().encode(IN_TOTO_PAYLOAD_TYPE),
				payload,
			),
		);
		expect(signature.ok).toBe(true);
		if (!signature.ok) throw new Error(signature.reason);
		const envelope = {
			payloadType: IN_TOTO_PAYLOAD_TYPE,
			payload: encodeDsseBase64(payload),
			signatures: [
				{ keyid: key.keyId, sig: encodeDsseBase64(signature.value) },
			],
		};
		const accepted = await verifyDsseEnvelope({
			envelope,
			expectedPayloadType: IN_TOTO_PAYLOAD_TYPE,
			keys: { [key.keyId]: key.keyObject },
		});
		expect(accepted.ok).toBe(true);
		const changed = await verifyDsseEnvelope({
			envelope: { ...envelope, payloadType: "application/other" },
			expectedPayloadType: IN_TOTO_PAYLOAD_TYPE,
			keys: { [key.keyId]: key.keyObject },
		});
		expect(changed).toMatchObject({
			ok: false,
			reason: "payload-type-mismatch",
		});
	});

	test("AC 3 and 5u: crypto failures are named and base64 is canonical", async () => {
		const key = await generatedKey();
		const invalid = await verifyDsseEnvelope({
			envelope: {
				payloadType: IN_TOTO_PAYLOAD_TYPE,
				payload: "e30=",
				signatures: [{ keyid: key.keyId, sig: "AAAA" }],
			},
			expectedPayloadType: IN_TOTO_PAYLOAD_TYPE,
			keys: { [key.keyId]: key.keyObject },
		});
		expect(invalid).toMatchObject({
			ok: false,
			reason: "wrong-signature-length",
		});
		const nonCanonical = await verifyDsseEnvelope({
			envelope: {
				payloadType: IN_TOTO_PAYLOAD_TYPE,
				payload: "e30",
				signatures: [],
			},
			expectedPayloadType: IN_TOTO_PAYLOAD_TYPE,
			keys: {},
		});
		expect(nonCanonical).toMatchObject({ ok: false, reason: "malformed" });
		for (const payload of ["e30=\n", "e30", "-w=="]) {
			expect(
				await verifyDsseEnvelope({
					envelope: {
						payloadType: IN_TOTO_PAYLOAD_TYPE,
						payload,
						signatures: [],
					},
					expectedPayloadType: IN_TOTO_PAYLOAD_TYPE,
					keys: {},
				}),
			).toMatchObject({ ok: false, reason: "malformed" });
		}
		expect(
			await verifyDsseEnvelope({
				envelope: {
					payloadType: IN_TOTO_PAYLOAD_TYPE,
					payload: "e30=",
					signatures: [{ keyid: key.keyId, sig: "AA-_" }],
				},
				expectedPayloadType: IN_TOTO_PAYLOAD_TYPE,
				keys: { [key.keyId]: key.keyObject },
			}),
		).toMatchObject({ ok: false, reason: "malformed" });
	});

	test("envelope bytes use the bounded shared JSON admission path", () => {
		const source = canonicalizeTufJson({
			payloadType: IN_TOTO_PAYLOAD_TYPE,
			payload: "e30=",
			signatures: [],
		});
		expect(source.ok).toBe(true);
		if (!source.ok) throw new Error(source.reason);
		expect(parseDsseEnvelope(source.value).ok).toBe(true);
		expect(
			parseDsseEnvelope(new TextEncoder().encode('{"payload":1}')),
		).toMatchObject({
			ok: false,
			reason: "malformed",
		});
	});
});
