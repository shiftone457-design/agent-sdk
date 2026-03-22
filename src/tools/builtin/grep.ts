import { z } from 'zod';
import { createTool } from '../registry.js';
import type { ToolDefinition } from '../../core/types.js';

/**
 * Grep 内容搜索工具
 */
export const grepTool = createTool({
  name: 'grep',
  category: 'search',
  description:
    'Searches for patterns in file contents using regular expressions. Returns matching lines with file paths and line numbers. Supports glob filtering, context lines, and case-insensitive search. Use this when you need to find where specific text or patterns appear in the codebase.',
  parameters: z.object({
    pattern: z.string().describe('The regular expression pattern to search for'),
    path: z
      .string()
      .optional()
      .describe('The file or directory to search. Defaults to the current directory.'),
    glob: z
      .string()
      .optional()
      .describe('Filter files by glob pattern (e.g., "*.ts", "**/*.tsx")'),
    case_insensitive: z
      .boolean()
      .default(false)
      .describe('Case insensitive search (default: false)'),
    context: z
      .number()
      .int()
      .min(0)
      .default(0)
      .describe('Number of lines to show before and after each match'),
    head_limit: z
      .number()
      .int()
      .min(1)
      .optional()
      .describe('Limit output to first N results')
  }),
  handler: async ({ pattern, path: searchPath, glob, case_insensitive, context, head_limit }) => {
    try {
      const fs = await import('fs/promises');
      const pathModule = await import('path');

      const rootPath = searchPath || '.';

      // Check if rootPath is a file or directory
      let stat;
      try {
        stat = await fs.stat(rootPath);
      } catch {
        return {
          content: `Path does not exist: ${rootPath}`,
          isError: true
        };
      }

      const filesToSearch: string[] = [];

      if (stat.isFile()) {
        filesToSearch.push(rootPath);
      } else {
        // Walk directory collecting files matching glob
        const globRegex = glob
          ? new RegExp(
              '^' +
                glob
                  .replace(/\./g, '\\.')
                  .replace(/\*\*/g, '{{GLOBSTAR}}')
                  .replace(/\*/g, '[^/]*')
                  .replace(/\{\{GLOBSTAR\}\}/g, '.*')
                  .replace(/\?/g, '[^/]') +
                '$'
            )
          : null;

        async function walk(dir: string) {
          let entries;
          try {
            entries = await fs.readdir(dir, { withFileTypes: true });
          } catch {
            return;
          }

          for (const entry of entries) {
            if (entry.name.startsWith('.')) continue;
            const fullPath = pathModule.join(dir, entry.name);

            if (entry.isDirectory()) {
              // Skip common non-source directories
              if (['node_modules', '.git', 'dist', 'build', '__pycache__'].includes(entry.name)) {
                continue;
              }
              await walk(fullPath);
            } else if (entry.isFile()) {
              if (globRegex) {
                const relative = pathModule.relative(rootPath, fullPath).split(pathModule.sep).join('/');
                if (!globRegex.test(relative)) continue;
              }
              filesToSearch.push(fullPath);
            }
          }
        }

        await walk(rootPath);
      }

      // Compile regex
      let regex: RegExp;
      try {
        regex = new RegExp(pattern, case_insensitive ? 'i' : '');
      } catch (e) {
        return {
          content: `Invalid regex pattern: ${e instanceof Error ? e.message : String(e)}`,
          isError: true
        };
      }

      const results: string[] = [];
      let totalMatches = 0;

      for (const filePath of filesToSearch) {
        let content: string;
        try {
          content = await fs.readFile(filePath, 'utf-8');
        } catch {
          continue; // Skip binary or unreadable files
        }

        const lines = content.split('\n');
        const displayPath = pathModule.relative(rootPath, filePath).split(pathModule.sep).join('/');

        for (let i = 0; i < lines.length; i++) {
          if (regex.test(lines[i])) {
            totalMatches++;

            if (context > 0) {
              const start = Math.max(0, i - context);
              const end = Math.min(lines.length - 1, i + context);

              if (start < i) {
                for (let j = start; j < i; j++) {
                  results.push(`${displayPath}:${j + 1}-${lines[j]}`);
                }
              }
              results.push(`${displayPath}:${i + 1}:${lines[i]}`);
              if (end > i) {
                for (let j = i + 1; j <= end; j++) {
                  results.push(`${displayPath}:${j + 1}-${lines[j]}`);
                }
              }
              results.push('--');
            } else {
              results.push(`${displayPath}:${i + 1}:${lines[i]}`);
            }

            if (head_limit && totalMatches >= head_limit) break;
          }
        }

        if (head_limit && totalMatches >= head_limit) break;
      }

      if (results.length === 0) {
        return { content: 'No matches found' };
      }

      // Remove trailing separator
      if (results[results.length - 1] === '--') {
        results.pop();
      }

      const output = results.join('\n');
      const suffix =
        head_limit && totalMatches >= head_limit
          ? `\n\n(Showing first ${head_limit} matches)`
          : `\n\n(${totalMatches} matches)`;

      return { content: output + suffix };
    } catch (error) {
      return {
        content: `Error searching: ${error instanceof Error ? error.message : String(error)}`,
        isError: true
      };
    }
  }
});

/**
 * 获取 Grep 工具
 */
export function getGrepTools(): ToolDefinition[] {
  return [grepTool];
}
