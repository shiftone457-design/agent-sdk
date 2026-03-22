import { Agent, createOpenAI, createTool } from '../src/index.js';
import { z } from 'zod';

// Basic example with OpenAI
async function basicExample() {
  const agent = new Agent({
    model: createOpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      model: 'gpt-4o'
    }),
    systemPrompt: 'You are a helpful assistant.'
  });

  console.log('=== Basic Example ===\n');

  // Stream response
  for await (const event of agent.stream('Tell me a short joke')) {
    if (event.type === 'text_delta') {
      process.stdout.write(event.content);
    }
  }
  console.log('\n');
}

// Example with custom tools
async function toolExample() {
  const agent = new Agent({
    model: createOpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      model: 'gpt-4o'
    })
  });

  // Register a custom tool
  agent.registerTool(createTool({
    name: 'calculate',
    description: 'Perform basic math operations',
    parameters: z.object({
      operation: z.enum(['add', 'subtract', 'multiply', 'divide']),
      a: z.number(),
      b: z.number()
    }),
    handler: async ({ operation, a, b }) => {
      let result: number;
      switch (operation) {
        case 'add': result = a + b; break;
        case 'subtract': result = a - b; break;
        case 'multiply': result = a * b; break;
        case 'divide': result = a / b; break;
      }
      return { content: `Result: ${result}` };
    }
  }));

  console.log('=== Tool Example ===\n');

  const result = await agent.run('What is 42 * 17?');
  console.log(result.content);

  if (result.toolCalls) {
    console.log('\nTool calls:');
    for (const call of result.toolCalls) {
      console.log(`  - ${call.name}(${JSON.stringify(call.arguments)})`);
    }
  }
}

// Example with session management
async function sessionExample() {
  const agent = new Agent({
    model: createOpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      model: 'gpt-4o'
    }),
    storage: { type: 'memory' }
  });

  console.log('=== Session Example ===\n');

  // First message
  await agent.run('My name is Bob', { sessionId: 'test-session' });
  console.log('User: My name is Bob');

  // Follow-up in same session
  const result = await agent.run('What is my name?', { sessionId: 'test-session' });
  console.log(`User: What is my name?`);
  console.log(`Assistant: ${result.content}\n`);
}

// Run examples
async function main() {
  if (!process.env.OPENAI_API_KEY) {
    console.error('Please set OPENAI_API_KEY environment variable');
    process.exit(1);
  }

  await basicExample();
  await toolExample();
  await sessionExample();
}

main().catch(console.error);
