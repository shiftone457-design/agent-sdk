import { promises as fs } from 'fs';
import { join, resolve } from 'path';
import type { SkillDefinition, ToolDefinition } from '../core/types.js';
import { parseSkillMd, inferMetadataFromPath } from './parser.js';

/**
 * Skill 加载器配置
 */
export interface SkillLoaderConfig {
  /** 基础路径 */
  basePath?: string;
  /** 是否自动加载脚本 */
  loadScripts?: boolean;
  /** 文件过滤 */
  filter?: (path: string) => boolean;
}

/**
 * Skill 加载器
 */
export class SkillLoader {
  private config: SkillLoaderConfig;

  constructor(config: SkillLoaderConfig = {}) {
    this.config = {
      basePath: process.cwd(),
      loadScripts: true,
      ...config
    };
  }

  /**
   * 加载单个 Skill
   */
  async load(skillPath: string): Promise<SkillDefinition> {
    const resolvedPath = resolve(this.config.basePath!, skillPath);
    
    // 检查是文件还是目录
    const stat = await this.getPathType(resolvedPath);
    
    if (stat === 'file') {
      return this.loadFromFile(resolvedPath);
    } else if (stat === 'directory') {
      return this.loadFromDirectory(resolvedPath);
    }
    
    throw new Error(`Skill path not found: ${resolvedPath}`);
  }

  /**
   * 从文件加载 Skill
   */
  private async loadFromFile(filePath: string): Promise<SkillDefinition> {
    const content = await fs.readFile(filePath, 'utf-8');
    const parsed = parseSkillMd(content);
    
    // 从路径推断元数据
    const metadata = parsed.metadata as any;
    if (!metadata.name || metadata.name === 'unknown') {
      const inferred = inferMetadataFromPath(filePath);
      if (inferred.name) {
        parsed.metadata.name = inferred.name;
      }
    }

    return {
      metadata: parsed.metadata,
      path: filePath,
      instructions: parsed.content,
      tools: []
    };
  }

  /**
   * 从目录加载 Skill
   */
  private async loadFromDirectory(dirPath: string): Promise<SkillDefinition> {
    const skillMdPath = join(dirPath, 'SKILL.md');
    
    // 检查 SKILL.md 是否存在
    try {
      await fs.access(skillMdPath);
    } catch {
      throw new Error(`SKILL.md not found in ${dirPath}`);
    }

    const content = await fs.readFile(skillMdPath, 'utf-8');
    const parsed = parseSkillMd(content);

    // 从目录名推断元数据
    const dirMetadata = parsed.metadata as any;
    if (!dirMetadata.name || dirMetadata.name === 'unknown') {
      const inferred = inferMetadataFromPath(dirPath);
      if (inferred.name) {
        parsed.metadata.name = inferred.name;
      }
    }

    // 加载脚本文件
    let tools: ToolDefinition[] = [];
    if (this.config.loadScripts) {
      tools = await this.loadScripts(dirPath);
    }

    // 加载引用文件
    const references = await this.loadReferences(dirPath);

    return {
      metadata: parsed.metadata,
      path: dirPath,
      instructions: parsed.content,
      tools,
      references
    };
  }

  /**
   * 加载目录下的所有脚本
   */
  private async loadScripts(dirPath: string): Promise<ToolDefinition[]> {
    const scriptsDir = join(dirPath, 'scripts');
    const tools: ToolDefinition[] = [];

    try {
      const entries = await fs.readdir(scriptsDir, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.ts'))) {
          try {
            const scriptPath = join(scriptsDir, entry.name);
            const tool = await this.loadScriptAsTool(scriptPath);
            if (tool) {
              tools.push(tool);
            }
          } catch (error) {
            console.warn(`Failed to load script ${entry.name}:`, error);
          }
        }
      }
    } catch {
      // scripts 目录不存在，忽略
    }

    return tools;
  }

  /**
   * 将脚本加载为工具
   */
  private async loadScriptAsTool(scriptPath: string): Promise<ToolDefinition | null> {
    try {
      // 动态导入脚本
      const module = await import(scriptPath);
      
      if (module.default && typeof module.default === 'object') {
        return module.default as ToolDefinition;
      }
      
      if (module.tool) {
        return module.tool as ToolDefinition;
      }
      
      return null;
    } catch {
      return null;
    }
  }

  /**
   * 加载引用文件
   */
  private async loadReferences(dirPath: string): Promise<string[]> {
    const refsDir = join(dirPath, 'references');
    const references: string[] = [];

    try {
      const entries = await fs.readdir(refsDir, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isFile()) {
          const refPath = join(refsDir, entry.name);
          const content = await fs.readFile(refPath, 'utf-8');
          references.push(content);
        }
      }
    } catch {
      // references 目录不存在，忽略
    }

    return references;
  }

  /**
   * 加载目录下的所有 Skills
   */
  async loadAll(dirPath: string): Promise<SkillDefinition[]> {
    const resolvedPath = resolve(this.config.basePath!, dirPath);
    const skills: SkillDefinition[] = [];

    try {
      const entries = await fs.readdir(resolvedPath, { withFileTypes: true });

      for (const entry of entries) {
        const entryPath = join(resolvedPath, entry.name);

        // 应用过滤器
        if (this.config.filter && !this.config.filter(entryPath)) {
          continue;
        }

        try {
          if (entry.isDirectory()) {
            // 检查是否是 Skill 目录
            const hasSkillMd = await this.hasFile(entryPath, 'SKILL.md');
            if (hasSkillMd) {
              const skill = await this.loadFromDirectory(entryPath);
              skills.push(skill);
            }
          } else if (entry.name.endsWith('.md') && entry.name !== 'SKILL.md') {
            // 加载独立的 .md 文件作为 Skill
            const skill = await this.loadFromFile(entryPath);
            skills.push(skill);
          }
        } catch (error) {
          console.warn(`Failed to load skill from ${entryPath}:`, error);
        }
      }
    } catch {
      // 目录不存在
    }

    return skills;
  }

  /**
   * 检查文件是否存在
   */
  private async hasFile(dirPath: string, fileName: string): Promise<boolean> {
    try {
      await fs.access(join(dirPath, fileName));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 获取路径类型
   */
  private async getPathType(path: string): Promise<'file' | 'directory' | null> {
    try {
      const stat = await fs.stat(path);
      if (stat.isFile()) return 'file';
      if (stat.isDirectory()) return 'directory';
      return null;
    } catch {
      return null;
    }
  }
}

/**
 * 创建 Skill 加载器
 */
export function createSkillLoader(config?: SkillLoaderConfig): SkillLoader {
  return new SkillLoader(config);
}
