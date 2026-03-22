import { z } from 'zod';
import { createTool } from '../registry.js';
import type { ToolDefinition } from '../../core/types.js';

/**
 * Bash 命令执行工具
 */
export const bashTool = createTool({
  name: 'bash',
  category: 'shell',
  description:
    'Executes a given shell command in a persistent session. Use this tool to run system commands, install packages, compile code, or perform any operation that requires a shell. Each command runs in a separate process. Provide a short description of what the command does to help with debugging.',
  parameters: z.object({
    command: z.string().describe('The shell command to execute'),
    description: z
      .string()
      .optional()
      .describe('Clear 5-10 word description of what the command does'),
    cwd: z.string().optional().describe('Working directory for the command'),
    timeout: z
      .number()
      .optional()
      .default(120000)
      .describe('Timeout in milliseconds (default: 120000)'),
    env: z
      .record(z.string())
      .optional()
      .describe('Additional environment variables to set')
  }),
  isDangerous: true,
  handler: async ({ command, description: desc, cwd, timeout, env }) => {
    try {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);

      const result = await execAsync(command, {
        cwd,
        timeout,
        env: { ...process.env, ...env },
        encoding: 'utf-8',
        maxBuffer: 1024 * 1024 * 10 // 10MB
      });

      const output: string[] = [];
      if (result.stdout) output.push(result.stdout);
      if (result.stderr) output.push(`STDERR:\n${result.stderr}`);

      const prefix = desc ? `[${desc}]\n` : '';
      return {
        content: prefix + (output.join('\n') || 'Command executed successfully (no output)')
      };
    } catch (error: any) {
      const output: string[] = [];
      if (error.stdout) output.push(error.stdout);
      if (error.stderr) output.push(`STDERR:\n${error.stderr}`);

      return {
        content: `Command failed (exit code ${error.code ?? 'unknown'}): ${error.message}\n${output.join('\n')}`,
        isError: true
      };
    }
  }
});

/**
 * 获取所有 Shell 工具
 */
export function getShellTools(): ToolDefinition[] {
  return [bashTool];
}
