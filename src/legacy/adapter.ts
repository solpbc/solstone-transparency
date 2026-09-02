// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

/**
 * Live adapter: fetches the real v1 register from
 * `https://transparency.solstone.app`, verifies every record via
 * `verify.ts`, and builds the typed, already-trusted `PortalModel` a later,
 * separate portal-presentation change will consume. This module produces
 * data, not markup — it implements no route, HTML, or UI.
 *
 * Read-only: this module makes no write, no signing, and no publication
 * call. If the evidence host is unreachable, callers get a `ModelDegraded`
 * result, never a stale or fabricated model.
 */

import { sha256Hex } from "./canonical";
import { CATALOG, JOURNAL_GAP } from "./inventory";
import * as rawlink from "./rawlink";
import type {
	ArtifactRef,
	AxisBlock,
	EntryRecord,
	EvidenceLinkStatus,
	GapRecord,
	KeyRecord,
	ModelConstructionFailure,
	ModelDegraded,
	PortalModel,
	PortalModelResult,
	SubjectModel,
	TimelineEntry,
	WindowsAbsenceFact,
} from "./types";
import type { LedgerEntryV1Raw } from "./verify";
import {
	checkEntryFields,
	computeFreshness,
	verifyEntry,
	verifyPointer,
} from "./verify";

const BASE_URL = "https://transparency.solstone.app";
const KEY_FILENAME = "solpbc-transparency-1.pub";

export type CatalogOverride = Partial<
	Record<"journal" | "linux" | "windows", string[]>
>;

/** Parses the minisign key-id line out of a public-key file. No match is unavailable, never a guessed fingerprint. */
function parseFingerprint(
	pubKeyText: string,
	checkedAt: string,
): KeyRecord["fingerprint"] {
	const firstLine = pubKeyText.split(/\r?\n/, 1)[0] ?? "";
	const match = /^untrusted comment: minisign public key (.+)$/.exec(
		firstLine.trimEnd(),
	);
	const value = match?.[1]?.trim();
	if (value === undefined || value === "") {
		return {
			status: "unavailable",
			reason: "could not parse minisign key id from the public-key file",
			provenance: { kind: "verifier", checkedAt },
		};
	}
	return { status: "known", value };
}

export interface Fetcher {
	getBytes(path: string): Promise<{ status: number; body: Uint8Array } | null>;
	getText(path: string): Promise<{ status: number; body: string } | null>;
}

/** The real HTTP fetcher against the live evidence host. Tests inject a fake implementing the same interface — no live network call happens inside a test. */
export const liveFetcher: Fetcher = {
	async getBytes(path: string) {
		const res = await fetch(`${BASE_URL}/${path}`);
		if (res.status !== 200)
			return { status: res.status, body: new Uint8Array() };
		return {
			status: res.status,
			body: new Uint8Array(await res.arrayBuffer()),
		};
	},
	async getText(path: string) {
		const res = await fetch(`${BASE_URL}/${path}`);
		if (res.status !== 200) return { status: res.status, body: "" };
		return { status: res.status, body: await res.text() };
	},
};

function linkFor(result: rawlink.RawLinkResult): EvidenceLinkStatus {
	if (result.status === "linked")
		return { status: "linked", link: { url: result.url } };
	return { status: "rejected", rejected: { reason: result.reason } };
}

function toArtifactRefs(raw: unknown): ArtifactRef[] {
	if (!Array.isArray(raw)) return [];
	return raw
		.filter(
			(r): r is { name: string; sha256: string; bytes: number } =>
				typeof r?.name === "string" &&
				typeof r?.sha256 === "string" &&
				typeof r?.bytes === "number",
		)
		.map((r) => ({ name: r.name, sha256: r.sha256, bytes: r.bytes }));
}

