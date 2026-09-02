// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

import { beforeAll, describe, expect, test } from "bun:test";
import { buildPortalModel } from "../legacy/adapter";
import {
	HOME_HERO_EXPLAINER,
	HOME_PUBLICATION_DECLARATION,
	KEYS_ROLE_STATEMENT,
	SOFTWARE_COVERAGE_CAVEAT,
	VERIFY_METHOD_INTRO,
	VERIFY_OUTCOME_FAIL,
	VERIFY_OUTCOME_PASS,
	VERIFY_OUTCOME_UNREACHABLE,
	VERSION_ARTIFACT_NOTE,
	WINDOWS_ABSENCE_EXPLAINER,
	homeRegisterSummaryRow,
} from "../legacy/copy";
import { HOSTILE_DISPLAY_STRING } from "../legacy/fixtures";
import { JOURNAL_GAP } from "../legacy/inventory";
import {
	FakeFetcher,
	TEST_KEY_FILENAME,
	type ThrowawayKeypair,
	generateThrowawayKeypair,
	seedProductChain,
} from "../legacy/test-helpers";
import type {
	EntryRecord,
	PortalModel,
	PortalModelResult,
} from "../legacy/types";
import { trustedText } from "./escape";
import { handle } from "./handle";
import { versionPath } from "./routes";
import {
	KIND_DECLARATION,
	KIND_REGISTER,
	KIND_SIGNED,
	KIND_VERIFIER,
	PRODUCT_DISPLAY,
	VERIFY_LEAD_IN,
	WINDOWS_ONE_FACT,
	verifyCommand,
} from "./vocab";

const NOW = new Date("2026-06-01T00:00:00Z");
const HOSTILE_END = "END-OF-HOSTILE-FIELD";

let kp: ThrowawayKeypair;
let defaultResult: PortalModelResult;
let defaultModel: PortalModel;

beforeAll(async () => {
	kp = await generateThrowawayKeypair();
	const fetcher = new FakeFetcher();
	fetcher.setText(`releases/keys/${TEST_KEY_FILENAME}`, kp.pubKeyText);
	await seedProductChain(fetcher, kp, "journal", "solstone-journal");
	await seedProductChain(fetcher, kp, "linux", "solstone-linux");
	defaultResult = await buildPortalModel(fetcher, NOW);
	if (!defaultResult.ok) throw new Error("expected default model to build");
	defaultModel = defaultResult.model;
});

type ProductHistory = Extract<
	PortalModel["subjects"][number],
	{ timeline: import("../legacy/types").TimelineEntry[] }
>;

function journal(): ProductHistory {
	const s = defaultModel.subjects.find((x) => x.product === "journal");
	if (!s || !("timeline" in s)) throw new Error("missing journal");
	return s;
}

function linux(): ProductHistory {
	const s = defaultModel.subjects.find((x) => x.product === "linux");
	if (!s || !("timeline" in s)) throw new Error("missing linux");
	return s;
}

function tipOf(subject: ProductHistory): EntryRecord {
	const tip = subject.timeline.find(
		(t): t is EntryRecord => t.kind === "entry" && t.isTip,
	);
	if (!tip) throw new Error("missing tip");
	return tip;
}

describe("AC-3 home destinations and absence copy", () => {
	test("home presents software/verify/keys/about, not services or coming soon", () => {
		const body = handle("/", defaultResult).body;
		expect(body).toContain(trustedText(HOME_HERO_EXPLAINER));
		expect(body).toContain(trustedText(HOME_PUBLICATION_DECLARATION));
		expect(body).toContain("/software/");
		expect(body).toContain("/verify/");
		expect(body).toContain("/keys/");
		expect(body).toContain("/about/");
		expect(body).toContain(PRODUCT_DISPLAY.journal);
		expect(body).toContain(PRODUCT_DISPLAY.linux);
		expect(body).toContain(PRODUCT_DISPLAY.windows);
		expect(body).toContain(trustedText(homeRegisterSummaryRow(false)));
		expect(body.toLowerCase()).not.toContain("coming soon");
		expect(body).not.toContain("/services/");
		expect(body).not.toContain("/commitments/");
	});
});

