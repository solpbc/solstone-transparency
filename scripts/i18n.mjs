// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 sol pbc
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { writeSnapshot } from "./catalog-snapshot.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const compiler = process.env.I18N_COMPILER;
if (!compiler) {
  throw new Error("Set I18N_COMPILER to the pinned i18n-catalog binary; see i18n/README.md");
}

const declarationPath = path.join(root, "i18n/generated/esm/transparency/api.d.mts");
const declaration = fs.readFileSync(declarationPath);
const generated = path.join(root, "i18n/generated");
const staging = path.join(root, "i18n/generated.next");
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "i18n-transparency-"));
try {
  execFileSync(
    compiler,
    [
      "targets",
      path.join(root, "i18n/catalog"),
      "--channel",
      "production",
      "--target",
      "esm",
      "--out",
      scratch,
    ],
    { stdio: "inherit" },
  );
  const backup = path.join(root, "i18n/generated.bak");
  fs.rmSync(staging, { recursive: true, force: true });
  fs.rmSync(backup, { recursive: true, force: true });
  fs.cpSync(scratch, staging, { recursive: true });
  fs.rmSync(path.join(staging, "i18n-catalog-targets"));
  const stagedDeclaration = path.join(staging, "esm/transparency/api.d.mts");
  fs.mkdirSync(path.dirname(stagedDeclaration), { recursive: true });
  fs.writeFileSync(stagedDeclaration, declaration);
  fs.renameSync(generated, backup);
  try {
    fs.renameSync(staging, generated);
  } catch (err) {
    fs.renameSync(backup, generated);
    throw err;
  }
  fs.rmSync(backup, { recursive: true, force: true });
  writeSnapshot(root);
} finally {
  fs.rmSync(scratch, { recursive: true, force: true });
  fs.rmSync(staging, { recursive: true, force: true });
}
