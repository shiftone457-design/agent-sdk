import { z } from 'zod';
import { createTool } from '../registry.js';
import type { SkillRegistry } from '../../skills/registry.js';

/**
 * 创建 Skill 激活工具
 */
export function createActivateSkillTool(skillRegistry: SkillRegistry) {
  return createTool({
    name: 'activate_skill',
    category: 'skills',
    description: 'Activate a skill by loading its full content from SKILL.md. Use this when a task matches a skill\'s description.',
    parameters: z.object({
      skillName: z.string().describe('The name of the skill to activate')
    }),
    handler: async ({ skillName }) => {
      try {
        // 检查 skill 是否存在
        if (!skillRegistry.has(skillName)) {
          const available = skillRegistry.getMetadataList();
          const availableList = available.length > 0
            ? available.map(s => `- ${s.name}: ${s.description}`).join('\n')
            : 'No skills available.';
          
          return {
            content: `Skill "${skillName}" not found.\n\nAvailable skills:\n${availableList}`,
            isError: true
          };
        }

        // 加载 skill 全量内容
        const fullContent = await skillRegistry.loadFullContent(skillName);
        const skill = skillRegistry.get(skillName);

        // 格式化返回内容
        const sections: string[] = [];

        sections.push(`# Skill: ${skill?.metadata.name || skillName}`);
        sections.push(`Description: ${skill?.metadata.description || ''}`);
        sections.push(`Base Path: ${skill?.path || ''}`);
        sections.push('');
        sections.push('---');
        sections.push('');
        sections.push(fullContent);

        return {
          content: sections.join('\n')
        };
      } catch (error) {
        return {
          content: `Error activating skill "${skillName}": ${error instanceof Error ? error.message : String(error)}`,
          isError: true
        };
      }
    }
  });
}

/**
 * 获取 Skill 相关工具
 */
export function getSkillTools(skillRegistry: SkillRegistry) {
  return [createActivateSkillTool(skillRegistry)];
}
