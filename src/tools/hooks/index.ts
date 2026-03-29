export type {
  CommandHookConfig,
  FunctionHook,
  HookCommandStdin,
  HookContext,
  HookEventType,
  HookGroupConfig,
  HookResult,
  HooksSettings,
  HooksSettingsFile
} from './types.js';

export { parseHooksSettingsFile, loadHooksSettingsFromProject, loadHooksSettingsFromUser } from './loader.js';

export {
  HookManager,
  createFunctionHook,
  matchTool,
  buildHookEnv,
  mergeCommandHookLayers
} from './manager.js';

export type { FlatCommandHookEntry } from './manager.js';