async function buildEntryRecord(
	fetcher: Fetcher,
	pubKeyText: string,
	product: "journal" | "linux",
	fullProduct: string,
	version: string,
	expectedPrevSha256: string | null,
	isTip: boolean,
	now: Date,
): Promise<EntryRecord | ModelConstructionFailure> {
	const checkedAt = now.toISOString().replace(/\.\d+Z$/, "Z");
	const entryPath = `releases/${fullProduct}/v/${version}/ledger-entry.json`;
	const sigPath = `${entryPath}.minisig`;
	const [entryRes, sigRes] = await Promise.all([
		fetcher.getBytes(entryPath),
		fetcher.getText(sigPath),
	]);
	if (entryRes === null || entryRes.status !== 200) {
		return {
			kind: "missing-object",
			product,
			version,
			declaredName: entryPath,
			provenance: { kind: "verifier", checkedAt },
			checkedAt,
		};
	}
	if (sigRes === null || sigRes.status !== 200) {
		return {
			kind: "missing-object",
			product,
			version,
			declaredName: sigPath,
			provenance: { kind: "verifier", checkedAt },
			checkedAt,
		};
	}

	let parsed: LedgerEntryV1Raw;
	try {
		parsed = JSON.parse(new TextDecoder().decode(entryRes.body));
	} catch {
		return {
			kind: "malformed",
			product,
			version,
			reason: "entry body is not valid JSON",
			provenance: { kind: "verifier", checkedAt },
			checkedAt,
		};
	}
	const fieldCheck = checkEntryFields(parsed);
	if (!fieldCheck.ok) {
		if (fieldCheck.problem === "missing-subject") {
			return {
				kind: "missing-subject",
				product,
				version,
				provenance: { kind: "verifier", checkedAt },
				checkedAt,
			};
		}
		return {
			kind: "malformed",
			product,
			version,
			reason: fieldCheck.detail,
			provenance: { kind: "verifier", checkedAt },
			checkedAt,
		};
	}
	const fields = fieldCheck.fields;

	// The entry's own identity hash is computed from its bytes regardless of
	// whether its signature verifies — the NEXT entry's chain-link check is
	// about byte linkage, not about whether this entry passed its own check.
	const entrySha256 = await sha256Hex(entryRes.body);

	const outcome = await verifyEntry({
		entryBytes: entryRes.body,
		entrySigText: sigRes.body,
		pubKeyText,
		expectedPrevSha256,
		checkedAt,
	});

	const manifestRefs = toArtifactRefs(parsed.manifests);
	const proofRefs = toArtifactRefs(parsed.proofs);
	const artifactRefs = toArtifactRefs(parsed.artifacts);

	// A missing-subject/malformed outcome from verifyEntry itself (defense in depth; checkEntryFields above should already have caught it) still routes to the model-construction-failure shape, never into an axis block.
	if (outcome.state === "missing-subject") {
		return {
			kind: "missing-subject",
			product,
			version,
			provenance: { kind: "verifier", checkedAt },
			checkedAt,
		};
	}
	if (outcome.state === "malformed") {
		return {
			kind: "malformed",
			product,
			version,
			reason: outcome.reason,
			provenance: { kind: "verifier", checkedAt },
			checkedAt,
		};
	}

	const verification: AxisBlock["verification"] =
		outcome.state === "valid"
			? {
					state: "valid",
					checkedAt,
					provenance: { kind: "verifier", checkedAt },
				}
			: outcome.state === "invalid"
				? {
						state: "invalid",
						reason: outcome.reason,
						checkedAt,
						provenance: { kind: "verifier", checkedAt },
					}
				: {
						state: "unavailable",
						reason: outcome.reason,
						checkedAt,
						provenance: { kind: "verifier", checkedAt },
					};

	// Freshness is a property of the separately-signed mutable pointer, never
	// of this entry — an entry-verification failure (`outcome.state` above)
	// must never taint this axis, and a non-tip entry was never itself signed
	// as "valid until <date>", so it gets the structural "not-time-bound"
	// state rather than a value derived from its own `published_utc`.
	let latestLink: EvidenceLinkStatus | undefined;
	let latestSigLink: EvidenceLinkStatus | undefined;
	let freshness: AxisBlock["freshness"] = {
		state: "not-time-bound",
		provenance: { kind: "register" },
	};

	if (isTip) {
		latestLink = linkFor(rawlink.latestUrl(fullProduct));
		latestSigLink = linkFor(rawlink.latestSigUrl(fullProduct));
		const latestPath = `releases/${fullProduct}/latest.json`;
		const [ptrBody, ptrSig] = await Promise.all([
			fetcher.getBytes(latestPath),
			fetcher.getText(`${latestPath}.minisig`),
		]);
		freshness = {
			state: "unavailable",
			reason: "the signed freshness pointer could not be fetched",
			checkedAt,
			provenance: { kind: "verifier", checkedAt },
		};
		if (ptrBody && ptrBody.status === 200 && ptrSig && ptrSig.status === 200) {
			const ptrOutcome = await verifyPointer({
				pointerBytes: ptrBody.body,
				pointerSigText: ptrSig.body,
				pubKeyText,
				checkedAt,
			});
			if (ptrOutcome.state === "valid") {
				const freshState = computeFreshness(ptrOutcome.validUntil, now);
				freshness = {
					state: freshState,
					validUntil: ptrOutcome.validUntil,
					signedAt: ptrOutcome.signedAt,
					provenance: {
						kind: "signed",
						sourceUrl: `${BASE_URL}/${latestPath}`,
					},
				};
			} else {
				freshness = {
					state: "unavailable",
					reason: `the signed freshness pointer did not verify: ${ptrOutcome.reason}`,
					checkedAt,
					provenance: { kind: "verifier", checkedAt },
				};
			}
		}
	}

	return {
		kind: "entry",
		product,
		version,
		seq: fields.seq,
		entrySha256,
		publishedUtc: fields.publishedUtc,
		prevSha256: fields.prevSha256,
		prevVersion: fields.prevVersion,
		entryLink: linkFor(rawlink.entryUrl(fullProduct, version)),
		entrySigLink: linkFor(rawlink.entrySigUrl(fullProduct, version)),
		manifests: manifestRefs.map((ref) => ({
			ref,
			link: linkFor(rawlink.versionMemberUrl(fullProduct, version, ref.name)),
		})),
		proofs: proofRefs.map((ref) => ({
			ref,
			link: linkFor(rawlink.versionMemberUrl(fullProduct, version, ref.name)),
		})),
		artifacts: artifactRefs.map((ref) => ({
			ref,
			link: {
				status: "unhosted",
				artifact: {
					...ref,
					note: "not independently hosted; verify by hash comparison",
				},
			},
		})),
		axes: {
			publication: {
				state: "paused",
				basis: "operator decision, 2026-08-12/18",
				provenance: {
					kind: "declaration",
					basis: "operator decision, 2026-08-12/18",
				},
			},
			freshness,
			verification,
			rebuild: { state: "not-attempted", provenance: { kind: "register" } },
		},
		isTip,
		latestLink,
		latestSigLink,
	};
}

