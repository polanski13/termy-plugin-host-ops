import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const output = await readFile(new URL("../dist/index.js", import.meta.url), "utf8");

test("built plugin keeps Termy loader import", () => {
  assert.match(output, /import\s+\{\s*definePlugin\s*\}\s+from\s+["']@apolanski13\/termy-sdk["']/);
});

test("built plugin keeps direct default plugin export", () => {
  assert.match(output, /export\s+default\s+definePlugin\s*\(/);
});
