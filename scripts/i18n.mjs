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

const args = process.argv.slice(2);
let channel = "production";
const locales = [];
for (let i = 0; i < args.length; i += 1) {
  if (args[i] === "--channel" && i + 1 < args.length) {
    channel = args[i + 1];
    i += 1;
  } else if (args[i] === "--locale" && i + 1 < args.length) {
    locales.push(args[i + 1]);
    i += 1;
  } else {
    throw new Error(`Unknown argument: ${args[i]}`);
  }
}
if (channel !== "production" && channel !== "development") {
  throw new Error(`Unsupported channel: ${channel}`);
}

const declarationPath = path.join(root, "i18n/generated/esm/transparency/api.d.mts");
const declaration = fs.readFileSync(declarationPath);
const generated = path.join(root, "i18n/generated");
const staging = path.join(root, "i18n/generated.next");
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "i18n-transparency-"));
try {
  const compilerArgs = [
    "targets",
    path.join(root, "i18n/catalog"),
    "--channel",
    channel,
    ...(channel === "development" ? ["--fallback-stale"] : []),
    ...locales.flatMap((loc) => ["--locale", loc]),
    "--target",
    "esm",
    "--out",
    scratch,
  ];
  execFileSync(compiler, compilerArgs, { stdio: "inherit" });
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
  if (channel === "production") {
    writeSnapshot(root);
  }
} finally {
  fs.rmSync(scratch, { recursive: true, force: true });
  fs.rmSync(staging, { recursive: true, force: true });
}
