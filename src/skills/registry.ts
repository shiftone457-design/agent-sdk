import { promises as fs } from 'fs';
import type { SkillDefinition } from '../core/types.js';
import { SkillLoader, type SkillLoaderConfig } from './loader.js';

/**
 * Skill 注册中心
 * Skill 只是一个指导书，不提供工具
 */
export class SkillRegistry {
  private skills: Map<string, SkillDefinition> = new Map();
  private loader: SkillLoader;

  constructor(config?: SkillLoaderConfig) {
    this.loader = new SkillLoader(config);
  }

  /**
   * 注册 Skill
   */
  register(skill: SkillDefinition): void {
    if (this.skills.has(skill.metadata.name)) {
      throw new Error(`Skill "${skill.metadata.name}" is already registered`);
    }

    this.skills.set(skill.metadata.name, skill);
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
  }

  /**
   * 导出 Skill 信息
   */
  export(): Array<{
    name: string;
    description: string;
    version?: string;
    path: string;
  }> {
    return this.getAll().map(skill => ({
      name: skill.metadata.name,
      description: skill.metadata.description,
      version: skill.metadata.version,
      path: skill.path
    }));
  }

  /**
   * 获取所有 Skill 的元数据列表（用于 System Prompt）
   */
  getMetadataList(): Array<{ name: string; description: string }> {
    return this.getAll().map(skill => ({
      name: skill.metadata.name,
      description: skill.metadata.description
    }));
  }

  /**
   * 获取格式化的 Skill 列表文本（用于 System Prompt）
   */
  getFormattedList(): string {
    const skillList = this.getMetadataList();
    if (skillList.length === 0) {
      return 'No skills are currently available.';
    }
    const skillsText = skillList
      .map(s => `- **${s.name}**: ${s.description}`)
      .join('\n');
    return `**Available Skills:**\n${skillsText}`;
  }

  /**
   * 根据名称获取 Skill 路径
   */
  getSkillPath(name: string): string | undefined {
    const skill = this.skills.get(name);
    return skill?.path;
  }

  /**
   * 加载 Skill 全量内容
   */
  async loadFullContent(name: string): Promise<string> {
    const skill = this.skills.get(name);
    if (!skill) {
      throw new Error(`Skill "${name}" not found`);
    }

    // 如果是目录，读取 SKILL.md
    if (skill.path) {
      const { join } = await import('path');

      try {
        const pathStat = await fs.stat(skill.path);
        let skillMdPath: string;

        if (pathStat.isDirectory()) {
          skillMdPath = join(skill.path, 'SKILL.md');
        } else {
          skillMdPath = skill.path;
        }

        const content = await fs.readFile(skillMdPath, 'utf-8');
        return content;
      } catch (error) {
        throw new Error(`Failed to read skill file: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    // 如果已有instructions，直接返回
    if (skill.instructions) {
      return skill.instructions;
    }

    throw new Error(`No content available for skill "${name}"`);
  }
}

/**
 * 创建 Skill 注册中心
 */
export function createSkillRegistry(config?: SkillLoaderConfig): SkillRegistry {
  return new SkillRegistry(config);
}
