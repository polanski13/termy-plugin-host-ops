# Host Ops Cockpit

Showcase community plugin for Termy.

Host Ops Cockpit demonstrates the full Termy plugin SDK v1 surface available today:

- `hosts.read`
- `snippets.read`
- `terminal.write`
- schema UI: markdown, table, form, stack, empty
- effects: toast and open plugin pane

It does not use Node APIs, filesystem access, network access, Keychain access, SSH credentials, or terminal scrollback.

## Install

Download `host-ops-cockpit-v0.1.0.termy-plugin.zip` from the GitHub release.

In Termy:

```text
Settings > Plugins > Install...
```

Choose the downloaded zip file. Termy will ask for the declared capabilities before the plugin runs.

## Use

The plugin contributes one pane and five actions.

Pane:

```text
Host Ops Cockpit
```

Actions:

```text
Host Ops: Open Cockpit
Host Ops: Show Inventory
Host Ops: Insert Health Check
Host Ops: Run Health Check
Host Ops: Show Runbook
```

The health check command is inspect-only:

```sh
hostname; whoami; uptime; df -h; date
```

`Insert Health Check` places the command in the focused terminal. `Run Health Check` asks Termy to run it through the existing terminal-write confirmation flow.

## Build

```sh
npm install
npm run typecheck
npm test
npm run pack:plugin
```

The installable plugin zip is written to:

```text
release/host-ops-cockpit-v0.1.0.termy-plugin.zip
```

## Source shape

```text
manifest.json
src/index.ts
dist/index.js
README.md
LICENSE
```

Termy v1 expects the compiled entry to keep this shape:

```ts
import { definePlugin } from "@apolanski13/termy-sdk";

export default definePlugin({
  activate(ctx) {}
});
```
