import { z } from 'zod';
import { createTool } from '../registry.js';
import type { ToolDefinition } from '../../core/types.js';

/**
 * 用户提问工具
 */
export const questionTool = createTool({
  name: 'question',
  category: 'interaction',
  description:
    'Asks the user a multiple-choice question to gather requirements or clarify ambiguity. Use this when you need input from the user to proceed. Provide clear options with brief descriptions.',
  parameters: z.object({
    question: z.string().describe('The question to ask the user'),
    header: z
      .string()
      .describe('A short label for the question (max 30 characters)'),
    options: z
      .array(
        z.object({
          label: z.string().describe('Display text for the option (1-5 words, concise)'),
          description: z.string().describe('Brief explanation of this option')
        })
      )
      .min(1)
      .describe('The available options to choose from'),
    multiple: z
      .boolean()
      .default(false)
      .describe('Allow the user to select multiple options (default: false)')
  }),
  handler: async ({ question, header, options, multiple }: {
    question: string;
    header: string;
    options: Array<{ label: string; description: string }>;
    multiple: boolean;
  }) => {
    const lines: string[] = [];
    lines.push(`[${header}] ${question}\n`);
    options.forEach((opt, i) => {
      lines.push(`  ${i + 1}. ${opt.label} — ${opt.description}`);
    });
    if (multiple) {
      lines.push('\n(Select one or more options)');
    } else {
      lines.push('\n(Select one option)');
    }

    return {
      content: lines.join('\n'),
      metadata: { question, header, options, multiple }
    };
  }
});

/**
 * 获取 Interaction 工具
 */
export function getInteractionTools(): ToolDefinition[] {
  return [questionTool];
}
