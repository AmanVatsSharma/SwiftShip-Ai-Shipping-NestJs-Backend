import { Injectable, Logger } from '@nestjs/common';
import { Plugin } from './plugin.interface';
import * as path from 'path';
import * as fs from 'fs';

export interface PluginDependencyStatus {
  name: string;
  dependenciesMet: boolean;
  missingDependencies: string[];
}

@Injectable()
export class PluginManagerService {
  private readonly logger = new Logger(PluginManagerService.name);
  private plugins: Plugin[] = [];
  private pluginDir = path.join(__dirname, '');

  constructor() {
    this.discoverAndLoadPlugins();
  }

  /**
   * Discover and load all plugins from the plugins directory
   */
  discoverAndLoadPlugins() {
    const pluginsPath = path.join(process.cwd(), 'src', 'plugins');
    if (!fs.existsSync(pluginsPath)) {
      this.logger.warn(`Plugins directory does not exist: ${pluginsPath}`);
      return;
    }
    const files = fs.readdirSync(pluginsPath);
    for (const file of files) {
      if (file.endsWith('.plugin.js') || file.endsWith('.plugin.ts')) {
        const pluginPath = path.join(pluginsPath, file);
        try {
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const pluginModule = require(pluginPath);
          const plugin: Plugin = pluginModule.default || pluginModule;
          if (plugin && plugin.name && plugin.version) {
            this.plugins.push(plugin);
            plugin.onRegister?.();
            this.logger.log(`Loaded plugin: ${plugin.name} v${plugin.version}`);
          } else {
            this.logger.warn(`Invalid plugin file: ${file}`);
          }
        } catch (err) {
          this.logger.error(`Failed to load plugin ${file}:`, err);
        }
      }
    }
  }

  /**
   * Get all loaded plugins
   */
  getPlugins(): Plugin[] {
    return this.plugins;
  }

  /**
   * Check if a plugin's dependencies are met
   */
  getPluginDependencyStatus(name: string): PluginDependencyStatus {
    const plugin = this.plugins.find(p => p.name === name);
    if (!plugin) {
      return { name, dependenciesMet: false, missingDependencies: [] };
    }
    const missing = (plugin.dependencies || []).filter(dep => !this.plugins.some(p => p.name === dep));
    return {
      name,
      dependenciesMet: missing.length === 0,
      missingDependencies: missing,
    };
  }

  /**
   * Enable a plugin by name, only if dependencies are met
   */
  async enablePlugin(name: string): Promise<boolean> {
    const depStatus = this.getPluginDependencyStatus(name);
    if (!depStatus.dependenciesMet) {
      this.logger.warn(`Cannot enable plugin ${name}: missing dependencies: ${depStatus.missingDependencies.join(', ')}`);
      return false;
    }
    const plugin = this.plugins.find(p => p.name === name);
    if (plugin && plugin.onEnable) {
      await plugin.onEnable();
      this.logger.log(`Enabled plugin: ${plugin.name}`);
      return true;
    }
    return false;
  }

  /**
   * Disable a plugin by name
   */
  async disablePlugin(name: string): Promise<boolean> {
    const plugin = this.plugins.find(p => p.name === name);
    if (plugin && plugin.onDisable) {
      await plugin.onDisable();
      this.logger.log(`Disabled plugin: ${plugin.name}`);
      return true;
    }
    return false;
  }
} 