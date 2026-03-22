import { z } from 'zod';
import type { ToolDefinition, ToolResult, MCPServerConfig, MCPResource, MCPPrompt } from '../core/types.js';

/**
 * MCP 客户端配置
 */
export interface MCPClientConfig extends MCPServerConfig {
  /** 连接超时（毫秒） */
  connectTimeout?: number;
  /** 调用超时（毫秒） */
  callTimeout?: number;
}

/**
 * MCP Tool 定义 (来自 MCP 服务器)
 */
export interface MCPToolDefinition {
  name: string;
  description?: string;
  inputSchema?: {
    type: 'object';
    properties?: Record<string, unknown>;
    required?: string[];
  };
}

/**
 * MCP 客户端
 * 封装与 MCP 服务器的通信
 */
export class MCPClient {
  private config: MCPClientConfig;
  private connected = false;
  private process: any = null;
  private tools: MCPToolDefinition[] = [];
  private resources: MCPResource[] = [];
  private prompts: MCPPrompt[] = [];

  constructor(config: MCPClientConfig) {
    this.config = {
      connectTimeout: 30000,
      callTimeout: 60000,
      ...config
    };
  }

  /**
   * 连接到 MCP 服务器
   */
  async connect(): Promise<void> {
    if (this.connected) {
      return;
    }

    if (this.config.transport === 'stdio') {
      await this.connectStdio();
    } else {
      await this.connectHttp();
    }

    this.connected = true;
  }

  /**
   * 通过 stdio 连接
   */
  private async connectStdio(): Promise<void> {
    if (!this.config.command) {
      throw new Error('Command is required for stdio transport');
    }

    const { spawn } = await import('child_process');

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, this.config.connectTimeout);

