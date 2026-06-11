import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { copyFile, mkdir, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const run = promisify(execFile);
const root = fileURLToPath(new URL("..", import.meta.url));
const manifest = JSON.parse(await readFile(join(root, "manifest.json"), "utf8"));
const packageJson = JSON.parse(await readFile(join(root, "package.json"), "utf8"));

assert.equal(manifest.version, packageJson.version);
assert.equal(manifest.entry, "dist/index.js");

const releaseDir = join(root, "release");
const bundleName = "host-ops-cockpit.termy-plugin";
const bundleDir = join(releaseDir, bundleName);
const zipName = `host-ops-cockpit-v${manifest.version}.termy-plugin.zip`;
const zipPath = join(releaseDir, zipName);

await rm(releaseDir, { recursive: true, force: true });
await mkdir(join(bundleDir, "dist"), { recursive: true });

await copyFile(join(root, "manifest.json"), join(bundleDir, "manifest.json"));
await copyFile(join(root, "dist", "index.js"), join(bundleDir, "dist", "index.js"));
await copyFile(join(root, "README.md"), join(bundleDir, "README.md"));
await copyFile(join(root, "LICENSE"), join(bundleDir, "LICENSE"));

await run("zip", ["-qry", zipPath, bundleName], { cwd: releaseDir });

const listing = await run("zipinfo", ["-1", zipPath]);
const files = new Set(listing.stdout.trim().split("\n"));
for (const required of [
  `${bundleName}/manifest.json`,
  `${bundleName}/dist/index.js`,
  `${bundleName}/README.md`,
  `${bundleName}/LICENSE`
]) {
  assert.equal(files.has(required), true, required);
}

console.log(zipPath);
