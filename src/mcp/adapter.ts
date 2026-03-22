import type { ToolDefinition, ToolResult } from '../core/types.js';
import { MCPClient, type MCPToolDefinition, type MCPClientConfig } from './client.js';

/**
 * MCP 适配器
 * 管理多个 MCP 客户端，将 MCP 工具转换为本地工具
 */
export class MCPAdapter {
  private clients: Map<string, MCPClient> = new Map();
  private toolMap: Map<string, { client: MCPClient; toolName: string }> = new Map();

  /**
   * 添加 MCP 服务器
   */
  async addServer(config: MCPClientConfig): Promise<void> {
    if (this.clients.has(config.name)) {
      throw new Error(`MCP server "${config.name}" already exists`);
    }

    const client = new MCPClient(config);
    await client.connect();

    this.clients.set(config.name, client);

    // 列出工具并建立映射
    const tools = await client.listTools();
    for (const tool of tools) {
      const fullName = `${config.name}__${tool.name}`;
      this.toolMap.set(fullName, { client, toolName: tool.name });
    }
  }

  /**
   * 移除 MCP 服务器
   */
  async removeServer(name: string): Promise<void> {
    const client = this.clients.get(name);
    if (!client) {
      return;
    }

    // 移除工具映射
    for (const [fullName, { client: c }] of this.toolMap.entries()) {
      if (c === client) {
        this.toolMap.delete(fullName);
      }
    }

    await client.disconnect();
    this.clients.delete(name);
  }

  /**
   * 获取所有工具定义
   */
  getToolDefinitions(): ToolDefinition[] {
    const tools: ToolDefinition[] = [];

    for (const client of this.clients.values()) {
      tools.push(...client.toToolDefinitions());
    }

    return tools;
  }

  /**
   * 执行工具
   */
  async executeTool(fullName: string, args: unknown): Promise<ToolResult> {
    const mapping = this.toolMap.get(fullName);
    if (!mapping) {
      return {
        content: `MCP tool "${fullName}" not found`,
        isError: true
      };
    }

    return mapping.client.callTool(mapping.toolName, args);
  }

  /**
   * 获取客户端
   */
  getClient(name: string): MCPClient | undefined {
    return this.clients.get(name);
  }

  /**
   * 获取所有客户端名称
   */
  getServerNames(): string[] {
    return Array.from(this.clients.keys());
  }

  /**
   * 检查是否已连接
   */
  isConnected(name: string): boolean {
    const client = this.clients.get(name);
    return client?.isConnected || false;
  }

  /**
   * 断开所有连接
   */
  async disconnectAll(): Promise<void> {
    for (const client of this.clients.values()) {
      await client.disconnect();
    }
    this.clients.clear();
    this.toolMap.clear();
  }

  /**
   * 列出所有服务器的工具
   */
  async listAllTools(): Promise<Map<string, MCPToolDefinition[]>> {
    const result = new Map<string, MCPToolDefinition[]>();

    for (const [name, client] of this.clients) {
      const tools = await client.listTools();
      result.set(name, tools);
    }

    return result;
  }

  /**
   * 列出所有资源
   */
  async listAllResources(): Promise<Map<string, Awaited<ReturnType<MCPClient['listResources']>>>> {
    const result = new Map();

    for (const [name, client] of this.clients) {
      const resources = await client.listResources();
      result.set(name, resources);
    }

    return result;
  }

  /**
   * 获取服务器数量
   */
  get size(): number {
    return this.clients.size;
  }
}

/**
 * 创建 MCP 适配器
 */
export function createMCPAdapter(): MCPAdapter {
  return new MCPAdapter();
}