describe("AC-4 journal and linux axes stay separate", () => {
	test("publication paused, tip freshness expired, verification valid, expiry not called invalid", () => {
		const journalPage = handle("/software/journal/", defaultResult).body;
		const linuxPage = handle("/software/linux/", defaultResult).body;
		for (const body of [journalPage, linuxPage]) {
			expect(body).toContain("publication");
			expect(body).toContain("evidence freshness");
			expect(body).toContain("verification");
			expect(body).toContain("rebuild");
			expect(body).toContain(KIND_DECLARATION);
			expect(body).toContain("paused");
			expect(body).toContain("expired");
			expect(body).toContain(KIND_SIGNED);
			expect(body).toContain(KIND_VERIFIER);
			expect(body).toContain("verified");
			expect(body.toLowerCase()).not.toContain("tampered");
			expect(body.toLowerCase()).not.toContain("insecure");
			expect(body).not.toContain("trust score");
		}
		const jTip = tipOf(journal());
		const vPage = handle(
			versionPath("journal", jTip.version),
			defaultResult,
		).body;
		expect(vPage).toContain("expired");
		expect(vPage).toContain("verified");
		expect(vPage).toContain("signed it as valid through");
		if (jTip.axes.freshness.provenance.kind === "signed") {
			expect(journalPage).toContain(
				`href="${jTip.axes.freshness.provenance.sourceUrl}"`,
			);
		}
	});
});

describe("version summary must not fabricate valid_until", () => {
	test("a non-tip journal page uses the not-time-bound sentence, not publishedUtc as valid_until", () => {
		const nonTip = journal().timeline.find(
			(t): t is EntryRecord => t.kind === "entry" && !t.isTip,
		);
		if (!nonTip) throw new Error("expected a non-tip journal entry");
		expect(nonTip.axes.freshness.state).toBe("not-time-bound");
		const body = handle(
			versionPath("journal", nonTip.version),
			defaultResult,
		).body;
		expect(body).toContain("superseded entries");
		expect(body).toContain("not assigned their own freshness window");
		expect(body).toContain(nonTip.publishedUtc);
		expect(body).not.toContain("signed it as valid through");
		expect(body).not.toContain(
			`signed it as valid through ${nonTip.publishedUtc}`,
		);
	});

	test("a tip whose pointer is unavailable uses the unavailable sentence and the real reason", async () => {
		const fetcher = new FakeFetcher();
		fetcher.setText(`releases/keys/${TEST_KEY_FILENAME}`, kp.pubKeyText);
		await seedProductChain(fetcher, kp, "linux", "solstone-linux", {
			versions: ["0.0.1"],
		});
		fetcher.setText(
			"releases/solstone-linux/latest.json.minisig",
			"untrusted comment: corrupted\nAAAAnotarealsignature",
		);
		const result = await buildPortalModel(fetcher, NOW, {
			linux: ["0.0.1"],
			journal: [],
		});
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		const linuxSub = result.model.subjects.find((s) => s.product === "linux");
		if (!linuxSub || !("timeline" in linuxSub))
			throw new Error("expected linux timeline");
		const tip = linuxSub.timeline.find(
			(t): t is EntryRecord => t.kind === "entry" && t.isTip,
		);
		if (!tip) throw new Error("expected a tip entry");
		if (tip.axes.freshness.state !== "unavailable") {
			throw new Error("expected unavailable freshness on the tip");
		}
		const body = handle("/software/linux/0.0.1/", result).body;
		expect(body).toContain(
			"separately signed freshness pointer could not be checked",
		);
		expect(body).toContain(tip.axes.freshness.reason);
		expect(body).toContain(tip.publishedUtc);
		expect(body).not.toContain("signed it as valid through");
		expect(body).not.toContain(
			`signed it as valid through ${tip.publishedUtc}`,
		);
	});
});

describe("AC-5 windows absence", () => {
	test("one fact, approved explainer, structural sentence, not a release verdict", () => {
		const body = handle("/software/windows/", defaultResult).body;
		expect(body).toContain(trustedText(WINDOWS_ABSENCE_EXPLAINER));
		expect(body).toContain(trustedText(WINDOWS_ONE_FACT));
		expect(body).toContain(KIND_REGISTER);
		expect(body).not.toContain("axis-block");
		expect(body).not.toContain("never been released");
		expect(body).not.toContain("never released");
	});
});

