// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { open } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import {
	type ComponentState,
	type ComponentTransition,
	RELEASE_RECORD_SCHEMA,
	type ReleaseArtifact,
	type ReleaseComponent,
	type ReleaseRecordPredicate,
	parseComponentTransitions,
	parseManifestComponents,
	validReleaseVersion,
	validateReleaseRecordPredicate,
} from "./records/release-record";
import { admitTufJson } from "./tuf/admission";
import type { TufJsonValue } from "./tuf/outcome";

export type JournalLane = "release" | "staging" | "dev";
export type JournalClaims = Pick<
	ReleaseRecordPredicate,
	"_comment" | "does_prove" | "does_not_prove"
>;

export interface JournalAdapterInput {
	manifestPath: string;
	version: string;
	lane: JournalLane;
	claims: JournalClaims;
}

export type JournalSetInput = Omit<JournalAdapterInput, "manifestPath"> & {
	manifestPaths: readonly string[];
	/**
	 * Components files, at most one per target, each naming a target whose
	 * manifest is supplied and whose manifest has no components key.
	 */
	componentsPaths?: readonly string[];
};

interface AdaptedSet {
	/** The record without component fields. */
	predicate: ReleaseRecordPredicate;
	/** Sorted targets with a components list from their manifest or a components file; undefined when none has. */
	componentTargets?: string[];
	/** Rows of those targets, sorted by target then id. */
	components?: ReleaseComponent[];
}

async function adaptSet(input: JournalSetInput): Promise<AdaptedSet> {
	if (input.manifestPaths.length === 0) {
		refuse(
			"missing-manifest",
			"Supply at least one journal producer manifest.",
		);
	}
	let combined: ReleaseRecordPredicate | undefined;
	const artifacts = new Map<string, ReleaseArtifact>();
	// A target with no components list, from its manifest or a components
	// file, is left out of componentTargets: the record makes no component
	// statement for it.
	const manifestTargets = new Set<string>();
	const listed = new Map<string, ReleaseComponent[]>();
	for (const manifestPath of input.manifestPaths) {
		const adapted = await adaptTarget({ ...input, manifestPath });
		const release = adapted.predicate;
		manifestTargets.add(adapted.target);
		if (adapted.components !== undefined)
			listed.set(adapted.target, adapted.components);
		for (const artifact of release.artifacts) {
			const previous = artifacts.get(artifact.url);
			if (previous !== undefined) {
				const sharedInstaller = artifact.url.endsWith(
					`/solstone-journal-${input.version}-install.sh`,
				);
				if (
					sharedInstaller &&
					previous.length === artifact.length &&
					previous.sha256 === artifact.sha256
				) {
					continue;
				}
				refuse(
					"duplicate-target",
					"Supply each journal target manifest once, with byte-identical shared installer declarations.",
				);
			}
			artifacts.set(artifact.url, artifact);
		}
		combined ??= release;
	}
	if (combined === undefined)
		refuse(
			"missing-manifest",
			"Supply at least one journal producer manifest.",
		);
	for (const path of input.componentsPaths ?? []) {
		const file = await readComponentsFile(path, input.version);
		if (!manifestTargets.has(file.target)) {
			refuse(
				"components-target-mismatch",
				`The components file for ${file.target} names a target with no supplied manifest. Supply that target's manifest, or leave out its components file.`,
			);
		}
		if (listed.has(file.target)) {
			refuse(
				"duplicate-components-source",
				`Target ${file.target} has components from more than one source. Supply them once, in its manifest or in one components file.`,
			);
		}
		listed.set(file.target, file.components);
	}
	const componentTargets =
		listed.size === 0 ? undefined : [...listed.keys()].sort(compareText);
	const components = [...listed.values()].flat();
	return {
		predicate: {
			...combined,
			artifacts: [...artifacts.values()].sort((left, right) =>
				compareText(left.url, right.url),
			),
		},
		...(componentTargets === undefined
			? {}
			: {
					componentTargets: componentTargets.sort(compareText),
					components: components.sort(compareComponentKey),
				}),
	};
}

/**
 * Reads a components file: a JSON object with exactly product, version,
 * target and components, where components follows the manifest rules.
 */
