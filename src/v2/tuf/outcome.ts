// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

/** The complete, closed vocabulary for v2 primitive rejections. */
export const TUF_REJECTION_REASONS = [
	"malformed",
	"invalid-encoding",
	"byte-length-changed",
	"unpaired-surrogate",
	"non-finite-number",
	"non-integer-number",
	"undefined-value",
	"oversized",
	"too-deep",
	"duplicate-key",
	"integer-not-round-trippable",
	"malformed-key",
	"wrong-key-length",
	"wrong-signature-length",
	"unsupported-key-type",
	"signature-invalid",
	"keyid-mismatch",
] as const;

export type TufRejectionReason = (typeof TUF_REJECTION_REASONS)[number];

/** A location within a JSON value. Array indexes use decimal string segments. */
export type JsonPath = readonly string[];

/** JSON values admitted from metadata bytes or accepted by the canonical encoder. */
export type TufJsonValue =
	| null
	| boolean
	| string
	| number
	| TufJsonValue[]
	| { [key: string]: TufJsonValue };

/** Every expected rejection states the attempted expectation and observed value. */
export interface TufFailureDetail {
	path: JsonPath;
	expected: unknown;
	observed: unknown;
	offset?: number;
	[key: string]: unknown;
}

export interface TufSuccess<T> {
	ok: true;
	value: T;
}

export interface TufFailure<R extends TufRejectionReason = TufRejectionReason> {
	ok: false;
	reason: R;
	detail: TufFailureDetail;
}

export type TufResult<T, R extends TufRejectionReason = TufRejectionReason> =
	| TufSuccess<T>
	| TufFailure<R>;

export function rejection<R extends TufRejectionReason>(
	reason: R,
	detail: TufFailureDetail,
): TufFailure<R> {
	return { ok: false, reason, detail };
}
