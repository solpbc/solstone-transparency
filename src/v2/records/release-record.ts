// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

/**
 * Release-record predicate admission and validation.
 * Represents sol pbc's assertion of built release artifacts for a product version.
 */

import {
	type TufFailure,
	type TufJsonValue,
	type TufResult,
	rejection,
} from "../tuf/outcome";

export const RELEASE_RECORD_SCHEMA = "solstone-transparency/release-record/v1";

export interface ReleaseArtifact {
	url: string;
	length: number;
	sha256: string;
}

/** How a component reaches an installation of one release target. */
export type ComponentDelivery = "bundled" | "runtime-downloaded";
/** A component's delivery in one release, or `absent` when that release lists no such component. */
export type ComponentState = ComponentDelivery | "absent";

export interface ComponentInput {
	name: string;
	sha256: string;
}

export interface ComponentMember {
	path: string;
	sha256: string;
}

/** One component of one release target, as listed by that target's producer manifest. */
export interface ReleaseComponent {
	target: string;
	id: string;
	version: string;
	delivery: ComponentDelivery;
	source: string;
	inputs: readonly ComponentInput[];
	members: readonly ComponentMember[];
}

/** The publisher's declaration that a component's delivery changed since the previous release. */
export interface ComponentTransition {
	target: string;
	id: string;
	from: ComponentState;
	to: ComponentState;
}

export interface ReleaseRecordPredicate {
	_comment: readonly string[];
	schema: typeof RELEASE_RECORD_SCHEMA;
	product: string;
	version: string;
	artifacts: readonly ReleaseArtifact[];
	/**
	 * The targets this record makes a component statement for. Present if and
	 * only if `components` is; a target not listed here has no statement.
	 */
	component_targets?: readonly string[];
	/** Absent when the record makes no statement about components. */
	components?: readonly ReleaseComponent[];
	/** The version of the previous record the transitions were compared against. Present if and only if `components` is. */
	component_baseline?: string;
	/** Present only alongside `components`. */
	component_transitions?: readonly ComponentTransition[];
	does_prove: readonly string[];
	does_not_prove: readonly string[];
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
): TufFailure<"malformed"> {
	return rejection("malformed", { path, expected, observed });
}

function validHash(value: unknown): value is string {
	return typeof value === "string" && /^[0-9a-f]{64}$/.test(value);
}

function validCount(value: unknown): value is number {
	return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function parseArtifact(
	value: unknown,
	index: number,
): TufResult<ReleaseArtifact> {
	const path = ["artifacts", String(index)];
	if (
		!isRecord(value) ||
		typeof value.url !== "string" ||
		value.url === "" ||
		!validCount(value.length) ||
		!validHash(value.sha256)
	) {
		return malformed(
			path,
			"an artifact with non-empty url, non-negative length, and 64-character lowercase hex sha256",
			value,
		);
	}
	return {
		ok: true,
		value: { url: value.url, length: value.length, sha256: value.sha256 },
	};
}

const COMPONENT_NAME = /^[a-z0-9][a-z0-9._-]*$/;
const DELIVERIES: readonly string[] = ["bundled", "runtime-downloaded"];
const STATES: readonly string[] = [...DELIVERIES, "absent"];
const MEMBER_ROOTS: readonly string[] = ["bin", "lib", "share"];

function exactKeys(
	value: Record<string, unknown>,
	keys: readonly string[],
): boolean {
	const present = Object.keys(value);
	return (
		present.length === keys.length &&
		keys.every((key) => Object.hasOwn(value, key))
	);
}

function nonEmptyString(value: unknown): value is string {
	return typeof value === "string" && value !== "";
}

/** Code-unit order, the same order used for artifact URLs. */
function compare(left: string, right: string): number {
	return left < right ? -1 : left > right ? 1 : 0;
}

function compareKey(
	left: { target: string; id: string },
	right: { target: string; id: string },
): number {
	return compare(left.target, right.target) || compare(left.id, right.id);
}

/** A release version: letters, digits, dots, underscores and hyphens, starting with a letter or digit. */
export function validReleaseVersion(value: unknown): value is string {
	return (
		typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value)
	);
}

/**
 * A relative POSIX path under bin/, lib/ or share/ of an installed release,
 * with no empty, `.` or `..` component, no backslash, and no character below
 * U+0020 or in U+007F to U+009F.
 */