async function readComponentsFile(
	path: string,
	version: string,
): Promise<{ target: string; components: ReleaseComponent[] }> {
	let bytes: Buffer;
	try {
		bytes = (await measure(path, true)).bytes;
	} catch {
		refuse(
			"invalid-components-file",
			"Could not read a components file. Supply each as a regular file smaller than 1 MiB.",
		);
	}
	const admitted = admitTufJson(bytes);
	if (
		!admitted.ok ||
		!object(admitted.value) ||
		Object.keys(admitted.value).sort().join("\u0000") !==
			["components", "product", "target", "version"].join("\u0000") ||
		typeof admitted.value.target !== "string"
	) {
		refuse(
			"invalid-components-file",
			"Supply each components file as a JSON object with exactly product, version, target and components, with unique member names.",
		);
	}
	const body = admitted.value;
	const target = admitted.value.target;
	if (body.product !== "solstone-journal" || body.version !== version) {
		refuse(
			"components-release-mismatch",
			"Supply components files for solstone-journal at the requested version.",
		);
	}
	const parsed = parseManifestComponents(body.components, target);
	if (!parsed.ok) {
		refuse(
			"invalid-components",
			`The components list for ${target} is malformed at ${parsed.detail.path.join(".")}: expected ${String(parsed.detail.expected)}.`,
		);
	}
	return { target, components: parsed.value };
}

function compareText(left: string, right: string): number {
	return left < right ? -1 : left > right ? 1 : 0;
}

function compareComponentKey(
	left: { target: string; id: string },
	right: { target: string; id: string },
): number {
	return (
		compareText(left.target, right.target) || compareText(left.id, right.id)
	);
}

export class JournalAdapterError extends Error {
	constructor(
		readonly reason: string,
		message: string,
	) {
		super(message);
		this.name = "JournalAdapterError";
	}
}

function refuse(reason: string, message: string): never {
	throw new JournalAdapterError(reason, message);
}