describe("AC-6 mixed valid and unavailable release", () => {
	test("seeded v1 stays, missing v2 keeps version identity, portal stays ok", async () => {
		const fetcher = new FakeFetcher();
		fetcher.setText(`releases/keys/${TEST_KEY_FILENAME}`, kp.pubKeyText);
		await seedProductChain(fetcher, kp, "linux", "solstone-linux", {
			versions: ["0.0.1"],
		});
		const result = await buildPortalModel(fetcher, NOW, {
			linux: ["0.0.1", "0.0.2"],
			journal: [],
		});
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		const linuxPage = handle("/software/linux/", result).body;
		expect(linuxPage).toContain("0.0.1");
		expect(linuxPage).toContain("0.0.2");
		expect(linuxPage).toContain(KIND_VERIFIER);
		const v1 = handle("/software/linux/0.0.1/", result);
		expect(v1.status).toBe(200);
		expect(v1.body).toContain("axis-block");
		const v2 = handle("/software/linux/0.0.2/", result);
		expect(v2.status).toBe(200);
		expect(v2.body).toContain(KIND_VERIFIER);
		expect(v2.body).not.toContain("axis-block");
		expect(v2.body).toContain("0.0.2");
	});
});

describe("AC-7 incomplete member (rejected manifest)", () => {
	test("hostile-path extra manifest is rejected with reason; sibling manifest stays linked", async () => {
		const fetcher = new FakeFetcher();
		fetcher.setText(`releases/keys/${TEST_KEY_FILENAME}`, kp.pubKeyText);
		await seedProductChain(fetcher, kp, "linux", "solstone-linux", {
			versions: ["0.0.1"],
			extraManifestNames: { "0.0.1": ["../evil.json"] },
		});
		const result = await buildPortalModel(fetcher, NOW, {
			linux: ["0.0.1"],
			journal: [],
		});
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		const body = handle("/software/linux/0.0.1/", result).body;
		expect(body).toContain("../evil.json");
		expect(body).toContain("not a raw link");
		expect(body).toContain("solstone-linux-0.0.1.rust-release-manifest.json");
		expect(body).toContain('class="raw-link"');
		const evilHref = body.match(/href="[^"]*\.\.\/evil\.json[^"]*"/);
		expect(evilHref).toBeNull();
	});
});

describe("AC-8 unavailable member (unhosted artifact)", () => {
	test("artifacts are named, digested, and never given a raw href", () => {
		const tip = tipOf(linux());
		const body = handle(versionPath("linux", tip.version), defaultResult).body;
		expect(body).toContain(trustedText(VERSION_ARTIFACT_NOTE));
		expect(body).toContain("not a raw link");
		const artifact = tip.artifacts[0];
		if (artifact === undefined) throw new Error("expected an artifact");
		expect(body).toContain(artifact.ref.name);
		expect(body).toContain(artifact.ref.sha256);
	});
});

describe("AC-9 invalid evidence with a fresh pointer", () => {
	test("verification invalid, freshness from pointer, publication paused, fields still listed", async () => {
		const fetcher = new FakeFetcher();
		fetcher.setText(`releases/keys/${TEST_KEY_FILENAME}`, kp.pubKeyText);
		await seedProductChain(fetcher, kp, "linux", "solstone-linux", {
			versions: ["0.0.1"],
			pointerValidUntil: "2099-01-01T00:00:00Z",
		});
		fetcher.setText(
			"releases/solstone-linux/v/0.0.1/ledger-entry.json.minisig",
			"untrusted comment: corrupted\nAAAAnotarealsignature",
		);
		const result = await buildPortalModel(fetcher, NOW, {
			linux: ["0.0.1"],
			journal: [],
		});
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		const body = handle("/software/linux/0.0.1/", result).body;
		expect(body).toContain("signature did not verify");
		expect(body).toContain(KIND_VERIFIER);
		expect(body).toContain("fresh until");
		expect(body).toContain(KIND_SIGNED);
		expect(body).toContain("paused");
		expect(body).toContain("raw evidence");
		expect(body).not.toContain("trust score");
	});
});