async function buildProductTimeline(
	fetcher: Fetcher,
	pubKeyText: string,
	product: "journal" | "linux",
	now: Date,
	versions: string[],
): Promise<TimelineEntry[]> {
	const fullProduct =
		product === "journal" ? "solstone-journal" : "solstone-linux";
	const timeline: TimelineEntry[] = [];
	let expectedPrevSha256: string | null = "0".repeat(64);
	for (let i = 0; i < versions.length; i++) {
		const version = versions[i];
		if (version === undefined) continue;
		const isTip = i === versions.length - 1;
		const record = await buildEntryRecord(
			fetcher,
			pubKeyText,
			product,
			fullProduct,
			version,
			expectedPrevSha256,
			isTip,
			now,
		);
		timeline.push(record);
		// Chain linkage for the NEXT entry is checked against this entry's actual
		// byte hash, independent of whether this entry's own signature verified —
		// a signature failure and a chain-link failure are deliberately distinct
		// findings. Only a record we could not even parse into an entry (missing
		// or malformed) leaves the next link unassertable.
		expectedPrevSha256 = record.kind === "entry" ? record.entrySha256 : null;
		if (product === "journal" && version === JOURNAL_GAP.afterVersion) {
			const gap: GapRecord = {
				kind: "gap",
				product,
				afterSeq: JOURNAL_GAP.afterSeq,
				beforeSeq: JOURNAL_GAP.beforeSeq,
				afterVersion: JOURNAL_GAP.afterVersion,
				beforeVersion: JOURNAL_GAP.beforeVersion,
				absentVersion: JOURNAL_GAP.absentVersion,
				provenance: { kind: "register" },
			};
			timeline.push(gap);
		}
	}
	return timeline;
}

