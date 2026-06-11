# Host Ops Cockpit

Showcase community plugin for Termy.

Host Ops Cockpit demonstrates the Termy plugin SDK v1 surface used by SDK package `@apolanski13/termy-sdk@0.2.0`:

- `hosts.read`
- `snippets.read`
- `workspace.read`
- `storage.read`
- `storage.write`
- `terminal.write`
- schema UI: markdown, table, form, stack, empty, statGrid, list, divider
- editable plugin settings
- effects: toast and open plugin pane

It does not use Node APIs, filesystem access, network access, Keychain access, SSH credentials, or terminal scrollback.

## Install

Use Termy's GitHub install flow:

```text
Settings > Plugins > Install from GitHub...
```

Enter:

```text
https://github.com/polanski13/termy-plugin-host-ops
```

Termy installs the latest release asset named:

```text
host-ops-cockpit-v0.2.0.termy-plugin.zip
```

You can also download that release asset and install it with:

```text
Settings > Plugins > Install...
```

Use the `.termy-plugin.zip` release asset, not GitHub's automatic `Source code` zip. The release asset contains the compiled plugin entry that Termy loads.

## Use

The plugin contributes one pane, one settings page, and six actions.

Pane:

```text
Host Ops Cockpit
```

Settings:

```text
Host Ops Preferences
```

Actions:

```text
Host Ops: Open Cockpit
Host Ops: Refresh Dashboard
Host Ops: Show Inventory
Host Ops: Insert Health Check
Host Ops: Run Health Check
Host Ops: Show Runbook
```

The health check command is inspect-only by default:

```sh
hostname; whoami; uptime; df -h; date
```

`Insert Health Check` places the command in the focused terminal. `Run Health Check` asks Termy to run it through the existing terminal-write confirmation flow.

## SDK 0.2 coverage

The dashboard uses `ctx.workspace.current()` to show focused pane context and safe focused host summary.

The settings page uses editable form fields and stores preferences through `ctx.storage`.

The dashboard stores refresh counts and last inventory metadata in Termy-managed plugin storage.

The schema renderer shows stat grids, lists with row actions, tables, dividers, markdown, empty states, and forms.

## Build

```sh
npm install
npm run typecheck
npm test
npm run pack:plugin
```

The installable plugin zip is written to:

```text
release/host-ops-cockpit-v0.2.0.termy-plugin.zip
```

## Source shape

```text
manifest.json
src/index.ts
dist/index.js
README.md
LICENSE
```

`dist/index.js` is committed so the repository folder can be installed directly in Termy. Run `npm run build` after changing `src/index.ts`.

Termy v1 expects the compiled entry to keep this shape:

```ts
import { definePlugin } from "@apolanski13/termy-sdk";

export default definePlugin({
  activate(ctx) {}
});
```
