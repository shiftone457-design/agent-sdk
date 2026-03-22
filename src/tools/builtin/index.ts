// Built-in tools
export * from './filesystem.js';
export * from './shell.js';
export * from './grep.js';
export * from './web.js';
export * from './planning.js';
export * from './interaction.js';

import type { ToolDefinition } from '../../core/types.js';
import { getFileSystemTools } from './filesystem.js';
import { getShellTools } from './shell.js';
import { getGrepTools } from './grep.js';
import { getWebTools } from './web.js';
import { getPlanningTools } from './planning.js';
import { getInteractionTools } from './interaction.js';

/**
 * 获取所有内置工具
 */
export function getAllBuiltinTools(): ToolDefinition[] {
  return [
    ...getFileSystemTools(),
    ...getShellTools(),
    ...getGrepTools(),
    ...getWebTools(),
    ...getPlanningTools(),
    ...getInteractionTools()
  ];
}

/**
 * 获取安全的内置工具 (不含危险操作)
 */
export function getSafeBuiltinTools(): ToolDefinition[] {
  return getAllBuiltinTools().filter((tool) => !tool.isDangerous);
}
