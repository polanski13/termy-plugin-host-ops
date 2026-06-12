import { definePlugin } from "@apolanski13/termy-sdk";
const paneDashboard = "ops.dashboard";
const settingsPreferences = "ops.preferences";
const actionOpenDashboard = "ops.openDashboard";
const actionRefreshDashboard = "ops.refreshDashboard";
const actionShowInventory = "ops.showInventory";
const actionInsertHealthCheck = "ops.insertHealthCheck";
const actionRunHealthCheck = "ops.runHealthCheck";
const actionShowRunbook = "ops.showRunbook";
const defaultHealthCheckCommand = "hostname; whoami; uptime; df -h; date";
const storagePreferencesKey = "preferences";
const storageRefreshCountKey = "dashboardRefreshCount";
const storageLastInventoryKey = "lastInventory";
const defaultPreferences = {
    title: "Host Ops Cockpit",
    healthCommand: defaultHealthCheckCommand,
    includeSnippets: true,
    inventoryMode: "compact"
};
const dashboardActions = [
    { id: actionRefreshDashboard, title: "Refresh", icon: "arrow.clockwise", refreshPane: true },
    { id: actionShowInventory, title: "Inventory", icon: "list.bullet.rectangle.fill" },
    { id: actionInsertHealthCheck, title: "Insert check", icon: "terminal.fill" },
    { id: actionRunHealthCheck, title: "Run check", icon: "play.fill", style: "prominent" },
    { id: actionShowRunbook, title: "Runbook", icon: "book.closed.fill" }
];
export default definePlugin({
    async activate(ctx) {
        ctx.registerPane(paneDashboard, async (event) => {
            const workspacePromise = Promise.resolve(ctx.workspace.current()).then(normalizeWorkspace);
            const [inventory, workspace, preferences, refreshCount] = await Promise.all([
                readInventory(ctx),
                workspacePromise,
                readPreferences(ctx),
                incrementRefreshCount(ctx)
            ]);
            await ctx.storage.set(storageLastInventoryKey, {
                hosts: inventory.hosts.length,
                snippets: inventory.snippets.length,
                refreshedAt: new Date().toISOString(),
                reason: event?.refreshReason ?? "initial"
            });
            return dashboardView(ctx, inventory, workspace, preferences, refreshCount, event?.refreshReason ?? "initial");
        });
        ctx.registerSettings(settingsPreferences, async (event) => {
            if (event?.formValues) {
                await savePreferences(ctx, event.formValues);
                ctx.effects.toast("Host Ops preferences saved", "success");
            }
            return settingsView(ctx, await readPreferences(ctx));
        });
        ctx.registerAction(actionOpenDashboard, () => {
            ctx.effects.toast("Opening Host Ops Cockpit", "info");
            ctx.effects.openPane(paneDashboard);
        });
        ctx.registerAction(actionRefreshDashboard, () => {
            ctx.effects.toast("Refreshing Host Ops Cockpit", "info");
        });
        ctx.registerAction(actionShowInventory, async (event) => {
            const [inventory, preferences] = await Promise.all([readInventory(ctx), readPreferences(ctx)]);
            ctx.effects.toast(inventoryToast(event, inventory), "success");
            return inventoryView(ctx, inventory, preferences, event);
        });
        ctx.registerAction(actionInsertHealthCheck, async () => {
            const preferences = await readPreferences(ctx);
            ctx.effects.toast("Health check inserted into the focused terminal", "info");
            return ctx.terminal.insert(preferences.healthCommand);
        });
        ctx.registerAction(actionRunHealthCheck, async () => {
            const preferences = await readPreferences(ctx);
            ctx.effects.toast("Health check sent to the focused terminal", "warning");
            return ctx.terminal.run(preferences.healthCommand);
        });
        ctx.registerAction(actionShowRunbook, async () => {
            const [workspace, preferences] = await Promise.all([ctx.workspace.current(), readPreferences(ctx)]);
            return runbookView(ctx, normalizeWorkspace(workspace), preferences);
        });
    }
});
async function readInventory(ctx) {
    const [hosts, snippets] = await Promise.all([ctx.hosts.list(), ctx.snippets.list()]);
    return { hosts: normalizeHosts(hosts), snippets: normalizeSnippets(snippets) };
}
async function readPreferences(ctx) {
    const stored = await ctx.storage.get(storagePreferencesKey);
    if (!stored || typeof stored !== "object" || Array.isArray(stored)) {
        return defaultPreferences;
    }
    return {
        title: stringValue(stored.title, defaultPreferences.title),
        healthCommand: stringValue(stored.healthCommand, defaultPreferences.healthCommand),
        includeSnippets: booleanValue(stored.includeSnippets, defaultPreferences.includeSnippets),
        inventoryMode: stringValue(stored.inventoryMode, defaultPreferences.inventoryMode)
    };
}
async function savePreferences(ctx, values) {
    await ctx.storage.set(storagePreferencesKey, {
        title: stringValue(values.title, defaultPreferences.title),
        healthCommand: stringValue(values.healthCommand, defaultPreferences.healthCommand),
        includeSnippets: booleanValue(values.includeSnippets, defaultPreferences.includeSnippets),
        inventoryMode: stringValue(values.inventoryMode, defaultPreferences.inventoryMode)
    });
}
async function incrementRefreshCount(ctx) {
    const current = Number((await ctx.storage.get(storageRefreshCountKey)) ?? 0);
    const next = current + 1;
    await ctx.storage.set(storageRefreshCountKey, next);
    return next;
}
function dashboardView(ctx, inventory, workspace, preferences, refreshCount, refreshReason) {
    const sections = [
        ctx.ui.markdown({
            title: preferences.title,
            body: [
                `Loaded ${inventory.hosts.length} hosts and ${inventory.snippets.length} snippets through capability-gated SDK calls.`,
                `Focused pane: ${workspace.focusedPaneKind ?? "none"}. Terminal write available: ${workspace.focusedPaneHasTerminal ? "yes" : "no"}.`,
                `Refreshes stored by this plugin: ${refreshCount}. Last reason: ${refreshReason}.`
            ].join("\n")
        }),
        ctx.ui.statGrid({
            stats: [
                { id: "hosts", title: "Hosts", value: inventory.hosts.length, tone: "accent" },
                { id: "snippets", title: "Snippets", value: inventory.snippets.length },
                { id: "refreshes", title: "Refreshes", value: refreshCount },
                { id: "terminal", title: "Focused terminal", value: workspace.focusedPaneHasTerminal ? "ready" : "not focused", tone: workspace.focusedPaneHasTerminal ? "success" : "warning" }
            ]
        }),
        workspaceList(ctx, workspace),
        ctx.ui.divider("Inventory"),
        hostsTable(ctx, inventory.hosts),
        preferences.includeSnippets ? snippetsTable(ctx, inventory.snippets) : ctx.ui.empty("Snippets hidden", "Enable snippets in plugin settings."),
        commandForm(ctx, preferences)
    ];
    return {
        ...ctx.ui.stack(sections, preferences.title),
        actions: dashboardActions
    };
}
function inventoryView(ctx, inventory, preferences, event) {
    const rowLabel = event?.row?.title ? ` Row: ${event.row.title}.` : "";
    return {
        ...ctx.ui.stack([
            ctx.ui.markdown({
                title: "Inventory",
                body: `Termy exposed ${inventory.hosts.length} hosts and ${inventory.snippets.length} snippets.${rowLabel}`
            }),
            ctx.ui.statGrid({
                stats: [
                    { id: "hosts", title: "Hosts", value: inventory.hosts.length, tone: "accent" },
                    { id: "snippets", title: "Snippets", value: inventory.snippets.length }
                ]
            }),
            hostsList(ctx, inventory.hosts, preferences),
            hostsTable(ctx, inventory.hosts),
            preferences.includeSnippets ? snippetsTable(ctx, inventory.snippets) : ctx.ui.empty("Snippets hidden", "Enable snippets in plugin settings.")
        ], "Host Ops Inventory"),
        actions: [
            { id: actionOpenDashboard, title: "Open cockpit", icon: "rectangle.grid.2x2.fill" },
            { id: actionShowRunbook, title: "Runbook", icon: "book.closed.fill" }
        ]
    };
}
function runbookView(ctx, workspace, preferences) {
    return {
        ...ctx.ui.stack([
            ctx.ui.markdown({
                title: "Safe terminal runbook",
                body: [
                    "This plugin never receives terminal scrollback, SSH credentials, Keychain data, filesystem access, or network access.",
                    "The only terminal effect is a user-triggered write to the focused terminal.",
                    "Termy prompts before running text through the terminal.write capability."
                ].join("\n")
            }),
            workspaceList(ctx, workspace),
            commandForm(ctx, preferences)
        ], "Host Ops Runbook"),
        actions: [
            { id: actionInsertHealthCheck, title: "Insert check", icon: "terminal.fill" },
            { id: actionRunHealthCheck, title: "Run check", icon: "play.fill", style: "prominent" },
            { id: actionOpenDashboard, title: "Open cockpit", icon: "rectangle.grid.2x2.fill" }
        ]
    };
}
function settingsView(ctx, preferences) {
    return ctx.ui.form({
        id: "ops.preferences.form",
        title: "Host Ops Preferences",
        fields: [
            { id: "title", title: "Dashboard title", type: "text", value: preferences.title },
            { id: "healthCommand", title: "Health check command", type: "textarea", value: preferences.healthCommand },
            { id: "includeSnippets", title: "Show snippets", type: "checkbox", value: preferences.includeSnippets },
            {
                id: "inventoryMode",
                title: "Inventory density",
                type: "select",
                value: preferences.inventoryMode,
                options: [
                    { value: "compact", title: "Compact" },
                    { value: "expanded", title: "Expanded" }
                ]
            }
        ],
        actions: [
            { id: "ops.preferences.save", title: "Save", submitFormId: "ops.preferences.form", style: "prominent" }
        ]
    });
}
function workspaceList(ctx, workspace) {
    const host = workspace.focusedHost;
    return ctx.ui.list({
        title: "Workspace context",
        items: [
            {
                id: "focused-pane",
                title: workspace.focusedPaneKind ?? "No focused pane",
                subtitle: workspace.focusedPaneHasTerminal ? "Terminal input is available" : "Terminal input is not available",
                icon: workspace.focusedPaneHasTerminal ? "terminal.fill" : "rectangle.dashed"
            },
            {
                id: "focused-host",
                title: host?.name ?? "No focused host",
                subtitle: host ? `${host.username}@${host.hostname}:${host.port}` : "Focus a host-backed pane to expose a safe host summary",
                detail: host?.osKind ?? "unknown",
                icon: "server.rack"
            }
        ]
    });
}
function hostsList(ctx, hosts, preferences) {
    if (hosts.length === 0) {
        return ctx.ui.empty("No hosts", "Create a host in Termy, then reload this pane.");
    }
    return ctx.ui.list({
        title: "Host rows",
        items: hosts.map((host) => ({
            id: host.id,
            title: host.name,
            subtitle: `${host.username}@${host.hostname}:${host.port}`,
            detail: preferences.inventoryMode === "expanded" ? host.osKind || "unknown" : undefined,
            icon: "server.rack",
            value: host.id,
            actions: [{ id: actionShowInventory, title: "Inspect", icon: "magnifyingglass", rowAction: true }]
        }))
    });
}
function hostsTable(ctx, hosts) {
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
        })),
        actions: [{ id: actionShowInventory, title: "Inventory", rowAction: true, icon: "magnifyingglass" }]
    });
}
function snippetsTable(ctx, snippets) {
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
function commandForm(ctx, preferences) {
    return ctx.ui.form({
        id: "ops.command.preview",
        title: "Focused terminal command",
        fields: [
            {
                id: "command",
                title: "Health check command",
                type: "textarea",
                value: preferences.healthCommand,
                disabled: true
            },
            {
                id: "safety",
                title: "Safety model",
                type: "text",
                value: "Inspect-only commands, sent only after a user action.",
                disabled: true
            }
        ],
        actions: [
            { id: actionInsertHealthCheck, title: "Insert check", icon: "terminal.fill" },
            { id: actionRunHealthCheck, title: "Run check", icon: "play.fill", style: "prominent" }
        ]
    });
}
function inventoryToast(event, inventory) {
    const prefix = event?.row?.title ? `${event.row.title}: ` : "";
    return `${prefix}${inventory.hosts.length} hosts, ${inventory.snippets.length} snippets`;
}
function stringValue(value, fallback) {
    return typeof value === "string" && value.trim().length > 0 ? value : fallback;
}
function booleanValue(value, fallback) {
    return typeof value === "boolean" ? value : fallback;
}
function normalizeWorkspace(value) {
    const source = isRecord(value) ? value : {};
    return {
        focusedPaneKind: nullableString(source.focusedPaneKind),
        focusedPaneHasTerminal: source.focusedPaneHasTerminal === true,
        focusedHost: normalizeHost(source.focusedHost, "focused-host")
    };
}
function normalizeHosts(value) {
    if (!Array.isArray(value)) {
        return [];
    }
    return value.flatMap((host, index) => {
        const normalized = normalizeHost(host, `host-${index + 1}`);
        return normalized ? [normalized] : [];
    });
}
function normalizeHost(value, fallbackId) {
    if (!isRecord(value)) {
        return null;
    }
    const hostname = nonEmptyString(value.hostname, "");
    const name = nonEmptyString(value.name, hostname || "Unnamed host");
    return {
        id: nonEmptyString(value.id, fallbackId),
        name,
        hostname: hostname || "unknown",
        username: nonEmptyString(value.username, "unknown"),
        port: numberValue(value.port, 22),
        osKind: nonEmptyString(value.osKind, "unknown")
    };
}
function normalizeSnippets(value) {
    if (!Array.isArray(value)) {
        return [];
    }
    return value.flatMap((snippet, index) => {
        const normalized = normalizeSnippet(snippet, `snippet-${index + 1}`);
        return normalized ? [normalized] : [];
    });
}
function normalizeSnippet(value, fallbackId) {
    if (!isRecord(value)) {
        return null;
    }
    return {
        id: nonEmptyString(value.id, fallbackId),
        name: nonEmptyString(value.name, "Unnamed snippet"),
        command: nonEmptyString(value.command, ""),
        tags: Array.isArray(value.tags) ? value.tags.flatMap((tag) => typeof tag === "string" ? [tag] : []) : []
    };
}
function isRecord(value) {
    return !!value && typeof value === "object" && !Array.isArray(value);
}
function nullableString(value) {
    return typeof value === "string" && value.trim().length > 0 ? value : null;
}
function nonEmptyString(value, fallback) {
    return typeof value === "string" && value.trim().length > 0 ? value : fallback;
}
function numberValue(value, fallback) {
    return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