function object(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

// Hash the same open file whose bytes are counted; large archives stay streamed.
async function measure(path: string, capture = false) {
	const file = await open(
		path,
		constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
	);
	try {
		if (!(await file.stat()).isFile()) {
			refuse(
				"not-regular-file",
				"Use regular artifact files without symlinks.",
			);
		}
		const hash = createHash("sha256");
		let length = 0;
		const chunks: Buffer[] = [];
		for await (const chunk of file.createReadStream({ autoClose: false })) {
			const bytes = Buffer.from(chunk);
			length += bytes.length;
			if (!Number.isSafeInteger(length) || (capture && length > 1024 * 1024)) {
				refuse(
					"input-too-large",
					"Supply a manifest or sidecar smaller than 1 MiB.",
				);
			}
			hash.update(bytes);
			if (capture) chunks.push(bytes);
		}
		return { length, sha256: hash.digest("hex"), bytes: Buffer.concat(chunks) };
	} finally {
		await file.close();
	}
}

/**
 * Measures the local producer output of one target. Signing authority and
 * remote publication are separate checks. A manifest that lists components
 * also needs the previous release's record; see prepareJournalReleaseRecord.
 */
export async function adaptJournalRelease(
	input: JournalAdapterInput &
		Pick<
			JournalRecordInput,
			"componentsPaths" | "transitions" | "previousRecord"
		>,
): Promise<ReleaseRecordPredicate> {
	const { manifestPath, ...rest } = input;
	return prepareJournalReleaseRecord({
		...rest,
		manifestPaths: [manifestPath],
	});
}

interface AdaptedTarget {
	/** The target's record without component fields. */
	predicate: ReleaseRecordPredicate;
	target: string;
	/** Present when the manifest has a components key. */
	components?: ReleaseComponent[];
}

async function adaptTarget(input: JournalAdapterInput): Promise<AdaptedTarget> {
	try {
		return await adapt(input);
	} catch (error) {
		if (error instanceof JournalAdapterError) throw error;
		refuse(
			"artifact-read-failed",
			"Could not read the release set. Supply the complete local producer output as regular files.",
		);
	}
}

async function adapt(input: JournalAdapterInput): Promise<AdaptedTarget> {
	if (!validReleaseVersion(input.version)) {
		refuse(
			"unsafe-version",
			"Supply a version containing only letters, digits, dots, underscores, and hyphens.",
		);
	}
	if (!["release", "staging", "dev"].includes(input.lane)) {
		refuse("invalid-lane", "Choose release, staging, or dev.");
	}
	const manifest = await measure(input.manifestPath, true);
	const admitted = admitTufJson(manifest.bytes);
	if (!admitted.ok || !object(admitted.value)) {
		refuse(
			"invalid-manifest",
			"Supply the producer's JSON manifest with unique member names.",
		);
	}
	const body = admitted.value;
	const keys = Object.keys(body).sort().join("\u0000");
	if (
		(keys !== ["files", "product", "target", "version"].join("\u0000") &&
			keys !==
				["components", "files", "product", "target", "version"].join(
					"\u0000",
				)) ||
		body.product !== "solstone-journal" ||
		body.version !== input.version ||
		typeof body.target !== "string" ||
		!object(body.files)
	) {
		refuse(
			"manifest-identity-mismatch",
			"Supply a solstone-journal manifest matching the requested version and producer schema.",
		);
	}
	const base = `solstone-journal-${input.version}-${body.target}`;
	const windows = body.target === "windows-x86_64";
	// Windows keeps its existing origin prefix, where its versioned containers
	// already sit beside its update feed. It has no release declaration; its
	// checksum file names exactly the Setup and the full package.
	const expectedNames = (
		body.target === "macos-arm64"
			? ["tar.gz", "release", "signing.json", "sha256"].map(
					(extension) => `${base}.${extension}`,
				)
			: ["linux-x86_64", "linux-aarch64"].includes(body.target)
				? ["tar.gz", "deb", "rpm", "release", "sha256"].map(
						(extension) => `${base}.${extension}`,
					)
				: windows
					? [
							`${base}-setup.exe`,
							`SolstoneJournal-${input.version}-full.nupkg`,
							`${base}.sha256`,
						]
					: undefined
	)?.sort();
	if (expectedNames === undefined) {
		refuse(
			"unsupported-target",
			"Supply a Linux, macOS, or Windows x86_64 journal producer manifest.",
		);
	}
	if (windows && input.lane !== "release") {
		refuse(
			"unsupported-lane",
			"Windows journal evidence exists only for the release lane.",
		);
	}
	let components: ReleaseComponent[] | undefined;
	if (body.components !== undefined) {
		const parsed = parseManifestComponents(body.components, body.target);
		if (!parsed.ok) {
			refuse(
				"invalid-components",
				`The manifest's components list is malformed at ${parsed.detail.path.join(".")}: expected ${String(parsed.detail.expected)}.`,
			);
		}
		components = parsed.value;
	}
	const manifestName = `${base}.manifest.json`;
	if (basename(input.manifestPath) !== manifestName) {
		refuse(
			"manifest-filename-mismatch",
			"Keep the manifest filename emitted by the producer for this version and target.",
		);
	}
	const files = body.files;
	const names = Object.keys(files).sort();
	const expectedWithInstaller = windows
		? expectedNames
		: [...expectedNames, `solstone-journal-${input.version}-install.sh`].sort();
	if (
		JSON.stringify(names) !== JSON.stringify(expectedNames) &&
		JSON.stringify(names) !== JSON.stringify(expectedWithInstaller)
	) {
		refuse(
			"artifact-set-mismatch",
			"Supply exactly the manifest members emitted for this target, without renamed, missing, or extra members.",
		);
	}
	const urlBase = windows
		? "https://updates.solstone.app/solstone-journal/release/windows/"
		: `https://updates.solstone.app/solstone-journal/${input.lane}/${input.version}/`;
	const artifacts: ReleaseArtifact[] = [];
	let releaseBytes: Buffer | undefined;
	let checksumBytes: Buffer | undefined;
	for (const name of names) {
		const expectedHash = files[name];
		if (
			typeof expectedHash !== "string" ||
			!/^[0-9a-f]{64}$/.test(expectedHash)
		) {
			refuse(
				"invalid-artifact-hash",
				"Supply lowercase SHA256 hashes from the producer manifest.",
			);
		}
		const capture = name.endsWith(".release") || name.endsWith(".sha256");
		const artifact = await measure(
			join(dirname(input.manifestPath), name),
			capture,
		);
		if (artifact.sha256 !== expectedHash) {
			refuse(
				"artifact-hash-mismatch",
				`Artifact ${name} differs from its manifest. Restore the matching producer output before preparing evidence.`,
			);
		}
		if (name.endsWith(".release")) releaseBytes = artifact.bytes;
		if (name.endsWith(".sha256")) checksumBytes = artifact.bytes;
		artifacts.push({
			url: urlBase + name,
			length: artifact.length,
			sha256: artifact.sha256,
		});
	}
	const releaseFields = new Map<string, string>();
	for (const line of releaseBytes?.toString("utf8").trimEnd().split("\n") ??
		[]) {
		const separator = line.indexOf("=");
		const key = line.slice(0, separator);
		if (separator < 1 || releaseFields.has(key)) {
			refuse(
				"release-declaration-mismatch",
				"Supply the producer's release declaration with unique fields.",
			);
		}
		releaseFields.set(key, line.slice(separator + 1));
	}
	for (const key of windows ? [] : ["product", "version", "target"]) {
		if (releaseFields.get(key) !== body[key]) {
			refuse(
				"release-declaration-mismatch",
				"The release declaration and manifest must identify the same product, version, and target.",
			);
		}
	}
	const checksumLines = checksumBytes
		?.toString("utf8")
		.trimEnd()
		.split("\n")
		.sort();
	const expectedLines = names
		.filter((name) => name !== `${base}.sha256`)
		.map((name) => `${files[name]}  ${name}`)
		.sort();
	if (JSON.stringify(checksumLines) !== JSON.stringify(expectedLines)) {
		refuse(
			"checksum-sidecar-mismatch",
			"Supply the checksum sidecar matching the manifest members.",
		);
	}
	artifacts.push({
		url: urlBase + manifestName,
		length: manifest.length,
		sha256: manifest.sha256,
	});
	artifacts.sort((left, right) =>
		left.url < right.url ? -1 : left.url > right.url ? 1 : 0,
	);
	const candidate = {
		...input.claims,
		schema: RELEASE_RECORD_SCHEMA,
		product: "journal",
		version: input.version,
		artifacts,
	};
	const validated = await validateReleaseRecordPredicate(
		candidate as unknown as TufJsonValue,
	);
	if (!validated.ok) {
		refuse(
			"invalid-release-claims",
			"Supply _comment, does_prove, and does_not_prove arrays using the release's approved claim text.",
		);
	}
	return {
		predicate: validated.value,
		target: body.target,
		...(components === undefined ? {} : { components }),
	};
}

export interface JournalRecordInput extends JournalSetInput {
	/** Parsed JSON: the publisher's declared component transitions. */
	transitions?: unknown;
	/**
	 * Parsed JSON: the previous release's record predicate, or an earlier
	 * output of this preparation step whose `releasePredicate` member is one.
	 * Required when any components are listed, from a manifest or a
	 * components file.
	 */
	previousRecord?: unknown;
}

/**
 * Builds the release-record predicate for a journal release set. When any
 * components are listed, in a supplied manifest or a components file, the
 * record carries the inventory, the targets it covers, the previous record's
 * version as its baseline, and any declared transitions, which must equal the
 * delivery changes between the previous record and this one when the
 * previous record lists components.
 */
export async function prepareJournalReleaseRecord(
	input: JournalRecordInput,
): Promise<ReleaseRecordPredicate> {
	const set = await adaptSet(input);
	const { predicate } = set;
	if (set.componentTargets === undefined || set.components === undefined) {
		if (input.transitions !== undefined) {
			refuse(
				"transitions-without-components",
				"Component transitions can be declared only when components are listed, in a supplied manifest or a components file.",
			);
		}
		if (input.previousRecord !== undefined)
			await previousPredicate(input.previousRecord, predicate);
		return predicate;
	}
	if (input.previousRecord === undefined) {
		refuse(
			"missing-previous-record",
			"Supply --previous-record when components are listed, so declared transitions are compared with the previous release.",
		);
	}
	const previous = await previousPredicate(input.previousRecord, predicate);
	let transitions: ComponentTransition[] | undefined;
	if (input.transitions !== undefined) {
		const parsed = parseComponentTransitions(
			input.transitions,
			set.components,
			set.componentTargets,
		);
		if (!parsed.ok) {
			refuse(
				"invalid-transitions",
				`The declared transitions are malformed at ${parsed.detail.path.join(".")}: expected ${String(parsed.detail.expected)}.`,
			);
		}
		transitions = parsed.value;
	}
	const candidate: ReleaseRecordPredicate = {
		...predicate,
		component_targets: set.componentTargets,
		components: set.components,
		component_baseline: previous.version,
		...(transitions === undefined
			? {}
			: { component_transitions: transitions }),
	};
	// A previous record without components, as before the first release to
	// list them, is the baseline but is not compared.
	const changes = componentDeliveryChanges(previous, candidate);
	if (
		previous.components !== undefined &&
		JSON.stringify(changes) !== JSON.stringify(transitions ?? [])
	) {
		refuse(
			"undeclared-component-transitions",
			`The declared transitions must equal the component delivery changes since the previous record: ${JSON.stringify(changes)}.`,
		);
	}
	const validated = await validateReleaseRecordPredicate(
		candidate as unknown as TufJsonValue,
	);
	if (!validated.ok) {
		refuse(
			"invalid-components",
			`The component inventory is malformed at ${validated.detail.path.join(".")}: expected ${String(validated.detail.expected)}.`,
		);
	}
	return validated.value;
}

async function previousPredicate(
	value: unknown,
	next: ReleaseRecordPredicate,
): Promise<ReleaseRecordPredicate> {
	// A predicate has a schema member; an earlier output of this preparation
	// step wraps one in releasePredicate. An object with both is ambiguous.
	const hasSchema = object(value) && Object.hasOwn(value, "schema");
	const hasWrapper = object(value) && Object.hasOwn(value, "releasePredicate");
	const validated =
		hasSchema && hasWrapper
			? undefined
			: await validateReleaseRecordPredicate(
					(hasWrapper
						? (value as Record<string, unknown>).releasePredicate
						: value) as TufJsonValue,
				);
	if (validated === undefined || !validated.ok) {
		refuse(
			"invalid-previous-record",
			"Supply the previous release-record predicate, or the earlier output of this command containing it as releasePredicate.",
		);
	}
	if (!validReleaseVersion(validated.value.version)) {
		refuse(
			"invalid-previous-record",
			"The previous record's version must contain only letters, digits, dots, underscores, and hyphens.",
		);
	}
	if (validated.value.product !== next.product) {
		refuse(
			"previous-record-mismatch",
			"Supply a previous record for the same product.",
		);
	}
	if (validated.value.version === next.version) {
		refuse(
			"previous-record-same-version",
			"Supply the record of a previous release, not one for the version being prepared.",
		);
	}
	return validated.value;
}

/**
 * Lists, sorted by (target, id), every component whose delivery differs
 * between two records, over the targets in both records' component_targets.
 * A component a record does not list is `absent` in that record. A record
 * without a `component_targets` member contributes no targets, so nothing is
 * compared; an empty `components` array on a listed target is compared.
 */
export function componentDeliveryChanges(
	previous: ReleaseRecordPredicate,
	next: ReleaseRecordPredicate,
): ComponentTransition[] {
	const nextTargets = new Set(next.component_targets ?? []);
	const scope = new Set(
		(previous.component_targets ?? []).filter((target) =>
			nextTargets.has(target),
		),
	);
	const states = new Map<
		string,
		{ target: string; id: string; from: ComponentState; to: ComponentState }
	>();
	const entry = (row: ReleaseComponent) => {
		const key = `${row.target}\u0000${row.id}`;
		let state = states.get(key);
		if (state === undefined) {
			state = { target: row.target, id: row.id, from: "absent", to: "absent" };
			states.set(key, state);
		}
		return state;
	};
	for (const row of previous.components ?? [])
		if (scope.has(row.target)) entry(row).from = row.delivery;
	for (const row of next.components ?? [])
		if (scope.has(row.target)) entry(row).to = row.delivery;
	return [...states.values()]
		.filter((state) => state.from !== state.to)
		.sort(compareComponentKey);
}
