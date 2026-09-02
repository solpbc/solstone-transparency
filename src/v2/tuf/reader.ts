// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { admitTufJson } from "./admission";
import { canonicalizeTufJson } from "./canonical";
import { type TufResult, rejection } from "./outcome";
import {
	type DelegationAuthority,
	type MetadataRoleKind,
	type TufDelegationRole,
	type TufRole,
	type TufSignature,
	authorizeTargetPath,
	checkMetadataType,
	evaluateRoleAuthorization,
	validateDelegationConfiguration,
} from "./role-graph";
import { metadataFilename, metadataLogicalName } from "./serializer";

export interface ReadMetadata {
	roleName: string;
	filename: string;
	version: number;
	signed: Record<string, unknown>;
	signatures: readonly TufSignature[];
	bytes: Uint8Array;
}

export interface ReadRepository {
	consistentSnapshot: boolean;
	root: ReadMetadata;
	timestamp: ReadMetadata;
	snapshot: ReadMetadata;
	targets: ReadMetadata;
	delegatedTargets: readonly ReadMetadata[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

function typeName(value: unknown): string {
	if (value === null) return "null";
	if (Array.isArray(value)) return "array";
	return typeof value;
}

function positiveVersion(
	value: unknown,
	path: readonly string[],
): TufResult<number> {
	if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) {
		return rejection("malformed", {
			path,
			expected: "a positive safe integer metadata version",
			observed: value,
		});
	}
	return { ok: true, value };
}

function recordField(
	value: Record<string, unknown>,
	field: string,
	path: readonly string[],
): TufResult<Record<string, unknown>> {
	const fieldValue = value[field];
	if (!isRecord(fieldValue)) {
		return rejection("malformed", {
			path: [...path, field],
			expected: "an object",
			observed: typeName(fieldValue),
		});
	}
	return { ok: true, value: fieldValue };
}

function parseRole(
	value: unknown,
	path: readonly string[],
): TufResult<TufRole> {
	if (
		!isRecord(value) ||
		!Array.isArray(value.keyids) ||
		!value.keyids.every((id) => typeof id === "string")
	) {
		return rejection("malformed", {
			path,
			expected: "a role object with string keyids",
			observed: typeName(value),
		});
	}
	if (typeof value.threshold !== "number") {
		return rejection("malformed", {
			path: [...path, "threshold"],
			expected: "a numeric role threshold",
			observed: typeName(value.threshold),
		});
	}
	return {
		ok: true,
		value: { keyids: value.keyids, threshold: value.threshold },
	};
}

function parseDelegations(value: unknown): TufResult<{
	keys: Record<string, unknown>;
	roles: DelegationAuthority[];
	verificationRoles: TufDelegationRole[];
}> {
	if (!isRecord(value)) {
		return rejection("malformed", {
			path: ["signed", "delegations"],
			expected: "a delegations object",
			observed: typeName(value),
		});
	}
	const keys = recordField(value, "keys", ["signed", "delegations"]);
	if (!keys.ok) return keys;
	if (!Array.isArray(value.roles)) {
		return rejection("malformed", {
			path: ["signed", "delegations", "roles"],
			expected: "an array of delegated roles",
			observed: typeName(value.roles),
		});
	}
	const roles: DelegationAuthority[] = [];
	const verificationRoles: TufDelegationRole[] = [];
	for (const [index, item] of value.roles.entries()) {
		const role = parseRole(item, [
			"signed",
			"delegations",
			"roles",
			String(index),
		]);
		if (!role.ok) return role;
		if (
			!isRecord(item) ||
			typeof item.name !== "string" ||
			!Array.isArray(item.paths) ||
			!item.paths.every((path) => typeof path === "string") ||
			typeof item.terminating !== "boolean"
		) {
			return rejection("malformed", {
				path: ["signed", "delegations", "roles", String(index)],
				expected:
					"a named delegated role with string paths and boolean terminating",
				observed: typeName(item),
			});
		}
		const verificationRole: TufDelegationRole = {
			...role.value,
			name: item.name,
			paths: item.paths,
			terminating: item.terminating,
		};
		const path = verificationRole.paths[0];
		if (
			verificationRole.paths.length !== 1 ||
			path === undefined ||
			!path.endsWith("*")
		) {
			return rejection("malformed", {
				path: ["signed", "delegations", "roles", String(index), "paths"],
				expected: "one path ending in a wildcard",
				observed: verificationRole.paths,
			});
		}
		roles.push({
			name: verificationRole.name,
			pathPrefix: path.slice(0, -1),
			terminating: verificationRole.terminating,
		});
		verificationRoles.push(verificationRole);
	}
	const validated = validateDelegationConfiguration(
		verificationRoles,
		keys.value,
	);
	if (!validated.ok) return validated;
	return { ok: true, value: { keys: keys.value, roles, verificationRoles } };
}

function parseEnvelope(
	roleName: string,
	filename: string,
	bytes: Uint8Array,
): TufResult<ReadMetadata> {
	const admitted = admitTufJson(bytes);
	if (!admitted.ok) return admitted;
	if (!isRecord(admitted.value)) {
		return rejection("malformed", {
			path: [],
			expected: "a TUF metadata envelope object",
			observed: typeName(admitted.value),
		});
	}
	if (
		!isRecord(admitted.value.signed) ||
		!Array.isArray(admitted.value.signatures)
	) {
		return rejection("malformed", {
			path: [],
			expected: "an envelope with signed object and signatures array",
			observed: Object.keys(admitted.value),
		});
	}
	const signatures: TufSignature[] = [];
	for (const [index, signature] of admitted.value.signatures.entries()) {
		if (
			!isRecord(signature) ||
			typeof signature.keyid !== "string" ||
			typeof signature.sig !== "string"
		) {
			return rejection("malformed", {
				path: ["signatures", String(index)],
				expected: "a signature with string keyid and sig",
				observed: typeName(signature),
			});
		}
		signatures.push({ keyid: signature.keyid, sig: signature.sig });
	}
	const version = positiveVersion(admitted.value.signed.version, [
		"signed",
		"version",
	]);
	if (!version.ok) return version;
	return {
		ok: true,
		value: {
			roleName,
			filename,
			version: version.value,
			signed: admitted.value.signed,
			signatures,
			bytes,
		},
	};
}

async function readMetadataFile(
	directory: string,
	roleName: string,
	filename: string,
): Promise<TufResult<ReadMetadata>> {
	try {
		const bytes = new Uint8Array(await readFile(join(directory, filename)));
		return parseEnvelope(roleName, filename, bytes);
	} catch (error) {
		return rejection("malformed", {
			path: [filename],
			expected:
				"metadata bytes readable from the supplied repository directory",
			observed: error instanceof Error ? error.name : typeof error,
		});
	}
}

async function verifyMetadata(
	metadata: ReadMetadata,
	expectedType: MetadataRoleKind,
	role: TufRole,
	keys: Readonly<Record<string, unknown>>,
	filenameVersion: number | undefined,
): Promise<TufResult<undefined>> {
	const typed = checkMetadataType(metadata.signed, expectedType);
	if (!typed.ok) return typed;
	const version = validateFilenameVersion(
		metadata.filename,
		filenameVersion,
		metadata.version,
	);
	if (!version.ok) return version;
	const canonical = canonicalizeTufJson(metadata.signed);
	if (!canonical.ok) return canonical;
	return evaluateRoleAuthorization({
		role,
		keys,
		signatures: metadata.signatures,
		message: canonical.value,
	});
}

/** Checks a trusted versioned filename against the metadata's signed version. */
export function validateFilenameVersion(
	filename: string,
	filenameVersion: number | undefined,
	signedVersion: number,
): TufResult<undefined> {
	if (filenameVersion !== undefined && filenameVersion !== signedVersion) {
		return rejection("filename-version-mismatch", {
			path: [filename, "signed", "version"],
			expected: filenameVersion,
			observed: signedVersion,
		});
	}
	return { ok: true, value: undefined };
}

function metaVersion(
	signed: Record<string, unknown>,
	logicalName: string,
): TufResult<number> {
	const meta = recordField(signed, "meta", ["signed"]);
	if (!meta.ok) return meta;
	const entry = meta.value[logicalName];
	if (!isRecord(entry)) {
		return rejection("malformed", {
			path: ["signed", "meta", logicalName],
			expected: "a metadata description with a version",
			observed: typeName(entry),
		});
	}
	return positiveVersion(entry.version, [
		"signed",
		"meta",
		logicalName,
		"version",
	]);
}

function rootDeclarations(signed: Record<string, unknown>): TufResult<{
	keys: Record<string, unknown>;
	roles: Record<string, TufRole>;
	consistentSnapshot: boolean;
}> {
	const keys = recordField(signed, "keys", ["signed"]);
	if (!keys.ok) return keys;
	const rolesObject = recordField(signed, "roles", ["signed"]);
	if (!rolesObject.ok) return rolesObject;
	const roles: Record<string, TufRole> = {};
	for (const roleName of [
		"root",
		"targets",
		"snapshot",
		"timestamp",
	] as const) {
		const role = parseRole(rolesObject.value[roleName], [
			"signed",
			"roles",
			roleName,
		]);
		if (!role.ok) return role;
		roles[roleName] = role.value;
	}
	if (typeof signed.consistent_snapshot !== "boolean") {
		return rejection("malformed", {
			path: ["signed", "consistent_snapshot"],
			expected: "a boolean consistent_snapshot flag",
			observed: typeName(signed.consistent_snapshot),
		});
	}
	return {
		ok: true,
		value: {
			keys: keys.value,
			roles,
			consistentSnapshot: signed.consistent_snapshot,
		},
	};
}

function validateTargets(
	metadata: ReadMetadata,
	roleName: string,
	delegatedRoles: readonly DelegationAuthority[],
): TufResult<undefined> {
	const targets = recordField(metadata.signed, "targets", ["signed"]);
	if (!targets.ok) return targets;
	for (const targetPath of Object.keys(targets.value)) {
		const authorized = authorizeTargetPath(
			roleName,
			targetPath,
			delegatedRoles,
		);
		if (!authorized.ok) return authorized;
	}
	return { ok: true, value: undefined };
}

async function rootFilename(
	directory: string,
): Promise<TufResult<{ filename: string; version: number }>> {
	try {
		const candidates = (await readdir(directory))
			.map((filename) => ({
				filename,
				match: /^(\d+)\.root\.json$/.exec(filename),
			}))
			.filter(
				(
					candidate,
				): candidate is { filename: string; match: RegExpExecArray } =>
					candidate.match !== null,
			);
		if (candidates.length !== 1) {
			return rejection("malformed", {
				path: [],
				expected: "exactly one versioned root metadata file",
				observed: candidates.map((candidate) => candidate.filename),
			});
		}
		const candidate = candidates[0];
		if (candidate === undefined) {
			return rejection("malformed", {
				path: [],
				expected: "a versioned root metadata file",
				observed: "none",
			});
		}
		const version = positiveVersion(Number(candidate.match[1]), [
			candidate.filename,
		]);
		if (!version.ok) return version;
		return {
			ok: true,
			value: { filename: candidate.filename, version: version.value },
		};
	} catch (error) {
		return rejection("malformed", {
			path: [],
			expected: "a readable repository directory",
			observed: error instanceof Error ? error.name : typeof error,
		});
	}
}

/**
 * Reads bytes from one serialized repository snapshot and self-verifies every role.
 * It deliberately does not implement a client trust store, rotation, or metadata-link checks.
 */
export async function readRepository(
	directory: string,
): Promise<TufResult<ReadRepository>> {
	const rootFile = await rootFilename(directory);
	if (!rootFile.ok) return rootFile;
	const root = await readMetadataFile(
		directory,
		"root",
		rootFile.value.filename,
	);
	if (!root.ok) return root;
	const rootTyped = checkMetadataType(root.value.signed, "root");
	if (!rootTyped.ok) return rootTyped;
	const declarations = rootDeclarations(root.value.signed);
	if (!declarations.ok) return declarations;
	const rootRole = declarations.value.roles.root;
	if (rootRole === undefined) {
		return rejection("malformed", {
			path: ["signed", "roles", "root"],
			expected: "a root role declaration",
			observed: "missing",
		});
	}
	const rootVerified = await verifyMetadata(
		root.value,
		"root",
		rootRole,
		declarations.value.keys,
		rootFile.value.version,
	);
	if (!rootVerified.ok) return rootVerified;

	const timestampFilename = metadataFilename(
		"timestamp",
		1,
		declarations.value.consistentSnapshot,
	);
	if (!timestampFilename.ok) return timestampFilename;
	const timestamp = await readMetadataFile(
		directory,
		"timestamp",
		timestampFilename.value,
	);
	if (!timestamp.ok) return timestamp;
	const timestampRole = declarations.value.roles.timestamp;
	if (timestampRole === undefined)
		return rejection("malformed", {
			path: ["signed", "roles", "timestamp"],
			expected: "a timestamp role",
			observed: "missing",
		});
	const timestampVerified = await verifyMetadata(
		timestamp.value,
		"timestamp",
		timestampRole,
		declarations.value.keys,
		undefined,
	);
	if (!timestampVerified.ok) return timestampVerified;

	const snapshotLogicalName = metadataLogicalName("snapshot");
	if (!snapshotLogicalName.ok) return snapshotLogicalName;
	const snapshotVersion = metaVersion(
		timestamp.value.signed,
		snapshotLogicalName.value,
	);
	if (!snapshotVersion.ok) return snapshotVersion;
	const snapshotFilename = metadataFilename(
		"snapshot",
		snapshotVersion.value,
		declarations.value.consistentSnapshot,
	);
	if (!snapshotFilename.ok) return snapshotFilename;
	const snapshot = await readMetadataFile(
		directory,
		"snapshot",
		snapshotFilename.value,
	);
	if (!snapshot.ok) return snapshot;
	const snapshotRole = declarations.value.roles.snapshot;
	if (snapshotRole === undefined)
		return rejection("malformed", {
			path: ["signed", "roles", "snapshot"],
			expected: "a snapshot role",
			observed: "missing",
		});
	const snapshotVerified = await verifyMetadata(
		snapshot.value,
		"snapshot",
		snapshotRole,
		declarations.value.keys,
		declarations.value.consistentSnapshot ? snapshotVersion.value : undefined,
	);
	if (!snapshotVerified.ok) return snapshotVerified;

	const targetsLogicalName = metadataLogicalName("targets");
	if (!targetsLogicalName.ok) return targetsLogicalName;
	const targetsVersion = metaVersion(
		snapshot.value.signed,
		targetsLogicalName.value,
	);
	if (!targetsVersion.ok) return targetsVersion;
	const targetsFilename = metadataFilename(
		"targets",
		targetsVersion.value,
		declarations.value.consistentSnapshot,
	);
	if (!targetsFilename.ok) return targetsFilename;
	const targets = await readMetadataFile(
		directory,
		"targets",
		targetsFilename.value,
	);
	if (!targets.ok) return targets;
	const targetsRole = declarations.value.roles.targets;
	if (targetsRole === undefined)
		return rejection("malformed", {
			path: ["signed", "roles", "targets"],
			expected: "a targets role",
			observed: "missing",
		});
	const targetsVerified = await verifyMetadata(
		targets.value,
		"targets",
		targetsRole,
		declarations.value.keys,
		declarations.value.consistentSnapshot ? targetsVersion.value : undefined,
	);
	if (!targetsVerified.ok) return targetsVerified;
	const delegations = parseDelegations(targets.value.signed.delegations);
	if (!delegations.ok) return delegations;
	const topTargetsSafe = validateTargets(
		targets.value,
		"targets",
		delegations.value.roles,
	);
	if (!topTargetsSafe.ok) return topTargetsSafe;
	const delegatedTargets: ReadMetadata[] = [];
	for (const [index, delegatedRole] of delegations.value.roles.entries()) {
		const verificationRole = delegations.value.verificationRoles[index];
		if (verificationRole === undefined) {
			return rejection("malformed", {
				path: ["signed", "delegations", "roles", String(index)],
				expected: "a delegation verification role",
				observed: "missing",
			});
		}
		const logicalName = metadataLogicalName(delegatedRole.name);
		if (!logicalName.ok) return logicalName;
		const version = metaVersion(snapshot.value.signed, logicalName.value);
		if (!version.ok) return version;
		const filename = metadataFilename(
			delegatedRole.name,
			version.value,
			declarations.value.consistentSnapshot,
		);
		if (!filename.ok) return filename;
		const delegated = await readMetadataFile(
			directory,
			delegatedRole.name,
			filename.value,
		);
		if (!delegated.ok) return delegated;
		const verified = await verifyMetadata(
			delegated.value,
			"targets",
			verificationRole,
			delegations.value.keys,
			declarations.value.consistentSnapshot ? version.value : undefined,
		);
		if (!verified.ok) return verified;
		const targetsSafe = validateTargets(
			delegated.value,
			delegatedRole.name,
			delegations.value.roles,
		);
		if (!targetsSafe.ok) return targetsSafe;
		delegatedTargets.push(delegated.value);
	}

	return {
		ok: true,
		value: {
			consistentSnapshot: declarations.value.consistentSnapshot,
			root: root.value,
			timestamp: timestamp.value,
			snapshot: snapshot.value,
			targets: targets.value,
			delegatedTargets,
		},
	};
}
