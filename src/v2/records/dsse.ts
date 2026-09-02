// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

/**
 * DSSE envelope admission and cryptographic verification. This module knows only
 * the caller-provided key map: policy membership and authorization belong above it.
 */

import { admitTufJson } from "../tuf/admission";
import { verifyEd25519Signature } from "../tuf/ed25519";
import { type TufJsonValue, type TufResult, rejection } from "../tuf/outcome";

export const IN_TOTO_PAYLOAD_TYPE = "application/vnd.in-toto+json";

export interface DsseSignature {
	keyid: string;
	sig: string;
}

export interface DsseEnvelope {
	payloadType: string;
	payload: string;
	signatures: readonly DsseSignature[];
}

export type VerifiedDsseSignature =
	| { keyid: string; state: "verified" }
	| { keyid: string; state: "key-unavailable" };

export interface VerifiedDsseEnvelope {
	payloadType: string;
	payload: Uint8Array;
	verifiedSignatures: readonly VerifiedDsseSignature[];
}

export interface DsseEnvelopeVerificationInput {
	envelope: DsseEnvelope;
	expectedPayloadType: string;
	keys: Readonly<Record<string, unknown>>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

function typeName(value: unknown): string {
	if (value === null) return "null";
	if (Array.isArray(value)) return "array";
	return typeof value;
}

function malformed(
	path: readonly string[],
	expected: string,
	observed: unknown,
) {
	return rejection("malformed", { path, expected, observed });
}

function binaryFromBytes(bytes: Uint8Array): string {
	let binary = "";
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return binary;
}

function strictBase64(
	value: string,
	path: readonly string[],
): TufResult<Uint8Array> {
	if (
		!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
			value,
		)
	) {
		return malformed(path, "canonical padded standard base64", value);
	}
	try {
		const binary = atob(value);
		const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
		if (btoa(binaryFromBytes(bytes)) !== value) {
			return malformed(path, "canonical padded standard base64", value);
		}
		return { ok: true, value: bytes };
	} catch (error) {
		return malformed(
			path,
			"canonical padded standard base64",
			error instanceof Error ? error.name : typeName(error),
		);
	}
}

/** Builds DSSE PAE entirely from bytes; decimal lengths are Uint8Array byte lengths. */
export function dssePreAuthenticationEncoding(
	payloadTypeBytes: Uint8Array,
	payloadBytes: Uint8Array,
): Uint8Array {
	const encoder = new TextEncoder();
	const prefix = encoder.encode("DSSEv1 ");
	const typeLength = encoder.encode(`${payloadTypeBytes.byteLength} `);
	const payloadLength = encoder.encode(` ${payloadBytes.byteLength} `);
	const result = new Uint8Array(
		prefix.byteLength +
			typeLength.byteLength +
			payloadTypeBytes.byteLength +
			payloadLength.byteLength +
			payloadBytes.byteLength,
	);
	let offset = 0;
	for (const part of [
		prefix,
		typeLength,
		payloadTypeBytes,
		payloadLength,
		payloadBytes,
	]) {
		result.set(part, offset);
		offset += part.byteLength;
	}
	return result;
}

export function parseDsseEnvelopeValue(
	value: unknown,
): TufResult<DsseEnvelope> {
	if (!isRecord(value))
		return malformed([], "a DSSE envelope object", typeName(value));
	if (typeof value.payloadType !== "string")
		return malformed(
			["payloadType"],
			"a payloadType string",
			typeName(value.payloadType),
		);
	if (typeof value.payload !== "string")
		return malformed(
			["payload"],
			"a base64 payload string",
			typeName(value.payload),
		);
	if (!Array.isArray(value.signatures))
		return malformed(
			["signatures"],
			"a signatures array",
			typeName(value.signatures),
		);
	const signatures: DsseSignature[] = [];
	for (const [index, signature] of value.signatures.entries()) {
		if (
			!isRecord(signature) ||
			typeof signature.keyid !== "string" ||
			typeof signature.sig !== "string"
		) {
			return malformed(
				["signatures", String(index)],
				"a signature with string keyid and sig",
				typeName(signature),
			);
		}
		signatures.push({ keyid: signature.keyid, sig: signature.sig });
	}
	return {
		ok: true,
		value: {
			payloadType: value.payloadType,
			payload: value.payload,
			signatures,
		},
	};
}

export function parseDsseEnvelope(bytes: Uint8Array): TufResult<DsseEnvelope> {
	const admitted = admitTufJson(bytes);
	if (!admitted.ok) return admitted;
	return parseDsseEnvelopeValue(admitted.value);
}

/**
 * Verifies every known-key signature before any statement or predicate processing.
 * A missing map entry is reported to the caller as key-unavailable, never as policy
 * authorization: only the record layer can decide unknown-key versus another role.
 */
export async function verifyDsseEnvelope(
	input: DsseEnvelopeVerificationInput,
): Promise<TufResult<VerifiedDsseEnvelope>> {
	if (input.envelope.payloadType !== input.expectedPayloadType) {
		return rejection("payload-type-mismatch", {
			path: ["payloadType"],
			expected: input.expectedPayloadType,
			observed: input.envelope.payloadType,
		});
	}
	const payload = strictBase64(input.envelope.payload, ["payload"]);
	if (!payload.ok) return payload;
	const preimage = dssePreAuthenticationEncoding(
		new TextEncoder().encode(input.envelope.payloadType),
		payload.value,
	);
	const verifiedSignatures: VerifiedDsseSignature[] = [];
	for (const [index, signature] of input.envelope.signatures.entries()) {
		const signatureBytes = strictBase64(signature.sig, [
			"signatures",
			String(index),
			"sig",
		]);
		if (!signatureBytes.ok) return signatureBytes;
		const keyObject = input.keys[signature.keyid];
		if (keyObject === undefined) {
			verifiedSignatures.push({
				keyid: signature.keyid,
				state: "key-unavailable",
			});
			continue;
		}
		const verified = await verifyEd25519Signature({
			keyObject,
			expectedKeyId: signature.keyid,
			signature: signatureBytes.value,
			message: preimage,
		});
		if (!verified.ok) return verified;
		verifiedSignatures.push({ keyid: signature.keyid, state: "verified" });
	}
	return {
		ok: true,
		value: {
			payloadType: input.envelope.payloadType,
			payload: payload.value,
			verifiedSignatures,
		},
	};
}

export function encodeDsseBase64(bytes: Uint8Array): string {
	return btoa(binaryFromBytes(bytes));
}

export function asDsseJson(envelope: DsseEnvelope): TufJsonValue {
	return {
		payloadType: envelope.payloadType,
		payload: envelope.payload,
		signatures: envelope.signatures.map((signature) => ({ ...signature })),
	};
}