export function validMemberPath(value: unknown): value is string {
	if (
		typeof value !== "string" ||
		[...value].some((character) => {
			const code = character.charCodeAt(0);
			return (
				code < 0x20 || (code >= 0x7f && code <= 0x9f) || character === "\\"
			);
		})
	)
		return false;
	const parts = value.split("/");
	return (
		parts.length >= 2 &&
		MEMBER_ROOTS.includes(parts[0] ?? "") &&
		parts.every((part) => part !== "" && part !== "." && part !== "..")
	);
}

function parseNamedHashes<K extends "name" | "path">(
	value: unknown,
	path: readonly string[],
	key: K,
	validKey: (candidate: unknown) => boolean,
	expected: string,
): TufResult<(Record<K, string> & { sha256: string })[]> {
	if (!Array.isArray(value)) return malformed(path, expected, typeName(value));
	const rows: (Record<K, string> & { sha256: string })[] = [];
	for (const [index, row] of value.entries()) {
		if (
			!isRecord(row) ||
			!exactKeys(row, [key, "sha256"]) ||
			!validKey(row[key]) ||
			!validHash(row.sha256)
		) {
			return malformed([...path, String(index)], expected, row);
		}
		const previous = rows.at(-1);
		const name = row[key] as string;
		if (previous !== undefined && compare(previous[key], name) >= 0) {
			return malformed(
				[...path, String(index)],
				`${expected}, sorted by ${key} without duplicates`,
				name,
			);
		}
		rows.push({ [key]: name, sha256: row.sha256 } as Record<K, string> & {
			sha256: string;
		});
	}
	return { ok: true, value: rows };
}

function parseComponent(
	value: unknown,
	path: readonly string[],
	target: string | undefined,
): TufResult<ReleaseComponent> {
	const fields = ["id", "version", "delivery", "source", "inputs", "members"];
	const expected =
		target === undefined
			? "a component with exactly target, id, version, delivery, source, inputs and members"
			: "a component with exactly id, version, delivery, source, inputs and members";
	if (
		!isRecord(value) ||
		!exactKeys(value, target === undefined ? ["target", ...fields] : fields)
	) {
		return malformed(path, expected, value);
	}
	const rowTarget = target ?? value.target;
	if (typeof rowTarget !== "string" || !COMPONENT_NAME.test(rowTarget)) {
		return malformed(
			[...path, "target"],
			"a target matching ^[a-z0-9][a-z0-9._-]*$",
			rowTarget,
		);
	}
	if (typeof value.id !== "string" || !COMPONENT_NAME.test(value.id)) {
		return malformed(
			[...path, "id"],
			"an id matching ^[a-z0-9][a-z0-9._-]*$",
			value.id,
		);
	}
	if (!nonEmptyString(value.version)) {
		return malformed([...path, "version"], "a non-empty string", value.version);
	}
	if (
		typeof value.delivery !== "string" ||
		!DELIVERIES.includes(value.delivery)
	) {
		return malformed(
			[...path, "delivery"],
			"bundled or runtime-downloaded",
			value.delivery,
		);
	}
	if (!nonEmptyString(value.source)) {
		return malformed([...path, "source"], "a non-empty string", value.source);
	}
	const inputs = parseNamedHashes(
		value.inputs,
		[...path, "inputs"],
		"name",
		nonEmptyString,
		"inputs of exactly a non-empty name and a 64-character lowercase hex sha256",
	);
	if (!inputs.ok) return inputs;
	if (inputs.value.length === 0) {
		return malformed([...path, "inputs"], "at least one input", value.inputs);
	}
	const members = parseNamedHashes(
		value.members,
		[...path, "members"],
		"path",
		validMemberPath,
		"members of exactly a relative path under bin/, lib/ or share/ and a 64-character lowercase hex sha256",
	);
	if (!members.ok) return members;
	const delivery = value.delivery as ComponentDelivery;
	if (delivery === "bundled" && members.value.length === 0) {
		return malformed(
			[...path, "members"],
			"at least one member for a bundled component",
			value.members,
		);
	}
	if (delivery === "runtime-downloaded" && members.value.length !== 0) {
		return malformed(
			[...path, "members"],
			"no members for a runtime-downloaded component",
			value.members,
		);
	}
	return {
		ok: true,
		value: {
			target: rowTarget,
			id: value.id,
			version: value.version,
			delivery,
			source: value.source,
			inputs: inputs.value,
			members: members.value,
		},
	};
}

/**
 * Validates the `components` list of one producer manifest, whose rows carry
 * no target, and returns them as release-record rows for `target`.
 */
export function parseManifestComponents(
	value: unknown,
	target: string,
): TufResult<ReleaseComponent[]> {
	return parseComponentList(value, ["components"], target);
}

