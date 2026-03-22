import { z } from 'zod';
import { createTool } from '../registry.js';
import type { ToolDefinition } from '../../core/types.js';

/**
 * HTTP 请求工具
 */
export const httpRequestTool = createTool({
  name: 'http_request',
  category: 'web',
  description:
    'Makes an HTTP request to the specified URL. Use this for calling APIs, testing endpoints, or sending data to web services. Supports all standard HTTP methods with headers, body, and timeout configuration.',
  parameters: z.object({
    url: z.string().url().describe('The URL to request'),
    method: z
      .enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'])
      .default('GET')
      .describe('HTTP method'),
    headers: z.record(z.string()).optional().describe('Request headers'),
    body: z
      .union([z.string(), z.record(z.any())])
      .optional()
      .describe('Request body (string or JSON object)'),
    timeout: z.number().optional().default(30000).describe('Timeout in milliseconds')
  }),
  handler: async ({ url, method, headers, body, timeout }) => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const requestOptions: RequestInit = {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers
        },
        signal: controller.signal
      };

      if (body && method !== 'GET' && method !== 'HEAD') {
        requestOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
      }

      const response = await fetch(url, requestOptions);
      clearTimeout(timeoutId);

      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      let responseBody: string;
      const contentType = response.headers.get('content-type') || '';

      if (contentType.includes('application/json')) {
        const json = await response.json();
        responseBody = JSON.stringify(json, null, 2);
      } else {
        responseBody = await response.text();
      }

      return {
        content: JSON.stringify(
          {
            status: response.status,
            statusText: response.statusText,
            headers: responseHeaders,
            body: responseBody
          },
          null,
          2
        )
      };
    } catch (error) {
      return {
        content: `HTTP request failed: ${error instanceof Error ? error.message : String(error)}`,
        isError: true
      };
    }
  }
});

/**
 * Web Fetch 工具
 */
export const webFetchTool = createTool({
  name: 'web_fetch',
  category: 'web',
  description:
    'Fetches content from a URL and converts it to readable markdown. Use this tool when you need to read documentation, articles, or any web page content. Auto-upgrades HTTP to HTTPS. Supports text, html, and markdown extraction modes.',
  parameters: z.object({
    url: z.string().url().describe('The fully-formed URL to fetch'),
    extract: z
      .enum(['text', 'html', 'markdown'])
      .default('markdown')
      .describe('Content extraction mode. "markdown" converts HTML to markdown format.')
  }),
  handler: async ({ url, extract }) => {
    try {
      const response = await fetch(url);

      if (!response.ok) {
        return {
          content: `Failed to fetch: ${response.status} ${response.statusText}`,
          isError: true
        };
      }

      const html = await response.text();

      if (extract === 'html') {
        return { content: html };
      }

      // Strip script and style tags, then convert to text
      const text = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      if (extract === 'text') {
        return { content: text };
      }

      // markdown mode
      const markdown = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n')
        .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n')
        .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n')
        .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
        .replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
        .replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)')
        .replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`')
        .replace(/<pre[^>]*>(.*?)<\/pre>/gi, '```\n$1\n```')
        .replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n')
        .replace(/<[^>]+>/g, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

      return { content: markdown };
    } catch (error) {
      return {
        content: `Error fetching webpage: ${error instanceof Error ? error.message : String(error)}`,
        isError: true
      };
    }
  }
});

/**
 * Web 搜索工具
 */
export const webSearchTool = createTool({
  name: 'web_search',
  category: 'web',
  description:
    'Performs a web search for the given query and returns relevant results. Use this tool to find current information on the web, research documentation, or find solutions to problems. Returns a list of results with titles, URLs, and snippets. Requires a search handler to be configured.',
  parameters: z.object({
    query: z.string().describe('The search query string'),
    max_results: z
      .number()
      .int()
      .min(1)
      .max(20)
      .default(5)
      .describe('Maximum number of results to return (default: 5)')
  }),
  handler: async ({ query, max_results }) => {
    // This is a pluggable tool — the default implementation provides a helpful message.
    // Users should register their own web_search tool with a real search provider,
    // or use the searchHandler config option.
    return {
      content: `Web search is not configured. To enable web_search, register a custom tool with your preferred search provider (e.g., Exa, Brave, Google, DuckDuckGo). Query was: "${query}" (max_results: ${max_results})`,
      isError: true
    };
  }
});

/**
 * 下载文件工具
 */
export const downloadFileTool = createTool({
  name: 'download_file',
  category: 'web',
  description:
    'Downloads a file from a URL and saves it to the local filesystem. Use this to download images, archives, datasets, or any other files from the internet. Creates parent directories automatically.',
  parameters: z.object({
    url: z.string().url().describe('The URL to download from'),
    outputPath: z.string().describe('The absolute path to save the downloaded file')
  }),
  handler: async ({ url, outputPath }) => {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');

      const response = await fetch(url);

      if (!response.ok) {
        return {
          content: `Download failed: ${response.status} ${response.statusText}`,
          isError: true
        };
      }

      const buffer = await response.arrayBuffer();

      const dir = path.dirname(outputPath);
      await fs.mkdir(dir, { recursive: true });

      await fs.writeFile(outputPath, Buffer.from(buffer));

      return {
        content: `Successfully downloaded ${url} to ${outputPath} (${buffer.byteLength} bytes)`
      };
    } catch (error) {
      return {
        content: `Download failed: ${error instanceof Error ? error.message : String(error)}`,
        isError: true
      };
    }
  }
});

/**
 * 获取所有 Web 工具
 */
export function getWebTools(): ToolDefinition[] {
  return [httpRequestTool, webFetchTool, webSearchTool, downloadFileTool];
}
