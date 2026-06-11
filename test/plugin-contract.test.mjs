import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import plugin from "../dist/index.js";

const manifest = JSON.parse(await readFile(new URL("../manifest.json", import.meta.url), "utf8"));
const manifestActionIds = new Set(manifest.contributes.actions.map((action) => action.id));
const manifestPaneIds = new Set(manifest.contributes.panes.map((pane) => pane.id));

const sampleHosts = [
  {
    id: "host-1",
    name: "prod-a",
    hostname: "prod-a.example.com",
    username: "deploy",
    port: 22,
    osKind: "linux"
  }
];

const sampleSnippets = [
  {
    id: "snippet-1",
    name: "Disk usage",
    command: "df -h",
    tags: ["ops", "disk"]
  }
];

test("plugin registers only manifest contributions", async () => {
  const harness = await activatePlugin();
  assert.deepEqual(new Set(Object.keys(harness.actions)), manifestActionIds);
  assert.deepEqual(new Set(Object.keys(harness.panes)), manifestPaneIds);
});

test("dashboard schema action ids are declared in manifest", async () => {
  const harness = await activatePlugin();
  const schema = await harness.panes["ops.dashboard"]();
  for (const actionId of collectActionIds(schema)) {
    assert.equal(manifestActionIds.has(actionId), true, actionId);
  }
});

test("open dashboard action returns only toast and openPane effects", async () => {
  const harness = await activatePlugin();
  const result = await harness.actions["ops.openDashboard"]();
  assert.equal(result, undefined);
  assert.deepEqual(harness.effects, [
    { type: "toast", message: "Opening Host Ops Cockpit", severity: "info" },
    { type: "openPane", viewId: "ops.dashboard" }
  ]);
});

test("terminal actions return terminal write effects", async () => {
  const insertHarness = await activatePlugin();
  const insertResult = await insertHarness.actions["ops.insertHealthCheck"]();
  assert.equal(insertResult.effects[0].mode, "insert");
  assert.match(insertResult.effects[0].text, /uptime/);

  const runHarness = await activatePlugin();
  const runResult = await runHarness.actions["ops.runHealthCheck"]();
  assert.equal(runResult.effects[0].mode, "run");
  assert.match(runResult.effects[0].text, /df -h/);
});

async function activatePlugin() {
  const actions = {};
  const panes = {};
  const effects = [];
  const ctx = {
    plugin: {
      id: manifest.id,
      version: manifest.version
    },
    registerAction(id, handler) {
      actions[id] = handler;
    },
    registerPane(id, handler) {
      panes[id] = handler;
    },
    hosts: {
      async list() {
        return sampleHosts;
      }
    },
    snippets: {
      async list() {
        return sampleSnippets;
      }
    },
    terminal: {
      insert(text) {
        return { effects: [{ type: "terminalWrite", text, mode: "insert" }] };
      },
      run(text) {
        return { effects: [{ type: "terminalWrite", text, mode: "run" }] };
      }
    },
    ui: {
      markdown(spec) {
        return { ...spec, type: "markdown" };
      },
      table(spec) {
        return { ...spec, type: "table" };
      },
      form(spec) {
        return { ...spec, type: "form" };
      },
      stack(children, title) {
        return { type: "stack", title, children };
      },
      empty(title, body) {
        return { type: "empty", title, body };
      }
    },
    effects: {
      toast(message, severity) {
        effects.push({ type: "toast", message, severity });
      },
      openPane(viewId) {
        effects.push({ type: "openPane", viewId });
      }
    }
  };
  await plugin.activate(ctx);
  return { actions, panes, effects };
}

function collectActionIds(schema) {
  const ids = [];
  if (Array.isArray(schema.actions)) {
    ids.push(...schema.actions.map((action) => action.id));
  }
  if (Array.isArray(schema.children)) {
    for (const child of schema.children) {
      ids.push(...collectActionIds(child));
    }
  }
  return ids;
}
