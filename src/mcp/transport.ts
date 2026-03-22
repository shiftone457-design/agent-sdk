import type { MCPServerConfig } from '../core/types.js';

/**
 * 传输类型
 */
export type TransportType = 'stdio' | 'http' | 'websocket';

/**
 * 传输配置
 */
export interface TransportConfig {
  type: TransportType;
  // stdio
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  // http/websocket
  url?: string;
  headers?: Record<string, string>;
}

/**
 * 创建 stdio 传输配置
 */
export function createStdioTransport(config: {
  command: string;
  args?: string[];
  env?: Record<string, string>;
}): TransportConfig {
  return {
    type: 'stdio',
    command: config.command,
    args: config.args,
    env: config.env
  };
}

/**
 * 创建 HTTP 传输配置
 */
export function createHttpTransport(config: {
  url: string;
  headers?: Record<string, string>;
}): TransportConfig {
  return {
    type: 'http',
    url: config.url,
    headers: config.headers
  };
}

/**
 * 创建 WebSocket 传输配置
 */
export function createWebSocketTransport(config: {
  url: string;
  headers?: Record<string, string>;
}): TransportConfig {
  return {
    type: 'websocket',
    url: config.url,
    headers: config.headers
  };
}

/**
 * 从传输配置创建 MCP 服务器配置
 */
export function createMCPServerConfig(
  name: string,
  transport: TransportConfig
): MCPServerConfig {
  const config: MCPServerConfig = {
    name,
    transport: transport.type === 'websocket' ? 'http' : transport.type
  };

  if (transport.type === 'stdio') {
    config.command = transport.command;
    config.args = transport.args;
    config.env = transport.env;
  } else {
    config.url = transport.url;
    config.headers = transport.headers;
  }

  return config;
}

/**
 * 常用 MCP 服务器配置
 */
export const MCPServers = {
  /**
   * 文件系统服务器
   */
  filesystem: (allowedDirs: string[]): MCPServerConfig => ({
    name: 'filesystem',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem', ...allowedDirs]
  }),

  /**
   * Git 服务器
   */
  git: (repoPath: string): MCPServerConfig => ({
    name: 'git',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-git', '--repository', repoPath]
  }),

  /**
   * SQLite 服务器
   */
  sqlite: (dbPath: string): MCPServerConfig => ({
    name: 'sqlite',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-sqlite', dbPath]
  }),

  /**
   * Brave Search 服务器
   */
  braveSearch: (apiKey?: string): MCPServerConfig => ({
    name: 'brave-search',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-brave-search'],
    env: apiKey ? { BRAVE_API_KEY: apiKey } : undefined
  }),

  /**
   * Puppeteer 服务器
   */
  puppeteer: (): MCPServerConfig => ({
    name: 'puppeteer',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-puppeteer']
  }),

  /**
   * Google Maps 服务器
   */
  googleMaps: (apiKey?: string): MCPServerConfig => ({
    name: 'google-maps',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-google-maps'],
    env: apiKey ? { GOOGLE_MAPS_API_KEY: apiKey } : undefined
  }),

  /**
   * Slack 服务器
   */
  slack: (token?: string): MCPServerConfig => ({
    name: 'slack',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-slack'],
    env: token ? { SLACK_BOT_TOKEN: token } : undefined
  }),

  /**
   * PostgreSQL 服务器
   */
  postgres: (connectionString: string): MCPServerConfig => ({
    name: 'postgres',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-postgres', connectionString]
  })
};
