// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

import { type TufResult, rejection } from "./outcome";
import { validateTargetPath } from "./role-graph";

export interface TargetStoragePathContext {
	readonly sha256: string;
	readonly consistentSnapshot: boolean;
}

const SHA256_HEX = /^[0-9a-f]{64}$/;
const SHA256_PREFIX = /^([0-9a-f]{64})\.(.+)$/;

function validateSha256(sha256: string): TufResult<string> {
	if (!SHA256_HEX.test(sha256)) {
		return rejection("malformed", {
			path: ["sha256"],
			expected: "exactly 64 lowercase hexadecimal characters",
			observed: sha256,
		});
	}
	return { ok: true, value: sha256 };
}

export function targetStoragePath(
	logicalTargetPath: string,
	context: TargetStoragePathContext,
): TufResult<string> {
	const logicalPath = validateTargetPath(logicalTargetPath);
	if (!logicalPath.ok) return logicalPath;
	const sha256 = validateSha256(context.sha256);
	if (!sha256.ok) return sha256;
	if (!context.consistentSnapshot)
		return { ok: true, value: logicalPath.value };

	const pathParts = logicalPath.value.split("/");
	const basename = pathParts.pop();
	if (basename === undefined) {
		return rejection("malformed", {
			path: ["logicalTargetPath"],
			expected: "a target path with a basename",
			observed: logicalTargetPath,
		});
	}
	const storageBasename = `${sha256.value}.${basename}`;
	return {
		ok: true,
		value:
			pathParts.length === 0
				? storageBasename
				: `${pathParts.join("/")}/${storageBasename}`,
	};
}

export function logicalTargetPathFromStoragePath(
	physicalTargetPath: string,
	context: TargetStoragePathContext,
): TufResult<string> {
	const sha256 = validateSha256(context.sha256);
	if (!sha256.ok) return sha256;
	const storagePath = validateTargetPath(physicalTargetPath);
	if (!storagePath.ok) return storagePath;
	if (!context.consistentSnapshot)
		return { ok: true, value: storagePath.value };

	const pathParts = storagePath.value.split("/");
	const basename = pathParts.pop();
	if (basename === undefined) {
		return rejection("malformed", {
			path: ["physicalTargetPath"],
			expected: "a target storage path with a basename",
			observed: physicalTargetPath,
		});
	}
	const matchedPrefix = SHA256_PREFIX.exec(basename);
	if (matchedPrefix === null) {
		return rejection("malformed", {
			path: ["physicalTargetPath"],
			expected:
				"a basename prefixed with a 64-character lowercase SHA-256 and dot",
			observed: basename,
		});
	}
	if (matchedPrefix[1] !== sha256.value) {
		return rejection("hash-mismatch", {
			path: ["physicalTargetPath"],
			expected: `${sha256.value}.<logical-basename>`,
			observed: basename,
		});
	}

	const logicalPath =
		pathParts.length === 0
			? matchedPrefix[2]
			: `${pathParts.join("/")}/${matchedPrefix[2]}`;
	return validateTargetPath(logicalPath);
}
