import { definePlugin, type HostSummary, type PluginContext, type PluginSchemaAction, type PluginViewSchema, type SnippetSummary } from "@apolanski13/termy-sdk";

const paneDashboard = "ops.dashboard";
const actionOpenDashboard = "ops.openDashboard";
const actionShowInventory = "ops.showInventory";
const actionInsertHealthCheck = "ops.insertHealthCheck";
const actionRunHealthCheck = "ops.runHealthCheck";
const actionShowRunbook = "ops.showRunbook";

const healthCheckCommand = "hostname; whoami; uptime; df -h; date";

const dashboardActions: PluginSchemaAction[] = [
  { id: actionShowInventory, title: "Inventory", icon: "list.bullet.rectangle.fill" },
  { id: actionInsertHealthCheck, title: "Insert check", icon: "terminal.fill" },
  { id: actionRunHealthCheck, title: "Run check", icon: "play.fill" },
  { id: actionShowRunbook, title: "Runbook", icon: "book.closed.fill" }
];

export default definePlugin({
  async activate(ctx) {
    ctx.registerPane(paneDashboard, async () => {
      const { hosts, snippets } = await readInventory(ctx);
      return dashboardView(ctx, hosts, snippets);
    });

    ctx.registerAction(actionOpenDashboard, () => {
      ctx.effects.toast("Opening Host Ops Cockpit", "info");
      ctx.effects.openPane(paneDashboard);
    });

    ctx.registerAction(actionShowInventory, async () => {
      const { hosts, snippets } = await readInventory(ctx);
      ctx.effects.toast(`Inventory loaded: ${hosts.length} hosts, ${snippets.length} snippets`, "success");
      return inventoryView(ctx, hosts, snippets);
    });

    ctx.registerAction(actionInsertHealthCheck, () => {
      ctx.effects.toast("Health check inserted into the focused terminal", "info");
      return ctx.terminal.insert(healthCheckCommand);
    });

    ctx.registerAction(actionRunHealthCheck, () => {
      ctx.effects.toast("Health check sent to the focused terminal", "warning");
      return ctx.terminal.run(healthCheckCommand);
    });

    ctx.registerAction(actionShowRunbook, () => {
      return runbookView(ctx);
    });
  }
});

async function readInventory(ctx: PluginContext): Promise<{ hosts: HostSummary[]; snippets: SnippetSummary[] }> {
  const [hosts, snippets] = await Promise.all([ctx.hosts.list(), ctx.snippets.list()]);
  return { hosts, snippets };
}

function dashboardView(ctx: PluginContext, hosts: HostSummary[], snippets: SnippetSummary[]): PluginViewSchema {
  const sections: PluginViewSchema[] = [
    ctx.ui.markdown({
      title: "Host Ops Cockpit",
      body: [
        `Loaded ${hosts.length} hosts and ${snippets.length} snippets from Termy.`,
        "This pane is rendered from schema returned by a TypeScript plugin.",
        "Use the actions below to open inventory, inspect the runbook, or send a safe command to the focused terminal."
      ].join("\n")
    }),
    metricsTable(ctx, hosts, snippets),
    hostsTable(ctx, hosts),
    snippetsTable(ctx, snippets),
    runbookForm(ctx)
  ];

  return {
    ...ctx.ui.stack(sections, "Host Ops Cockpit"),
    actions: dashboardActions
  };
}

function inventoryView(ctx: PluginContext, hosts: HostSummary[], snippets: SnippetSummary[]): PluginViewSchema {
  return {
    ...ctx.ui.stack(
      [
        ctx.ui.markdown({
          title: "Inventory",
          body: `Termy exposed ${hosts.length} hosts and ${snippets.length} snippets through capability-gated SDK calls.`
        }),
        hostsTable(ctx, hosts),
        snippetsTable(ctx, snippets)
      ],
      "Host Ops Inventory"
    ),
    actions: [
      { id: actionOpenDashboard, title: "Open cockpit", icon: "rectangle.grid.2x2.fill" },
      { id: actionShowRunbook, title: "Runbook", icon: "book.closed.fill" }
    ]
  };
}

function runbookView(ctx: PluginContext): PluginViewSchema {
  return {
    ...ctx.ui.stack(
      [
        ctx.ui.markdown({
          title: "Safe terminal runbook",
          body: [
            "This plugin never receives terminal scrollback, SSH credentials, Keychain data, filesystem access, or network access.",
            "The only terminal effect in this plugin is a user-triggered write to the focused terminal.",
            "Termy still prompts before running text through the terminal.write capability."
          ].join("\n")
        }),
        runbookForm(ctx)
      ],
      "Host Ops Runbook"
    ),
    actions: [
      { id: actionInsertHealthCheck, title: "Insert check", icon: "terminal.fill" },
      { id: actionRunHealthCheck, title: "Run check", icon: "play.fill" },
      { id: actionOpenDashboard, title: "Open cockpit", icon: "rectangle.grid.2x2.fill" }
    ]
  };
}

function metricsTable(ctx: PluginContext, hosts: HostSummary[], snippets: SnippetSummary[]): PluginViewSchema {
  return ctx.ui.table({
    title: "SDK surface used",
    columns: [
      { id: "feature", title: "Feature" },
      { id: "value", title: "Value" }
    ],
    rows: [
      { feature: "hosts.read", value: hosts.length },
      { feature: "snippets.read", value: snippets.length },
      { feature: "terminal.write", value: "insert and run actions" },
      { feature: "schema UI", value: "markdown, table, form, stack, empty" },
      { feature: "effects", value: "toast and openPane" }
    ]
  });
}

function hostsTable(ctx: PluginContext, hosts: HostSummary[]): PluginViewSchema {
  if (hosts.length === 0) {
    return ctx.ui.empty("No hosts", "Create a host in Termy, then reload this pane.");
  }

  return ctx.ui.table({
    title: "Hosts",
    columns: [
      { id: "name", title: "Name" },
      { id: "address", title: "Address" },
      { id: "user", title: "User" },
      { id: "port", title: "Port" },
      { id: "os", title: "OS" }
    ],
    rows: hosts.map((host) => ({
      name: host.name,
      address: host.hostname,
      user: host.username,
      port: host.port,
      os: host.osKind || "unknown"
    }))
  });
}

function snippetsTable(ctx: PluginContext, snippets: SnippetSummary[]): PluginViewSchema {
  if (snippets.length === 0) {
    return ctx.ui.empty("No snippets", "Create a snippet in Termy to see it in this plugin.");
  }

  return ctx.ui.table({
    title: "Snippets",
    columns: [
      { id: "name", title: "Name" },
      { id: "tags", title: "Tags" },
      { id: "command", title: "Command" }
    ],
    rows: snippets.map((snippet) => ({
      name: snippet.name,
      tags: snippet.tags.length === 0 ? "none" : snippet.tags.join(", "),
      command: snippet.command
    }))
  });
}

function runbookForm(ctx: PluginContext): PluginViewSchema {
  return ctx.ui.form({
    title: "Focused terminal command",
    fields: [
      {
        id: "command",
        title: "Health check command",
        value: healthCheckCommand
      },
      {
        id: "safety",
        title: "Safety model",
        value: "Inspect-only commands, sent only through Termy terminal.write after a user action."
      },
      {
        id: "runtime",
        title: "Runtime boundary",
        value: "No Node APIs, filesystem access, network access, Keychain access, credentials, or scrollback."
      }
    ],
    actions: [
      { id: actionInsertHealthCheck, title: "Insert check", icon: "terminal.fill" },
      { id: actionRunHealthCheck, title: "Run check", icon: "play.fill" }
    ]
  });
}
