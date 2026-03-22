import { promises as fs } from 'fs';
import { join } from 'path';
import type { StorageAdapter, Message, SessionInfo } from '../core/types.js';

/**
 * JSONL 文件存储配置
 */
export interface JsonlStorageConfig {
  basePath?: string;
}

/**
 * JSONL 文件存储实现
 * 每个会话一个 .jsonl 文件，每行一条消息
 */
export class JsonlStorage implements StorageAdapter {
  private basePath: string;

  constructor(config: JsonlStorageConfig = {}) {
    this.basePath = config.basePath || './sessions';
  }

  /**
   * 获取会话文件路径
   */
  private getFilePath(sessionId: string): string {
    // 确保会话 ID 安全（防止路径遍历）
    const safeId = sessionId.replace(/[^a-zA-Z0-9_-]/g, '_');
    return join(this.basePath, `${safeId}.jsonl`);
  }

  /**
   * 获取元数据文件路径
   */
  private getMetaFilePath(sessionId: string): string {
    const safeId = sessionId.replace(/[^a-zA-Z0-9_-]/g, '_');
    return join(this.basePath, `${safeId}.meta.json`);
  }

  /**
   * 确保目录存在
   */
  private async ensureDir(): Promise<void> {
    await fs.mkdir(this.basePath, { recursive: true });
  }

  /**
   * 保存消息（追加模式）
   */
  async save(sessionId: string, messages: Message[]): Promise<void> {
    await this.ensureDir();

    const filePath = this.getFilePath(sessionId);
    const metaPath = this.getMetaFilePath(sessionId);

    // 获取已有的消息数量
    let existingCount = 0;
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      existingCount = content.split('\n').filter(Boolean).length;
    } catch {
      // 文件不存在，这是正常的
    }

    // 只追加新消息
    const newMessages = messages.slice(existingCount);
    
    if (newMessages.length > 0) {
      const lines = newMessages.map(msg => {
        const record = {
          ...msg,
          timestamp: msg.timestamp || Date.now()
        };
        return JSON.stringify(record);
      }).join('\n') + '\n';

      await fs.appendFile(filePath, lines, 'utf-8');
    }

    // 更新元数据
    const meta: SessionInfo = {
      id: sessionId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messageCount: messages.length
    };

    // 读取创建时间（如果存在）
    try {
      const existingMeta = JSON.parse(await fs.readFile(metaPath, 'utf-8'));
      meta.createdAt = existingMeta.createdAt;
    } catch {
      // 新会话
    }

    await fs.writeFile(metaPath, JSON.stringify(meta, null, 2), 'utf-8');
  }

  /**
   * 加载消息
   */
  async load(sessionId: string): Promise<Message[]> {
    const filePath = this.getFilePath(sessionId);

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n').filter(Boolean);

      return lines.map(line => {
        const parsed = JSON.parse(line);
        // 移除 timestamp（存储用的）
        const { timestamp, ...message } = parsed;
        return message as Message;
      });
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  /**
   * 列出所有会话
   */
  async list(): Promise<SessionInfo[]> {
    await this.ensureDir();

    try {
      const files = await fs.readdir(this.basePath);
      const metaFiles = files.filter(f => f.endsWith('.meta.json'));

      const sessions: SessionInfo[] = [];

      for (const metaFile of metaFiles) {
        try {
          const metaPath = join(this.basePath, metaFile);
          const meta = JSON.parse(await fs.readFile(metaPath, 'utf-8'));
          sessions.push(meta);
        } catch {
          // 跳过损坏的元数据文件
        }
      }

      // 按更新时间排序
      return sessions.sort((a, b) => b.updatedAt - a.updatedAt);
    } catch {
      return [];
    }
  }

  /**
   * 删除会话
   */
  async delete(sessionId: string): Promise<void> {
    const filePath = this.getFilePath(sessionId);
    const metaPath = this.getMetaFilePath(sessionId);

    await Promise.all([
      fs.unlink(filePath).catch(() => {}),
      fs.unlink(metaPath).catch(() => {})
    ]);
  }

  /**
   * 检查会话是否存在
   */
  async exists(sessionId: string): Promise<boolean> {
    const filePath = this.getFilePath(sessionId);

    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 清空所有会话
   */
  async clear(): Promise<void> {
    await this.ensureDir();

    try {
      const files = await fs.readdir(this.basePath);
      await Promise.all(
        files.map(file => fs.unlink(join(this.basePath, file)).catch(() => {}))
      );
    } catch {
      // 目录不存在
    }
  }

  /**
   * 获取会话统计
   */
  async getStats(sessionId: string): Promise<{
    messageCount: number;
    createdAt: number;
    updatedAt: number;
    size: number;
  } | null> {
    const filePath = this.getFilePath(sessionId);
    const metaPath = this.getMetaFilePath(sessionId);

    try {
      const [metaContent, fileStat] = await Promise.all([
        fs.readFile(metaPath, 'utf-8'),
        fs.stat(filePath)
      ]);

      const meta = JSON.parse(metaContent);
      return {
        messageCount: meta.messageCount,
        createdAt: meta.createdAt,
        updatedAt: meta.updatedAt,
        size: fileStat.size
      };
    } catch {
      return null;
    }
  }
}

/**
 * 创建 JSONL 存储
 */
export function createJsonlStorage(config?: JsonlStorageConfig): JsonlStorage {
  return new JsonlStorage(config);
}
