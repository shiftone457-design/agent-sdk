import { z } from 'zod';
import { createTool } from '../registry.js';
import type { ToolDefinition } from '../../core/types.js';

/**
 * HTTP 请求工具
 */
export const httpRequestTool = createTool({
  name: 'http_request',
  description: 'Make an HTTP request',
  parameters: z.object({
    url: z.string().url().describe('The URL to request'),
    method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'])
      .default('GET')
      .describe('HTTP method'),
    headers: z.record(z.string()).optional().describe('Request headers'),
    body: z.union([z.string(), z.record(z.any())]).optional().describe('Request body'),
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
        content: JSON.stringify({
          status: response.status,
          statusText: response.statusText,
          headers: responseHeaders,
          body: responseBody
        }, null, 2)
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
 * 获取网页内容工具
 */
export const fetchWebpageTool = createTool({
  name: 'fetch_webpage',
  description: 'Fetch and extract text content from a webpage',
  parameters: z.object({
    url: z.string().url().describe('The URL to fetch'),
    extract: z.enum(['text', 'html', 'markdown']).default('text').describe('Content extraction mode')
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

      // 简单的 HTML 到文本转换
      const text = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      if (extract === 'text') {
        return { content: text };
      }

      // markdown 模式（简化版）
      const markdown = html
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
 * 下载文件工具
 */
export const downloadFileTool = createTool({
  name: 'download_file',
  description: 'Download a file from a URL',
  parameters: z.object({
    url: z.string().url().describe('The URL to download from'),
    outputPath: z.string().describe('The path to save the file')
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
      
      // 确保目录存在
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
  return [
    httpRequestTool,
    fetchWebpageTool,
    downloadFileTool
  ];
}
