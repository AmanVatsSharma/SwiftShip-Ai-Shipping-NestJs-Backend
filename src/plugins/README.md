# SwiftShip AI Plugin System

## Overview
This directory contains the core plugin system for the SwiftShip AI backend. The plugin system allows you to extend the platform with new business logic, integrations, and UI components for the owner panel, all via dynamically loaded plugins.

## How It Works
- Plugins are TypeScript/JavaScript modules that implement the `Plugin` interface.
- The `PluginManagerService` discovers and loads all plugins in the `src/plugins/` directory at startup.
- Plugins can register hooks for initialization, enable, and disable events.
- Plugins can declare required permissions, dependencies, and UI components for the owner panel.

## GraphQL API

### Queries
- `plugins`: List all loaded plugins (with enabled status)
- `enabledPlugins`: List only enabled plugins
- `uiPluginComponents`: List all UI plugin components from enabled plugins (for frontend/owner panel)
- `pluginDependencyStatus(name: String!)`: Get dependency status for a plugin

### Mutations
- `enablePlugin(name: String!)`: Enable a plugin by name
- `disablePlugin(name: String!)`: Disable a plugin by name

#### Example
```graphql
mutation {
  enablePlugin(name: "example-plugin")
}

mutation {
  disablePlugin(name: "example-plugin")
}

query {
  plugins {
    name
    version
    enabled
  }
  enabledPlugins {
    name
    version
    enabled
  }
  uiPluginComponents {
    id
    name
    description
    route
  }
  pluginDependencyStatus(name: "example-plugin") {
    name
    dependenciesMet
    missingDependencies
  }
}
```

## Creating a Plugin
1. **Create a new file** in `src/plugins/` with the `.plugin.ts` extension (e.g., `my-feature.plugin.ts`).
2. **Export an object** that implements the `Plugin` interface:

```ts
import { Plugin } from './plugin.interface';

const MyPlugin: Plugin = {
  name: 'my-plugin',
  version: '1.0.0',
  author: 'Your Name',
  description: 'A description of what this plugin does.',
  requiredPermissions: ['admin'],
  dependencies: [],
  uiComponents: [
    {
      id: 'my-widget',
      name: 'My Widget',
      route: '/admin/my-widget',
    },
  ],
  onRegister() {
    // Initialization logic
  },
  onEnable() {
    // Enable logic
  },
  onDisable() {
    // Disable logic
  },
};

export = MyPlugin;
```

## Plugin Lifecycle
- **onRegister:** Called when the plugin is loaded by the system.
- **onEnable:** Called when the plugin is enabled (can be used to start services, register endpoints, etc.).
- **onDisable:** Called when the plugin is disabled (cleanup, shutdown, etc.).

## Managing Plugins
- All plugins in this directory with `.plugin.ts` or `.plugin.js` extensions are auto-discovered.
- Use the GraphQL API to list, enable, or disable plugins programmatically.
- Use the `PluginManagerService` to manage plugins in code.

## Example
See `example.plugin.ts` for a sample plugin implementation.

## Roadmap
- Dynamic plugin install/uninstall
- Hot-reload support
- Plugin API for UI registry and management
- Security sandboxing for untrusted plugins

## Plugin Dependency Checks
- Plugins can declare dependencies on other plugins via the `dependencies` field.
- A plugin can only be enabled if all its dependencies are present and enabled.
- Use the `pluginDependencyStatus` query to check if a plugin's dependencies are met.

---
For more details, see the main project [ROADMAP.md](../../ROADMAP.md).