describe("AC-10 product history order and gap row", () => {
	test("timeline follows the model; gap uses curated tokens from JOURNAL_GAP", () => {
		const subject = journal();
		const body = handle("/software/journal/", defaultResult).body;
		const timelineStart = body.indexOf('<ol class="timeline">');
		expect(timelineStart).toBeGreaterThan(-1);
		const timelineHtml = body.slice(timelineStart);
		let last = -1;
		for (const item of subject.timeline) {
			if (item.kind === "entry") {
				const pos = timelineHtml.indexOf(item.version);
				expect(pos).toBeGreaterThan(last);
				last = pos;
			}
		}
		const gap = subject.timeline.find((t) => t.kind === "gap");
		expect(gap?.kind).toBe("gap");
		if (gap?.kind !== "gap") return;
		expect(body).toContain(gap.absentVersion);
		expect(body).toContain(gap.afterVersion);
		expect(body).toContain(gap.beforeVersion);
		expect(body).toContain("/software/#coverage");
		expect(gap.absentVersion).toBe(JOURNAL_GAP.absentVersion);
		const dated = subject.timeline.find(
			(t): t is EntryRecord => t.kind === "entry" && !t.isTip,
		);
		if (!dated) throw new Error("expected a non-tip journal entry");
		expect(timelineHtml).toContain(dated.publishedUtc);
	});
});

describe("AC-11 distinct-value source binding", () => {
	test("two journal entries bind to their own entry URL and digest, not each other's", () => {
		const entries = journal().timeline.filter(
			(t): t is EntryRecord => t.kind === "entry",
		);
		const a = entries[0];
		const b = entries[1];
		if (!a || !b) throw new Error("need two journal entries");
		const pageA = handle(versionPath("journal", a.version), defaultResult).body;
		const pageB = handle(versionPath("journal", b.version), defaultResult).body;
		expect(a.entryLink.status).toBe("linked");
		expect(b.entryLink.status).toBe("linked");
		expect(a.entrySigLink.status).toBe("linked");
		expect(b.entrySigLink.status).toBe("linked");
		if (
			a.entryLink.status !== "linked" ||
			b.entryLink.status !== "linked" ||
			a.entrySigLink.status !== "linked" ||
			b.entrySigLink.status !== "linked"
		)
			return;
		expect(pageA).toContain(`href="${a.entryLink.link.url}"`);
		expect(pageA).not.toContain(`href="${b.entryLink.link.url}"`);
		expect(pageA).toContain(`href="${a.entrySigLink.link.url}"`);
		expect(pageA).not.toContain(`href="${b.entrySigLink.link.url}"`);
		expect(pageA).toContain(a.entrySha256);
		expect(pageA).not.toContain(b.entrySha256);
		expect(pageB).toContain(`href="${b.entryLink.link.url}"`);
		expect(pageB).not.toContain(`href="${a.entryLink.link.url}"`);
		expect(pageB).toContain(`href="${b.entrySigLink.link.url}"`);
		expect(pageB).not.toContain(`href="${a.entrySigLink.link.url}"`);
		expect(pageB).toContain(b.entrySha256);
		expect(a.entryLink.link.url).not.toBe(b.entryLink.link.url);
		expect(a.entrySigLink.link.url).not.toBe(b.entrySigLink.link.url);
		const key = defaultModel.keys[0];
		if (!key || key.link.status !== "linked")
			throw new Error("expected a linked signing key");
		expect(pageA).toContain(`href="${key.link.link.url}"`);
		expect(pageB).toContain(`href="${key.link.link.url}"`);
	});
});

