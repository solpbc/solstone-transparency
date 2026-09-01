#!/usr/bin/env bun
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc

import { run } from "../src/cli";

process.exit(await run(process.argv.slice(2)));
