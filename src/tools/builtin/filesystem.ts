import { z } from 'zod';
import { createTool } from '../registry.js';
import type { ToolDefinition } from '../../core/types.js';

/**
 * 读取文件工具
 */
export const readFileTool = createTool({
  name: 'read_file',
  category: 'filesystem',
  description:
    'Reads the contents of a given file. Use this tool when you want to see what is inside a file. Outputs with cat -n style line numbers. Lines longer than 2000 characters are truncated. Use the offset and limit parameters to read specific line ranges of large files.',
  parameters: z.object({
    path: z.string().describe('The absolute path to the file to read'),
    offset: z
      .number()
      .int()
      .min(1)
      .optional()
      .describe('The line number to start reading from (1-indexed)'),
    limit: z
      .number()
      .int()
      .min(1)
      .optional()
      .describe('The number of lines to read. Defaults to 2000.')
  }),
  handler: async ({ path, offset, limit }) => {
    try {
      const fs = await import('fs/promises');
      const content = await fs.readFile(path, 'utf-8');
      const lines = content.split('\n');

      const start = offset ? offset - 1 : 0;
      const end = limit ? start + limit : Math.min(start + 2000, lines.length);
      const selectedLines = lines.slice(start, end);

      const numbered = selectedLines
        .map((line, i) => `${String(start + i + 1).padStart(5)}\t${line}`)
        .join('\n');

      const suffix =
        end < lines.length
          ? `\n... (${lines.length - end} more lines remaining)`
          : '';

      return { content: numbered + suffix };
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
  category: 'filesystem',
  description:
    'Writes a file to the local filesystem. Prefer to use the edit tool over write_file when making targeted changes to existing files. For new files, use write_file directly. Parent directories are created automatically.',
  parameters: z.object({
    path: z.string().describe('The absolute path to the file to write'),
    content: z.string().describe('The content to write to the file')
  }),
  handler: async ({ path, content }) => {
    try {
      const fs = await import('fs/promises');
      const pathModule = await import('path');

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
 * 编辑文件工具
 */
export const editTool = createTool({
  name: 'edit',
  category: 'filesystem',
  description:
    'Makes targeted edits to a specific file by replacing exact text strings. You must use read_file to view the file contents before editing. The old_string must uniquely identify the location to edit (must appear exactly once in the file), unless replace_all is true.',
  parameters: z.object({
    file_path: z.string().describe('The absolute path to the file to edit'),
    old_string: z.string().describe('The exact text to find and replace'),
    new_string: z.string().describe('The replacement text (must differ from old_string)'),
    replace_all: z
      .boolean()
      .default(false)
      .describe('Replace all occurrences of old_string (default: false)')
  }),
  handler: async ({ file_path, old_string, new_string, replace_all }) => {
    try {
      if (old_string === new_string) {
        return {
          content: 'old_string and new_string must be different',
          isError: true
        };
      }

      const fs = await import('fs/promises');
      const content = await fs.readFile(file_path, 'utf-8');

      if (!content.includes(old_string)) {
        return {
          content: `old_string not found in ${file_path}`,
          isError: true
        };
      }

      if (!replace_all) {
        const occurrences = content.split(old_string).length - 1;
        if (occurrences > 1) {
          return {
            content: `Found ${occurrences} matches for old_string. Provide more context to make it unique, or set replace_all to true.`,
            isError: true
          };
        }
      }

      const newContent = replace_all
        ? content.replaceAll(old_string, new_string)
        : content.replace(old_string, new_string);

      await fs.writeFile(file_path, newContent, 'utf-8');

      const occurrences = replace_all
        ? content.split(old_string).length - 1
        : 1;
      return {
        content: `Successfully edited ${file_path} (${occurrences} replacement${occurrences > 1 ? 's' : ''})`
      };
    } catch (error) {
      return {
        content: `Error editing file: ${error instanceof Error ? error.message : String(error)}`,
        isError: true
      };
    }
  }
});

/**
 * 列出目录文件工具
 */
export const listDirectoryTool = createTool({
  name: 'list_directory',
  category: 'filesystem',
  description:
    'Lists files and subdirectories directly within a specified path. Use this to explore directory structures and understand the layout of a codebase. Supports ignore patterns to exclude unwanted entries.',
  parameters: z.object({
    path: z.string().default('.').describe('The absolute directory path to list'),
    recursive: z.boolean().default(false).describe('Whether to list recursively'),
    ignore: z
      .array(z.string())
      .optional()
      .describe('Glob patterns to exclude from results (e.g., ["node_modules", ".git"])')
  }),
  handler: async ({ path, recursive, ignore }) => {
    try {
      const fs = await import('fs/promises');
      const pathModule = await import('path');

      function shouldIgnore(name: string): boolean {
        if (!ignore) return false;
        return ignore.some((pattern: string) => {
          const regex = new RegExp(
            '^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$'
          );
          return regex.test(name);
        });
      }

      async function listDir(dirPath: string, prefix: string = ''): Promise<string[]> {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        const results: string[] = [];

        for (const entry of entries) {
          if (shouldIgnore(entry.name)) continue;

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

      const files = await listDir(path);

      return {
        content: files.length > 0 ? files.join('\n') : 'No files found'
      };
    } catch (error) {
      return {
        content: `Error listing directory: ${error instanceof Error ? error.message : String(error)}`,
        isError: true
      };
    }
  }
});

/**
 * Glob 文件搜索工具
 */
export const globTool = createTool({
  name: 'glob',
  category: 'filesystem',
  description:
    'Searches for files matching a glob pattern. Fast file pattern matching that works with any codebase size. Returns matching file paths sorted by modification time. Use this tool when you need to find files by name patterns like **/*.ts or src/**/*.tsx.',
  parameters: z.object({
    pattern: z
      .string()
      .describe('The glob pattern to match (e.g., "**/*.ts", "src/**/*.tsx")'),
    path: z
      .string()
      .optional()
      .describe('The directory to search in. Defaults to the current working directory.')
  }),
  handler: async ({ pattern, path: searchPath }) => {
    try {
      const fs = await import('fs/promises');
      const pathModule = await import('path');

      const rootDir = searchPath || '.';

      // Convert glob pattern to regex
      const regexStr = pattern
        .replace(/\./g, '\\.')
        .replace(/\*\*/g, '{{GLOBSTAR}}')
        .replace(/\*/g, '[^/]*')
        .replace(/\{\{GLOBSTAR\}\}/g, '.*')
        .replace(/\?/g, '[^/]');
      const regex = new RegExp(`^${regexStr}$`);

      const matches: Array<{ path: string; mtime: number }> = [];

      async function walk(dir: string) {
        let entries;
        try {
          entries = await fs.readdir(dir, { withFileTypes: true });
        } catch {
          return;
        }

        for (const entry of entries) {
          // Skip dotfiles unless pattern explicitly targets them (starts with '.' or contains '/.')
          if (entry.name.startsWith('.') && !pattern.startsWith('.') && !pattern.includes('/.')) continue;

          const fullPath = pathModule.join(dir, entry.name);
          const relativePath = pathModule.relative(rootDir, fullPath);

          if (entry.isDirectory()) {
            await walk(fullPath);
          } else if (entry.isFile()) {
            const normalized = relativePath.split(pathModule.sep).join('/');
            if (regex.test(normalized)) {
              const stat = await fs.stat(fullPath);
              matches.push({ path: fullPath, mtime: stat.mtimeMs });
            }
          }
        }
      }

      await walk(rootDir);

      matches.sort((a, b) => b.mtime - a.mtime);

      return {
        content: matches.length > 0 ? matches.map((m) => m.path).join('\n') : 'No files found'
      };
    } catch (error) {
      return {
        content: `Error searching files: ${error instanceof Error ? error.message : String(error)}`,
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
  category: 'filesystem',
  description:
    'Deletes a file or directory. Use with caution as this operation cannot be undone. Set recursive to true to delete non-empty directories.',
  parameters: z.object({
    path: z.string().describe('The absolute path to delete'),
    recursive: z
      .boolean()
      .default(false)
      .describe('Delete directories recursively (required for non-empty directories)')
  }),
  isDangerous: true,
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
 * 获取所有文件系统工具
 */
export function getFileSystemTools(): ToolDefinition[] {
  return [
    readFileTool,
    writeFileTool,
    editTool,
    globTool,
    listDirectoryTool,
    deleteFileTool
  ];
}
