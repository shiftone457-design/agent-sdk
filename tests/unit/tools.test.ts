import { describe, it, expect } from 'vitest';
import { ToolRegistry, createTool } from '../../src/tools/registry.js';
import { z } from 'zod';

describe('ToolRegistry', () => {
  it('should register a tool', () => {
    const registry = new ToolRegistry();
    const tool = createTool({
      name: 'test_tool',
      description: 'A test tool',
      parameters: z.object({ input: z.string() }),
      handler: async ({ input }) => ({ content: `Result: ${input}` })
    });

    registry.register(tool);
    expect(registry.has('test_tool')).toBe(true);
    expect(registry.size).toBe(1);
  });

  it('should throw on duplicate registration', () => {
    const registry = new ToolRegistry();
    const tool = createTool({
      name: 'test_tool',
      description: 'A test tool',
      parameters: z.object({}),
      handler: async () => ({ content: 'ok' })
    });

    registry.register(tool);
    expect(() => registry.register(tool)).toThrow('already registered');
  });

  it('should unregister a tool', () => {
    const registry = new ToolRegistry();
    const tool = createTool({
      name: 'test_tool',
      description: 'A test tool',
      parameters: z.object({}),
      handler: async () => ({ content: 'ok' })
    });

    registry.register(tool);
    expect(registry.has('test_tool')).toBe(true);

    registry.unregister('test_tool');
    expect(registry.has('test_tool')).toBe(false);
  });

  it('should execute a tool', async () => {
    const registry = new ToolRegistry();
    const tool = createTool({
      name: 'add',
      description: 'Add two numbers',
      parameters: z.object({
        a: z.number(),
        b: z.number()
      }),
      handler: async ({ a, b }) => ({
        content: String(a + b)
      })
    });

    registry.register(tool);
    const result = await registry.execute('add', { a: 2, b: 3 });

    expect(result.isError).toBeFalsy();
    expect(result.content).toBe('5');
  });

  it('should return error for unknown tool', async () => {
    const registry = new ToolRegistry();
    const result = await registry.execute('unknown', {});

    expect(result.isError).toBe(true);
    expect(result.content).toContain('not found');
  });

  it('should validate tool parameters', async () => {
    const registry = new ToolRegistry();
    const tool = createTool({
      name: 'strict_tool',
      description: 'A tool with strict parameters',
      parameters: z.object({
        required: z.string()
      }),
      handler: async ({ required }) => ({
        content: required
      })
    });

    registry.register(tool);

    // Invalid parameters
    const result = await registry.execute('strict_tool', { wrong: 'value' });
    expect(result.isError).toBe(true);
  });

  it('should get all tools', () => {
    const registry = new ToolRegistry();
    
    registry.register(createTool({
      name: 'tool1',
      description: 'Tool 1',
      parameters: z.object({}),
      handler: async () => ({ content: '1' })
    }));

    registry.register(createTool({
      name: 'tool2',
      description: 'Tool 2',
      parameters: z.object({}),
      handler: async () => ({ content: '2' })
    }));

    expect(registry.getAll()).toHaveLength(2);
    expect(registry.getNames()).toEqual(['tool1', 'tool2']);
  });

  it('should convert to schema', () => {
    const registry = new ToolRegistry();
    
    registry.register(createTool({
      name: 'test',
      description: 'Test tool',
      parameters: z.object({
        input: z.string().describe('Input value')
      }),
      handler: async () => ({ content: 'ok' })
    }));

    const schema = registry.toSchema();
    expect(schema).toHaveLength(1);
    expect(schema[0].name).toBe('test');
    expect(schema[0].parameters.type).toBe('object');
  });
});