/** Validates a release record's `components`: rows sorted by (target, id), unique. */
export function parseReleaseComponents(
	value: unknown,
): TufResult<ReleaseComponent[]> {
	return parseComponentList(value, ["components"], undefined);
}

function parseComponentList(
	value: unknown,
	path: readonly string[],
	target: string | undefined,
): TufResult<ReleaseComponent[]> {
	if (!Array.isArray(value)) {
		return malformed(path, "an array of components", typeName(value));
	}
	const rows: ReleaseComponent[] = [];
	for (const [index, candidate] of value.entries()) {
		const parsed = parseComponent(candidate, [...path, String(index)], target);
		if (!parsed.ok) return parsed;
		const previous = rows.at(-1);
		if (previous !== undefined && compareKey(previous, parsed.value) >= 0) {
			return malformed(
				[...path, String(index)],
				target === undefined
					? "components sorted by target then id, without duplicates"
					: "components sorted by id, without duplicates",
				parsed.value.id,
			);
		}
		rows.push(parsed.value);
	}
	return { ok: true, value: rows };
}

/**
 * Validates declared component transitions against the record's components:
 * every transition names a target in `componentTargets`, a transition to
 * `absent` names no listed component, and any other transition names a
 * listed component whose delivery is its `to` state.
 */
export function parseComponentTransitions(
	value: unknown,
	components: readonly ReleaseComponent[],
	componentTargets: readonly string[],
): TufResult<ComponentTransition[]> {
	const path = ["component_transitions"];
	if (!Array.isArray(value)) {
		return malformed(
			path,
			"an array of component transitions",
			typeName(value),
		);
	}
	const listed = new Map(
		components.map((row) => [`${row.target}\u0000${row.id}`, row]),
	);
	const transitions: ComponentTransition[] = [];
	for (const [index, row] of value.entries()) {
		const at = [...path, String(index)];
		if (
			!isRecord(row) ||
			!exactKeys(row, ["target", "id", "from", "to"]) ||
			typeof row.target !== "string" ||
			!COMPONENT_NAME.test(row.target) ||
			typeof row.id !== "string" ||
			!COMPONENT_NAME.test(row.id) ||
			typeof row.from !== "string" ||
			!STATES.includes(row.from) ||
			typeof row.to !== "string" ||
			!STATES.includes(row.to) ||
			row.from === row.to
		) {
			return malformed(
				at,
				"a transition of exactly target, id, from and to, where from and to differ and are bundled, runtime-downloaded or absent",
				row,
			);
		}
		const transition: ComponentTransition = {
			target: row.target,
			id: row.id,
			from: row.from as ComponentState,
			to: row.to as ComponentState,
		};
		const previous = transitions.at(-1);
		if (previous !== undefined && compareKey(previous, transition) >= 0) {
			return malformed(
				at,
				"transitions sorted by target then id, without duplicates",
				row,
			);
		}
		if (!componentTargets.includes(transition.target)) {
			return malformed(
				[...at, "target"],
				"a target listed in component_targets",
				transition.target,
			);
		}
		const component = listed.get(`${transition.target}\u0000${transition.id}`);
		if (
			transition.to === "absent"
				? component !== undefined
				: component?.delivery !== transition.to
		) {
			return malformed(
				at,
				transition.to === "absent"
					? "a transition to absent for a component the record does not list"
					: "a transition whose to state is the listed component's delivery",
				row,
			);
		}
		transitions.push(transition);
	}
	return { ok: true, value: transitions };
}

/** Validates `component_targets`: targets sorted in UTF-16 code-unit order, unique. */
export function parseComponentTargets(value: unknown): TufResult<string[]> {
	const path = ["component_targets"];
	if (!Array.isArray(value)) {
		return malformed(path, "an array of targets", typeName(value));
	}
	const targets: string[] = [];
	for (const [index, target] of value.entries()) {
		const previous = targets.at(-1);
		if (
			typeof target !== "string" ||
			!COMPONENT_NAME.test(target) ||
			(previous !== undefined && compare(previous, target) >= 0)
		) {
			return malformed(
				[...path, String(index)],
				"targets matching ^[a-z0-9][a-z0-9._-]*$, sorted, without duplicates",
				target,
			);
		}
		targets.push(target);
	}
	return { ok: true, value: targets };
}

interface ComponentStatement {
	component_targets: string[];
	components: ReleaseComponent[];
	component_baseline: string;
	component_transitions?: ComponentTransition[];
}