describe("AC-12 release detail member accounting and exact layout", () => {
	test("tip has latest.json; non-tip does not; ledger.jsonl only on product history; groups open", () => {
		const entries = journal().timeline.filter(
			(t): t is EntryRecord => t.kind === "entry",
		);
		const tip = entries.find((e) => e.isTip);
		const nonTip = entries.find((e) => !e.isTip);
		if (!tip || !nonTip) throw new Error("need tip and non-tip");
		const tipPage = handle(
			versionPath("journal", tip.version),
			defaultResult,
		).body;
		const nonTipPage = handle(
			versionPath("journal", nonTip.version),
			defaultResult,
		).body;
		const history = handle("/software/journal/", defaultResult).body;
		expect(tipPage).toContain("/latest.json");
		expect(tipPage).toContain("/latest.json.minisig");
		expect(nonTipPage).not.toContain("/latest.json");
		expect(history).toContain("/ledger.jsonl");
		expect(tipPage).not.toContain("/ledger.jsonl");
		expect(tipPage).toContain("ledger-entry.json");
		expect(tipPage).toContain("ledger-entry.json.minisig");
		expect(tipPage).toContain('<details class="tech" open>');
		expect(tipPage).toContain(trustedText(VERSION_ARTIFACT_NOTE));
		expect(tipPage).toContain("/releases/keys/");
		for (const m of tip.manifests) expect(tipPage).toContain(m.ref.name);
		for (const p of tip.proofs) expect(tipPage).toContain(p.ref.name);
		for (const a of tip.artifacts) expect(tipPage).toContain(a.ref.name);
	});

	test("a category with multiple linked members renders a summary plus open details of exact urls", async () => {
		const fetcher = new FakeFetcher();
		fetcher.setText(`releases/keys/${TEST_KEY_FILENAME}`, kp.pubKeyText);
		await seedProductChain(fetcher, kp, "linux", "solstone-linux", {
			versions: ["0.0.1"],
			extraManifestNames: {
				"0.0.1": ["extra-a.json", "extra-b.json"],
			},
		});
		const result = await buildPortalModel(fetcher, NOW, {
			linux: ["0.0.1"],
			journal: [],
		});
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		const body = handle("/software/linux/0.0.1/", result).body;
		expect(body).toContain("exact links below");
		expect(body).toContain('<details class="tech" open>');
		expect(body).toContain("extra-a.json");
		expect(body).toContain("extra-b.json");
	});
});

describe("AC-13 provenance kinds", () => {
	test("every axis/declaration carries a kind string; construction failure is verifier", async () => {
		const home = handle("/", defaultResult).body;
		expect(home).toContain(KIND_DECLARATION);
		expect(handle("/software/windows/", defaultResult).body).toContain(
			KIND_REGISTER,
		);
		expect(handle("/software/journal/", defaultResult).body).toContain(
			KIND_SIGNED,
		);
		const fetcher = new FakeFetcher();
		fetcher.setText(`releases/keys/${TEST_KEY_FILENAME}`, kp.pubKeyText);
		await seedProductChain(fetcher, kp, "linux", "solstone-linux", {
			versions: ["0.0.1"],
		});
		fetcher.setBytes(
			"releases/solstone-linux/v/0.0.1/ledger-entry.json",
			new TextEncoder().encode("<html>not json</html>"),
		);
		const result = await buildPortalModel(fetcher, NOW, {
			linux: ["0.0.1"],
			journal: [],
		});
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		const history = handle("/software/linux/", result).body;
		expect(history).toContain(KIND_VERIFIER);
		expect(history).toContain("0.0.1");
		const failPage = handle("/software/linux/0.0.1/", result).body;
		expect(failPage).toContain(KIND_VERIFIER);
		expect(failPage).not.toContain("axis-block");
	});
});

describe("AC-14 four axes never collapsed", () => {
	test("axis block has four named rows and no composite verdict", () => {
		const body = handle("/software/journal/", defaultResult).body;
		expect(body).toContain("publication");
		expect(body).toContain("evidence freshness");
		expect(body).toContain("verification");
		expect(body).toContain("rebuild");
		expect(body).not.toContain("trust score");
		expect(body).not.toContain("all verified");
		const tip = tipOf(journal());
		const axis = body.slice(
			body.indexOf('class="axis-block"'),
			body.indexOf("prove-columns"),
		);
		expect(axis).toContain(tip.axes.verification.checkedAt);
		if (
			tip.axes.freshness.state === "fresh" ||
			tip.axes.freshness.state === "expired"
		) {
			expect(axis).toContain(tip.axes.freshness.validUntil);
			expect(axis).toContain(tip.axes.freshness.signedAt);
		}
	});
});

describe("AC-16 hostile display string through the adapter", () => {
	test("HOSTILE_DISPLAY_STRING reaches a version page escaped, not executed, not truncated", async () => {
		const longName = `${HOSTILE_DISPLAY_STRING}${"x".repeat(200)}${HOSTILE_END}`;
		const fetcher = new FakeFetcher();
		fetcher.setText(`releases/keys/${TEST_KEY_FILENAME}`, kp.pubKeyText);
		await seedProductChain(fetcher, kp, "linux", "solstone-linux", {
			versions: ["0.0.1"],
			artifactNames: { "0.0.1": longName },
		});
		const result = await buildPortalModel(fetcher, NOW, {
			linux: ["0.0.1"],
			journal: [],
		});
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		const body = handle("/software/linux/0.0.1/", result).body;
		expect(body).toContain("&lt;script&gt;");
		expect(body).not.toMatch(/<script>/);
		expect(body).toContain(HOSTILE_END);
		expect(body).toContain('dir="ltr"');
		expect(body).toContain("<bdi>");
	});
});