      try {
        this.process = spawn(this.config.command!, this.config.args || [], {
          env: { ...process.env, ...this.config.env },
          stdio: ['pipe', 'pipe', 'pipe']
        });

        this.process.on('error', (err: Error) => {
          clearTimeout(timeout);
          reject(err);
        });

        // 发送初始化请求
        this.sendRequest('initialize', {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: {
            name: 'agent-sdk',
            version: '0.1.0'
          }
        }).then(() => {
          clearTimeout(timeout);
          resolve();
        }).catch((err) => {
          clearTimeout(timeout);
          reject(err);
        });
      } catch (err) {
        clearTimeout(timeout);
        reject(err);
      }
    });
  }

  /**
   * 通过 HTTP 连接
   */
  private async connectHttp(): Promise<void> {
    if (!this.config.url) {
      throw new Error('URL is required for HTTP transport');
    }

    // HTTP 连接实现
    // 这里简化处理，实际应该使用 SSE 或 WebSocket
    this.connected = true;
  }

  /**
   * 断开连接
   */
  async disconnect(): Promise<void> {
    if (!this.connected) {
      return;
    }

    if (this.process) {
      this.process.kill();
      this.process = null;
    }

    this.connected = false;
  }

  /**
   * 发送请求
   */
  private async sendRequest(method: string, params: unknown): Promise<unknown> {
    if (!this.connected && method !== 'initialize') {
      throw new Error('Not connected to MCP server');
    }

    const request = {
      jsonrpc: '2.0',
      id: Date.now(),
      method,
      params
    };

    if (this.config.transport === 'stdio' && this.process) {
      return this.sendStdioRequest(request);
    } else {
      return this.sendHttpRequest(request);
    }
  }

  /**
   * 通过 stdio 发送请求
   */
  private sendStdioRequest(request: unknown): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (!this.process?.stdin || !this.process?.stdout) {
        reject(new Error('Process not available'));
        return;
      }

      const data = JSON.stringify(request) + '\n';

      const timeout = setTimeout(() => {
        reject(new Error('Request timeout'));
      }, this.config.callTimeout);

      const handler = (chunk: Buffer) => {
        try {
          const response = JSON.parse(chunk.toString());
          if (response.id === (request as any).id) {
            clearTimeout(timeout);
            this.process.stdout.removeListener('data', handler);

            if (response.error) {
              reject(new Error(response.error.message));
            } else {
              resolve(response.result);
            }
          }
        } catch {
          // 忽略解析错误
        }
      };

      this.process.stdout.on('data', handler);
      this.process.stdin.write(data);
    });
  }

  /**
   * 通过 HTTP 发送请求
   */
  private async sendHttpRequest(request: unknown): Promise<unknown> {
    const response = await fetch(this.config.url!, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.config.headers
      },
      body: JSON.stringify(request)
    });

    const result = await response.json() as any;

    if (result.error) {
      throw new Error(result.error.message);
    }

    return result.result;
  }

  /**
   * 列出可用工具
   */
  async listTools(): Promise<MCPToolDefinition[]> {
    const result = await this.sendRequest('tools/list', {}) as any;
    this.tools = result.tools || [];
    return this.tools;
  }

  /**
   * 调用工具
   */
  async callTool(name: string, args: unknown): Promise<ToolResult> {
    try {
      const result = await this.sendRequest('tools/call', {
        name,
        arguments: args
      }) as any;

      // 将 MCP 结果转换为 ToolResult
      const content = result.content?.map((c: any) => {
        if (c.type === 'text') {
          return c.text;
        }
        if (c.type === 'image') {
          return `[Image: ${c.mimeType}]`;
        }
        return JSON.stringify(c);
      }).join('\n') || JSON.stringify(result);

      return {
        content,
        isError: result.isError || false
      };
    } catch (error) {
      return {
        content: `MCP tool error: ${error instanceof Error ? error.message : String(error)}`,
        isError: true
      };
    }
  }

  /**
   * 列出资源
   */
  async listResources(): Promise<MCPResource[]> {
    const result = await this.sendRequest('resources/list', {}) as any;
    this.resources = result.resources || [];
    return this.resources;
  }

  /**
   * 读取资源
   */
  async readResource(uri: string): Promise<{ content: string; mimeType?: string }> {
    const result = await this.sendRequest('resources/read', { uri }) as any;
    const content = result.contents?.[0];
    return {
      content: content?.text || content?.blob || '',
      mimeType: content?.mimeType
    };
  }

  /**
   * 列出 Prompts
   */
  async listPrompts(): Promise<MCPPrompt[]> {
    const result = await this.sendRequest('prompts/list', {}) as any;
    this.prompts = result.prompts || [];
    return this.prompts;
  }

  /**
   * 获取 Prompt
   */
  async getPrompt(name: string, args?: Record<string, string>): Promise<{
    messages: Array<{ role: string; content: string }>;
  }> {
    const result = await this.sendRequest('prompts/get', {
      name,
      arguments: args
    }) as any;

    return {
      messages: result.messages?.map((m: any) => ({
        role: m.role,
        content: m.content?.text || m.content || ''
      })) || []
    };
  }

  /**
   * 获取服务器名称
   */
  get name(): string {
    return this.config.name;
  }

  /**
   * 检查是否已连接
   */
  get isConnected(): boolean {
    return this.connected;
  }

  /**
   * 获取缓存的工具列表
   */
  getCachedTools(): MCPToolDefinition[] {
    return this.tools;
  }

  /**
   * 转换为本地 ToolDefinition
   */
  toToolDefinitions(): ToolDefinition[] {
    return this.tools.map(tool => ({
      name: `${this.config.name}__${tool.name}`,
      description: tool.description || `MCP tool: ${tool.name}`,
      parameters: this.convertSchema(tool.inputSchema),
      handler: async (args: unknown) => this.callTool(tool.name, args)
    }));
  }

  /**
   * 转换 JSON Schema 为 Zod Schema
   */
  private convertSchema(schema?: MCPToolDefinition['inputSchema']): z.ZodSchema {
    if (!schema || !schema.properties) {
      return z.object({}).passthrough();
    }

    const shape: Record<string, z.ZodSchema> = {};

    for (const [key, value] of Object.entries(schema.properties)) {
      const field = value as any;
      let zodField: z.ZodSchema;

      switch (field.type) {
        case 'string':
          zodField = z.string();
          break;
        case 'number':
        case 'integer':
          zodField = z.number();
          break;
        case 'boolean':
          zodField = z.boolean();
          break;
        case 'array':
          zodField = z.array(z.any());
          break;
        case 'object':
          zodField = z.object({}).passthrough();
          break;
        default:
          zodField = z.any();
      }

      if (field.description) {
        zodField = zodField.describe(field.description);
      }

      if (!schema.required?.includes(key)) {
        zodField = zodField.optional();
      }

      shape[key] = zodField;
    }

    return z.object(shape);
  }
}

/**
 * 创建 MCP 客户端
 */
export function createMCPClient(config: MCPClientConfig): MCPClient {
  return new MCPClient(config);
}