// component_targets, components and component_baseline appear together or not
// at all; component_transitions appears only with them.
function parseComponentStatement(
	value: Record<string, unknown>,
	version: string,
): TufResult<ComponentStatement | undefined> {
	const present = (
		["component_targets", "components", "component_baseline"] as const
	).filter((key) => value[key] !== undefined);
	if (present.length === 0) {
		if (value.component_transitions !== undefined) {
			return malformed(
				["component_transitions"],
				"component_transitions only alongside components",
				typeName(value.component_transitions),
			);
		}
		return { ok: true, value: undefined };
	}
	if (present.length !== 3) {
		return malformed(
			[present[0] ?? "components"],
			"component_targets, components and component_baseline together",
			present,
		);
	}
	const targets = parseComponentTargets(value.component_targets);
	if (!targets.ok) return targets;
	const components = parseReleaseComponents(value.components);
	if (!components.ok) return components;
	for (const [index, row] of components.value.entries()) {
		if (!targets.value.includes(row.target)) {
			return malformed(
				["components", String(index), "target"],
				"a target listed in component_targets",
				row.target,
			);
		}
	}
	if (
		!validReleaseVersion(value.component_baseline) ||
		value.component_baseline === version
	) {
		return malformed(
			["component_baseline"],
			"the version of a previous release, other than this record's version",
			value.component_baseline,
		);
	}
	let transitions: ComponentTransition[] | undefined;
	if (value.component_transitions !== undefined) {
		const parsed = parseComponentTransitions(
			value.component_transitions,
			components.value,
			targets.value,
		);
		if (!parsed.ok) return parsed;
		transitions = parsed.value;
	}
	return {
		ok: true,
		value: {
			component_targets: targets.value,
			components: components.value,
			component_baseline: value.component_baseline,
			...(transitions === undefined
				? {}
				: { component_transitions: transitions }),
		},
	};
}

/**
 * Validates a candidate release-record predicate body.
 * Fails closed on any shape or claim violation.
 */
export async function validateReleaseRecordPredicate(
	value: TufJsonValue,
): Promise<TufResult<ReleaseRecordPredicate>> {
	if (!isRecord(value)) {
		return malformed([], "a release-record object", typeName(value));
	}
	if (
		!Array.isArray(value._comment) ||
		value._comment.some((entry) => typeof entry !== "string")
	) {
		return malformed(
			["_comment"],
			"an array of explanatory strings",
			value._comment === undefined ? typeName(value._comment) : value._comment,
		);
	}
	if (value.schema !== RELEASE_RECORD_SCHEMA) {
		return malformed(["schema"], RELEASE_RECORD_SCHEMA, value.schema);
	}
	if (typeof value.product !== "string" || value.product === "") {
		return malformed(
			["product"],
			"a non-empty product string",
			typeName(value.product),
		);
	}
	if (typeof value.version !== "string" || value.version === "") {
		return malformed(
			["version"],
			"a non-empty version string",
			typeName(value.version),
		);
	}
	if (!Array.isArray(value.artifacts)) {
		return malformed(
			["artifacts"],
			"an array of release artifacts",
			typeName(value.artifacts),
		);
	}
	const artifacts: ReleaseArtifact[] = [];
	for (const [index, candidate] of value.artifacts.entries()) {
		const parsed = parseArtifact(candidate, index);
		if (!parsed.ok) return parsed;
		artifacts.push(parsed.value);
	}
	const urls = new Set<string>();
	for (const artifact of artifacts) {
		if (urls.has(artifact.url)) {
			return malformed(
				["artifacts"],
				"artifacts with unique URLs",
				artifact.url,
			);
		}
		urls.add(artifact.url);
	}
	if (
		!Array.isArray(value.does_prove) ||
		value.does_prove.length === 0 ||
		value.does_prove.some((entry) => typeof entry !== "string")
	) {
		return malformed(
			["does_prove"],
			"a non-empty array of claim strings",
			value.does_prove,
		);
	}
	if (
		!Array.isArray(value.does_not_prove) ||
		value.does_not_prove.length === 0 ||
		value.does_not_prove.some((entry) => typeof entry !== "string")
	) {
		return malformed(
			["does_not_prove"],
			"a non-empty array of non-claim strings",
			value.does_not_prove,
		);
	}
	// The component fields are optional; a record without them is returned in
	// exactly the shape it had before they existed.
	const statement = parseComponentStatement(value, value.version);
	if (!statement.ok) return statement;
	return {
		ok: true,
		value: {
			_comment: value._comment as string[],
			schema: RELEASE_RECORD_SCHEMA,
			product: value.product,
			version: value.version,
			artifacts,
			...statement.value,
			does_prove: value.does_prove as string[],
			does_not_prove: value.does_not_prove as string[],
		},
	};
}