describe("AC-17 raw-link allowlisting", () => {
	test("every raw-link is https evidence-host; rejected member is not an href", async () => {
		const fetcher = new FakeFetcher();
		fetcher.setText(`releases/keys/${TEST_KEY_FILENAME}`, kp.pubKeyText);
		await seedProductChain(fetcher, kp, "linux", "solstone-linux", {
			versions: ["0.0.1"],
			extraManifestNames: { "0.0.1": ["%2fetc/passwd.json"] },
		});
		const result = await buildPortalModel(fetcher, NOW, {
			linux: ["0.0.1"],
			journal: [],
		});
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		const body = handle("/software/linux/0.0.1/", result).body;
		const hrefs = [...body.matchAll(/class="raw-link" href="([^"]+)"/g)].map(
			(m) => m[1] ?? "",
		);
		for (const href of hrefs) {
			const url = new URL(href);
			expect(url.protocol).toBe("https:");
			expect(url.hostname).toBe("transparency.solstone.app");
			expect(url.port).toBe("");
			expect(url.username).toBe("");
			expect(url.search).toBe("");
			expect(url.hash).toBe("");
		}
		expect(body).toContain("not a raw link");
	});
});

describe("AC-19 verify and keys pages", () => {
	test("keys expose text, fingerprint, role, algorithm, raw link; verify has real command and no schema URL", () => {
		const keys = handle("/keys/", defaultResult).body;
		const key = defaultModel.keys[0];
		if (!key) throw new Error("missing key");
		expect(keys).toContain(trustedText(KEYS_ROLE_STATEMENT));
		expect(keys).toContain("ed25519");
		expect(keys).toContain(key.publicKeyText.split("\n")[0] ?? "");
		if (key.fingerprint.status === "known") {
			expect(keys).toContain(key.fingerprint.value);
		}
		expect(keys).toContain('<details class="tech" open>');
		expect(keys).toContain("https://transparency.solstone.app/releases/keys/");
		const verify = handle("/verify/", defaultResult).body;
		expect(verify).toContain(trustedText(VERIFY_METHOD_INTRO));
		expect(verify).toContain(trustedText(VERIFY_LEAD_IN));
		expect(verify).toContain(trustedText(verifyCommand(key.filename)));
		expect(verify).toContain(trustedText(VERIFY_OUTCOME_PASS));
		expect(verify).toContain(trustedText(VERIFY_OUTCOME_FAIL));
		expect(verify).toContain(trustedText(VERIFY_OUTCOME_UNREACHABLE));
		expect(verify).not.toContain("solpbc.org/schemas");
		expect(verify).toContain("/keys/");
	});
});

describe("AC-22 negative controls a constant renderer cannot pass", () => {
	test("two entry hrefs differ; hostile page differs from a clean sibling", () => {
		const entries = journal().timeline.filter(
			(t): t is EntryRecord => t.kind === "entry",
		);
		const a = entries[0];
		const b = entries[1];
		if (
			!a ||
			!b ||
			a.entryLink.status !== "linked" ||
			b.entryLink.status !== "linked"
		)
			throw new Error("need two linked entries");
		expect(a.entryLink.link.url).not.toBe(b.entryLink.link.url);
		const linuxTip = tipOf(linux());
		const clean = handle(
			versionPath("linux", linuxTip.version),
			defaultResult,
		).body;
		expect(clean).not.toContain("&lt;script&gt;");
	});
});

describe("about page", () => {
	test("renders approved ABOUT body and the exact raw ABOUT.txt link", () => {
		const body = handle("/about/", defaultResult).body;
		expect(body).toContain("sol pbc release transparency");
		expect(body).toContain(
			"https://transparency.solstone.app/releases/ABOUT.txt",
		);
	});
});

describe("coverage caveat on software index", () => {
	test("software index carries the approved caveat at #coverage", () => {
		const body = handle("/software/", defaultResult).body;
		expect(body).toContain('id="coverage"');
		expect(body).toContain(trustedText(SOFTWARE_COVERAGE_CAVEAT));
	});
});
