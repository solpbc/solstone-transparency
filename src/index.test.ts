// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

import { describe, expect, test } from "bun:test";
import pkg from "../package.json";
import { VERSION } from "./index";

describe("VERSION", () => {
	test("matches the package manifest", () => {
		expect(VERSION).toBe(pkg.version);
	});
});