async function buildWindowsFact(
	fetcher: Fetcher,
	now: Date,
): Promise<WindowsAbsenceFact> {
	const observedAt = now.toISOString().replace(/\.\d+Z$/, "Z");
	const res = await fetcher.getBytes("releases/solstone-windows/latest.json");
	const method =
		res && res.status === 200
			? "unexpectedly found a pointer (see model-degraded flag)"
			: `GET releases/solstone-windows/latest.json returned ${res?.status ?? "no response"}`;
	return {
		kind: "windows-absence",
		provenance: { kind: "register" },
		observedAt,
		observationMethod: method,
	};
}

export async function buildPortalModel(
	fetcher: Fetcher = liveFetcher,
	now: Date = new Date(),
	catalogOverride?: CatalogOverride,
): Promise<PortalModelResult> {
	const keyRes = await fetcher.getText(`releases/keys/${KEY_FILENAME}`);
	if (keyRes === null || keyRes.status !== 200) {
		const degraded: ModelDegraded = {
			httpStatus: keyRes?.status ?? 0,
			marker: "degraded",
			reason: "could not fetch the pinned public key",
			neverStale: true,
		};
		return { ok: false, degraded };
	}
	const pubKeyText = keyRes.body;

	const journalVersions = catalogOverride?.journal ?? CATALOG.journal;
	const linuxVersions = catalogOverride?.linux ?? CATALOG.linux;
	// catalogOverride.windows is accepted for type-symmetry with CATALOG and has no effect: windows never walks a version catalog.
	const [journalTimeline, linuxTimeline, windowsFact] = await Promise.all([
		buildProductTimeline(fetcher, pubKeyText, "journal", now, journalVersions),
		buildProductTimeline(fetcher, pubKeyText, "linux", now, linuxVersions),
		buildWindowsFact(fetcher, now),
	]);

	const generatedAt = now.toISOString().replace(/\.\d+Z$/, "Z");

	const subjects: SubjectModel[] = [
		{
			product: "journal",
			timeline: journalTimeline,
			ledger: { link: linkFor(rawlink.ledgerUrl("solstone-journal")) },
		},
		{
			product: "linux",
			timeline: linuxTimeline,
			ledger: { link: linkFor(rawlink.ledgerUrl("solstone-linux")) },
		},
		{ product: "windows", fact: windowsFact },
	];

	const model: PortalModel = {
		generatedAt,
		registerDeclaration: {
			basis:
				"operator decision, 2026-08-12/18: publication is deliberately paused",
			provenance: {
				kind: "declaration",
				basis: "operator decision, 2026-08-12/18",
			},
		},
		subjects,
		keys: [
			{
				filename: KEY_FILENAME,
				role: "verifies this v1 historical register only",
				status: "active",
				link: linkFor(rawlink.keyUrl(KEY_FILENAME)),
				publicKeyText: pubKeyText,
				algorithm: "ed25519",
				fingerprint: parseFingerprint(pubKeyText, generatedAt),
			},
		],
	};
	return { ok: true, model };
}
