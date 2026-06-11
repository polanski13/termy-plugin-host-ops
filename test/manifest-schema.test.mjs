import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { test } from "node:test";
import Ajv from "ajv/dist/2020.js";

const require = createRequire(import.meta.url);
const schemaPath = require.resolve("@apolanski13/termy-sdk/manifest-schema.json");
const schema = JSON.parse(await readFile(schemaPath, "utf8"));
const manifest = JSON.parse(await readFile(new URL("../manifest.json", import.meta.url), "utf8"));
const ajv = new Ajv({ allErrors: true });
const validate = ajv.compile(schema);

test("manifest matches Termy plugin schema", () => {
  assert.equal(validate(manifest), true, JSON.stringify(validate.errors));
});

test("schema rejects unsafe entry paths", () => {
  assert.equal(validate({ ...manifest, entry: "../dist/index.js" }), false);
});

test("schema rejects unknown capabilities", () => {
  assert.equal(validate({ ...manifest, capabilities: ["hosts.read", "network.fetch"] }), false);
});

test("schema rejects missing contribution fields", () => {
  assert.equal(
    validate({
      ...manifest,
      contributes: {
        actions: [{ id: "ops.bad" }],
        panes: manifest.contributes.panes
      }
    }),
    false
  );
});
