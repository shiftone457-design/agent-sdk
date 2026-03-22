import type { SkillDefinition, ToolDefinition } from '../core/types.js';
import { ToolRegistry } from '../tools/registry.js';
import { SkillLoader, type SkillLoaderConfig } from './loader.js';

/**
 * Skill 注册中心
 */
export class SkillRegistry {
  private skills: Map<string, SkillDefinition> = new Map();
  private loader: SkillLoader;
  private toolRegistry: ToolRegistry;

  constructor(config?: SkillLoaderConfig) {
    this.loader = new SkillLoader(config);
    this.toolRegistry = new ToolRegistry();
  }

  /**
   * 注册 Skill
   */
  register(skill: SkillDefinition): void {
    if (this.skills.has(skill.metadata.name)) {
      throw new Error(`Skill "${skill.metadata.name}" is already registered`);
    }

    this.skills.set(skill.metadata.name, skill);

    // 注册 Skill 提供的工具
    if (skill.tools) {
      for (const tool of skill.tools) {
        this.toolRegistry.register(tool);
      }
    }
  }

  /**
   * 加载并注册 Skill
   */
  async load(path: string): Promise<void> {
    const skill = await this.loader.load(path);
    this.register(skill);
  }

  /**
   * 加载目录下的所有 Skills
   */
  async loadAll(dirPath: string): Promise<void> {
    const skills = await this.loader.loadAll(dirPath);
    for (const skill of skills) {
      try {
        this.register(skill);
      } catch (error) {
        console.warn(`Failed to register skill "${skill.metadata.name}":`, error);
      }
    }
  }

  /**
   * 注销 Skill
   */
  unregister(name: string): boolean {
    const skill = this.skills.get(name);
    if (!skill) {
      return false;
    }

    // 注销 Skill 提供的工具
    if (skill.tools) {
      for (const tool of skill.tools) {
        this.toolRegistry.unregister(tool.name);
      }
    }

    return this.skills.delete(name);
  }

  /**
   * 获取 Skill
   */
  get(name: string): SkillDefinition | undefined {
    return this.skills.get(name);
  }

  /**
   * 获取所有 Skill
   */
  getAll(): SkillDefinition[] {
    return Array.from(this.skills.values());
  }

  /**
   * 获取 Skill 名称列表
   */
  getNames(): string[] {
    return Array.from(this.skills.keys());
  }

  /**
   * 检查 Skill 是否存在
   */
  has(name: string): boolean {
    return this.skills.has(name);
  }

  /**
   * 获取所有 Skill 的指令
   */
  getInstructions(): string {
    const instructions: string[] = [];

    for (const skill of this.skills.values()) {
      if (skill.instructions) {
        instructions.push(`## Skill: ${skill.metadata.name}\n${skill.instructions}`);
      }

      // 添加引用内容
      if (skill.references && skill.references.length > 0) {
        instructions.push(`### References for ${skill.metadata.name}\n${skill.references.join('\n\n')}`);
      }
    }

    return instructions.join('\n\n---\n\n');
  }

  /**
   * 获取所有工具
   */
  getTools(): ToolDefinition[] {
    return this.toolRegistry.getAll();
  }

  /**
   * 获取工具注册中心
   */
  getToolRegistry(): ToolRegistry {
    return this.toolRegistry;
  }

  /**
   * 搜索 Skill
   */
  search(query: string): SkillDefinition[] {
    const lowerQuery = query.toLowerCase();
    return this.getAll().filter(skill =>
      skill.metadata.name.toLowerCase().includes(lowerQuery) ||
      skill.metadata.description.toLowerCase().includes(lowerQuery) ||
      skill.metadata.tags?.some(tag => tag.toLowerCase().includes(lowerQuery))
    );
  }

  /**
   * 按标签过滤
   */
  filterByTag(tag: string): SkillDefinition[] {
    return this.getAll().filter(skill =>
      skill.metadata.tags?.includes(tag)
    );
  }

  /**
   * 获取 Skill 数量
   */
  get size(): number {
    return this.skills.size;
  }

  /**
   * 清空所有 Skill
   */
  clear(): void {
    this.skills.clear();
    this.toolRegistry.clear();
  }

  /**
   * 导出 Skill 信息
   */
  export(): Array<{
    name: string;
    description: string;
    version?: string;
    tools: string[];
    path: string;
  }> {
    return this.getAll().map(skill => ({
      name: skill.metadata.name,
      description: skill.metadata.description,
      version: skill.metadata.version,
      tools: skill.tools?.map(t => t.name) || [],
      path: skill.path
    }));
  }
}

/**
 * 创建 Skill 注册中心
 */
export function createSkillRegistry(config?: SkillLoaderConfig): SkillRegistry {
  return new SkillRegistry(config);
}
