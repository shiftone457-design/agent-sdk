import type { StorageAdapter, Message, SessionInfo } from '../core/types.js';

/**
 * 内存存储实现
 * 用于测试或临时会话，重启后数据丢失
 */
export class MemoryStorage implements StorageAdapter {
  private sessions: Map<string, Message[]> = new Map();
  private metadata: Map<string, SessionInfo> = new Map();

  /**
   * 保存消息
   */
  async save(sessionId: string, messages: Message[]): Promise<void> {
    this.sessions.set(sessionId, [...messages]);

    // 更新元数据
    const existing = this.metadata.get(sessionId);
    const now = Date.now();

    this.metadata.set(sessionId, {
      id: sessionId,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      messageCount: messages.length
    });
  }

  /**
   * 加载消息
   */
  async load(sessionId: string): Promise<Message[]> {
    return this.sessions.get(sessionId) || [];
  }

  /**
   * 列出所有会话
   */
  async list(): Promise<SessionInfo[]> {
    return Array.from(this.metadata.values())
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  /**
   * 删除会话
   */
  async delete(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
    this.metadata.delete(sessionId);
  }

  /**
   * 检查会话是否存在
   */
  async exists(sessionId: string): Promise<boolean> {
    return this.sessions.has(sessionId);
  }

  /**
   * 清空所有会话
   */
  async clear(): Promise<void> {
    this.sessions.clear();
    this.metadata.clear();
  }

  /**
   * 获取会话数量
   */
  get size(): number {
    return this.sessions.size;
  }

  /**
   * 导出所有数据
   */
  export(): Record<string, Message[]> {
    const result: Record<string, Message[]> = {};
    for (const [key, value] of this.sessions) {
      result[key] = [...value];
    }
    return result;
  }

  /**
   * 导入数据
   */
  import(data: Record<string, Message[]>): void {
    for (const [sessionId, messages] of Object.entries(data)) {
      this.save(sessionId, messages);
    }
  }
}

/**
 * 创建内存存储
 */
export function createMemoryStorage(): MemoryStorage {
  return new MemoryStorage();
}
