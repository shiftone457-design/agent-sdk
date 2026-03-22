import { z } from 'zod';
import { createTool } from '../registry.js';
import type { ToolDefinition } from '../../core/types.js';

/**
 * 执行 Shell 命令工具
 */
export const executeCommandTool = createTool({
  name: 'execute_command',
  description: 'Execute a shell command',
  parameters: z.object({
    command: z.string().describe('The command to execute'),
    cwd: z.string().optional().describe('Working directory'),
    timeout: z.number().optional().default(30000).describe('Timeout in milliseconds'),
    env: z.record(z.string()).optional().describe('Environment variables')
  }),
  isDangerous: true,
  handler: async ({ command, cwd, timeout, env }) => {
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

      const output = [];
      if (result.stdout) output.push(`STDOUT:\n${result.stdout}`);
      if (result.stderr) output.push(`STDERR:\n${result.stderr}`);

      return {
        content: output.join('\n\n') || 'Command executed successfully (no output)'
      };
    } catch (error: any) {
      const output = [];
      if (error.stdout) output.push(`STDOUT:\n${error.stdout}`);
      if (error.stderr) output.push(`STDERR:\n${error.stderr}`);

      return {
        content: `Command failed: ${error.message}\n${output.join('\n')}`,
        isError: true
      };
    }
  }
});

/**
 * 运行 Python 脚本工具
 */
export const runPythonTool = createTool({
  name: 'run_python',
  description: 'Run a Python script or code snippet',
  parameters: z.object({
    code: z.string().describe('The Python code to execute'),
    args: z.array(z.string()).optional().describe('Arguments to pass to the script')
  }),
  isDangerous: true,
  handler: async ({ code, args }) => {
    try {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const { writeFile, unlink } = await import('fs/promises');
      const { tmpdir } = await import('os');
      const { join } = await import('path');
      
      const execAsync = promisify(exec);
      const tempFile = join(tmpdir(), `agent_sdk_${Date.now()}.py`);
      
      await writeFile(tempFile, code, 'utf-8');
      
      try {
        const command = `python ${tempFile}${args ? ' ' + args.join(' ') : ''}`;
        const result = await execAsync(command, {
          timeout: 60000,
          encoding: 'utf-8',
          maxBuffer: 1024 * 1024 * 10
        });

        const output = [];
        if (result.stdout) output.push(result.stdout);
        if (result.stderr) output.push(`STDERR: ${result.stderr}`);

        return {
          content: output.join('\n') || 'Script executed successfully'
        };
      } finally {
        await unlink(tempFile).catch(() => {});
      }
    } catch (error: any) {
      return {
        content: `Python execution failed: ${error.message}`,
        isError: true
      };
    }
  }
});

/**
 * 运行 Node.js 脚本工具
 */
export const runNodeTool = createTool({
  name: 'run_node',
  description: 'Run a Node.js script or code snippet',
  parameters: z.object({
    code: z.string().describe('The JavaScript/TypeScript code to execute')
  }),
  isDangerous: true,
  handler: async ({ code }) => {
    try {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const { writeFile, unlink } = await import('fs/promises');
      const { tmpdir } = await import('os');
      const { join } = await import('path');
      
      const execAsync = promisify(exec);
      const tempFile = join(tmpdir(), `agent_sdk_${Date.now()}.mjs`);
      
      await writeFile(tempFile, code, 'utf-8');
      
      try {
        const result = await execAsync(`node ${tempFile}`, {
          timeout: 60000,
          encoding: 'utf-8',
          maxBuffer: 1024 * 1024 * 10
        });

        const output = [];
        if (result.stdout) output.push(result.stdout);
        if (result.stderr) output.push(`STDERR: ${result.stderr}`);

        return {
          content: output.join('\n') || 'Script executed successfully'
        };
      } finally {
        await unlink(tempFile).catch(() => {});
      }
    } catch (error: any) {
      return {
        content: `Node.js execution failed: ${error.message}`,
        isError: true
      };
    }
  }
});

/**
 * 获取所有 Shell 工具
 */
export function getShellTools(): ToolDefinition[] {
  return [
    executeCommandTool,
    runPythonTool,
    runNodeTool
  ];
}
