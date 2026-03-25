import { spawn } from 'child_process';
import { z } from 'zod';
import { createTool } from '../registry.js';
import { getShellPath } from '../../core/environment.js';
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
    return new Promise((resolve) => {
      const shellPath = getShellPath();
      let stdout = '';
      let stderr = '';

      const child = spawn(command, [], {
        shell: shellPath,
        cwd,
        env: { ...process.env, ...env },
      });

      const timer = setTimeout(() => {
        child.kill();
        resolve({
          content: `${desc ? `[${desc}]\n` : ''}Command timed out after ${timeout}ms`,
          isError: true
        });
      }, timeout);

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('error', (error) => {
        clearTimeout(timer);
        resolve({
          content: `${desc ? `[${desc}]\n` : ''}Command failed: ${error.message}`,
          isError: true
        });
      });

      child.on('close', (code) => {
        clearTimeout(timer);
        const output: string[] = [];
        if (stdout) output.push(stdout);
        if (stderr) output.push(`STDERR:\n${stderr}`);

        const prefix = desc ? `[${desc}]\n` : '';
        if (code === 0) {
          resolve({
            content: prefix + (output.join('\n') || 'Command executed successfully (no output)')
          });
        } else {
          resolve({
            content: `${prefix}Command failed (exit code ${code})\n${output.join('\n')}`,
            isError: true
          });
        }
      });
    });
  }
});

/**
 * 获取所有 Shell 工具
 */
export function getShellTools(): ToolDefinition[] {
  return [bashTool];
}
