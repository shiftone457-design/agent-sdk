import { z } from 'zod';
import { createTool } from '../registry.js';
import type { ToolDefinition } from '../../core/types.js';

/**
 * 读取文件工具
 */
export const readFileTool = createTool({
  name: 'read_file',
  description: 'Read the contents of a file',
  parameters: z.object({
    path: z.string().describe('The path to the file to read')
  }),
  handler: async ({ path }) => {
    try {
      const fs = await import('fs/promises');
      const content = await fs.readFile(path, 'utf-8');
      return { content };
    } catch (error) {
      return {
        content: `Error reading file: ${error instanceof Error ? error.message : String(error)}`,
        isError: true
      };
    }
  }
});

/**
 * 写入文件工具
 */
export const writeFileTool = createTool({
  name: 'write_file',
  description: 'Write content to a file (creates or overwrites)',
  parameters: z.object({
    path: z.string().describe('The path to the file to write'),
    content: z.string().describe('The content to write to the file')
  }),
  handler: async ({ path, content }) => {
    try {
      const fs = await import('fs/promises');
      const pathModule = await import('path');
      
      // 确保目录存在
      const dir = pathModule.dirname(path);
      await fs.mkdir(dir, { recursive: true });
      
      await fs.writeFile(path, content, 'utf-8');
      return { content: `Successfully wrote to ${path}` };
    } catch (error) {
      return {
        content: `Error writing file: ${error instanceof Error ? error.message : String(error)}`,
        isError: true
      };
    }
  }
});

/**
 * 列出目录文件工具
 */
export const listFilesTool = createTool({
  name: 'list_files',
  description: 'List files and directories in a path',
  parameters: z.object({
    path: z.string().default('.').describe('The directory path to list'),
    recursive: z.boolean().default(false).describe('Whether to list recursively'),
    pattern: z.string().optional().describe('Glob pattern to filter files')
  }),
  handler: async ({ path, recursive, pattern }) => {
    try {
      const fs = await import('fs/promises');
      const pathModule = await import('path');

      async function listDir(dirPath: string, prefix: string = ''): Promise<string[]> {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        const results: string[] = [];

        for (const entry of entries) {
          const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
          
          if (entry.isDirectory()) {
            results.push(`${relativePath}/`);
            if (recursive) {
              const subResults = await listDir(
                pathModule.join(dirPath, entry.name),
                relativePath
              );
              results.push(...subResults);
            }
          } else {
            results.push(relativePath);
          }
        }

        return results;
      }

      let files = await listDir(path);

      // 应用 glob 模式过滤
      if (pattern) {
        const regex = new RegExp(
          pattern.replace(/\*/g, '.*').replace(/\?/g, '.')
        );
        files = files.filter(f => regex.test(f));
      }

      return {
        content: files.length > 0 
          ? files.join('\n') 
          : 'No files found'
      };
    } catch (error) {
      return {
        content: `Error listing files: ${error instanceof Error ? error.message : String(error)}`,
        isError: true
      };
    }
  }
});

/**
 * 删除文件工具
 */
export const deleteFileTool = createTool({
  name: 'delete_file',
  description: 'Delete a file or empty directory',
  parameters: z.object({
    path: z.string().describe('The path to delete'),
    recursive: z.boolean().default(false).describe('Delete directories recursively')
  }),
  handler: async ({ path, recursive }) => {
    try {
      const fs = await import('fs/promises');
      await fs.rm(path, { recursive, force: true });
      return { content: `Successfully deleted ${path}` };
    } catch (error) {
      return {
        content: `Error deleting: ${error instanceof Error ? error.message : String(error)}`,
        isError: true
      };
    }
  }
});

/**
 * 检查文件是否存在工具
 */
export const fileExistsTool = createTool({
  name: 'file_exists',
  description: 'Check if a file or directory exists',
  parameters: z.object({
    path: z.string().describe('The path to check')
  }),
  handler: async ({ path }) => {
    try {
      const fs = await import('fs/promises');
      await fs.access(path);
      return { content: `Path exists: ${path}` };
    } catch {
      return { content: `Path does not exist: ${path}` };
    }
  }
});

/**
 * 获取所有文件系统工具
 */
export function getFileSystemTools(): ToolDefinition[] {
  return [
    readFileTool,
    writeFileTool,
    listFilesTool,
    deleteFileTool,
    fileExistsTool
  ];
}
