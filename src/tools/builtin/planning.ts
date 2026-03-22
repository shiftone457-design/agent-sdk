import { z } from 'zod';
import { createTool } from '../registry.js';
import type { ToolDefinition } from '../../core/types.js';

const todoStatusEnum = z.enum(['pending', 'in_progress', 'completed']);

/**
 * Todo 写入工具
 */
export const todoWriteTool = createTool({
  name: 'todo_write',
  category: 'planning',
  description:
    'Creates and manages a structured task list for the current session. Use this tool to track progress on multi-step tasks. Exactly one task should be in_progress at any time. Mark tasks completed immediately after finishing them.',
  parameters: z.object({
    todos: z
      .array(
        z.object({
          content: z
            .string()
            .describe('Brief description of the task in imperative form (e.g., "Run tests")'),
          activeForm: z
            .string()
            .describe(
              'Present continuous form of the task (e.g., "Running tests")'
            ),
          status: todoStatusEnum.describe(
            'Task status: pending, in_progress, or completed'
          )
        })
      )
      .min(1)
      .describe('The updated list of todos')
  }),
  handler: async ({ todos }: {
    todos: Array<{ content: string; activeForm: string; status: z.infer<typeof todoStatusEnum> }>
  }) => {
    const inProgressCount = todos.filter((t) => t.status === 'in_progress').length;
    if (inProgressCount !== 1) {
      return {
        content: `Expected exactly 1 task with status "in_progress", found ${inProgressCount}. Each task list must have exactly one in-progress task.`,
        isError: true
      };
    }

    const lines: string[] = [];
    for (const todo of todos) {
      const icon =
        todo.status === 'completed'
          ? 'x'
          : todo.status === 'in_progress'
            ? '>'
            : ' ';
      lines.push(`[${icon}] ${todo.content}`);
    }

    const pending = todos.filter((t) => t.status === 'pending').length;
    const inProgress = todos.filter((t) => t.status === 'in_progress').length;
    const completed = todos.filter((t) => t.status === 'completed').length;

    return {
      content: `Task list updated (${completed} completed, ${inProgress} in progress, ${pending} pending):\n\n${lines.join('\n')}`,
      metadata: { todos }
    };
  }
});

/**
 * 获取 Planning 工具
 */
export function getPlanningTools(): ToolDefinition[] {
  return [todoWriteTool];
}
