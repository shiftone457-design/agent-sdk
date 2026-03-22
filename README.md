# Agent SDK

A TypeScript Agent SDK with multi-model support, MCP integration, skill system, and streaming.

## Features

- 🔄 **Multi-Model Support**: OpenAI, Anthropic, Ollama, and more
- 🔧 **Tool Registration**: Built-in tools + custom tool registration
- 🔌 **MCP Integration**: Connect to MCP servers for extended capabilities
- 📚 **Skill System**: Load modular skills from SKILL.md files
- 💾 **Session Management**: JSONL-based conversation persistence
- 🌊 **Streaming Output**: AsyncIterable-based real-time streaming
- 🖥️ **CLI Tool**: Command-line interface for quick testing

## Installation

```bash
npm install agent-sdk
# or
pnpm add agent-sdk
```

## Quick Start

### Basic Usage

```typescript
import { Agent, createOpenAI } from 'agent-sdk';

// Create an agent with OpenAI
const agent = new Agent({
  model: createOpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    model: 'gpt-4o'
  }),
  systemPrompt: 'You are a helpful assistant.'
});

// Stream response
for await (const event of agent.stream('Hello!')) {
  if (event.type === 'text_delta') {
    process.stdout.write(event.content);
  }
}
```

### With Custom Tools

```typescript
import { Agent, createTool, createOpenAI } from 'agent-sdk';
import { z } from 'zod';

const agent = new Agent({
  model: createOpenAI({ apiKey: process.env.OPENAI_API_KEY })
});

// Register a custom tool
agent.registerTool(createTool({
  name: 'get_weather',
  description: 'Get weather information for a city',
  parameters: z.object({
    city: z.string().describe('City name')
  }),
  handler: async ({ city }) => ({
    content: `Weather in ${city}: Sunny, 25°C`
  })
}));

const result = await agent.run('What is the weather in Tokyo?');
console.log(result.content);
```

### With MCP Servers

```typescript
import { Agent, createOpenAI, MCPServers } from 'agent-sdk';

const agent = new Agent({
  model: createOpenAI({ apiKey: process.env.OPENAI_API_KEY })
});

// Connect to MCP server
await agent.connectMCP(MCPServers.filesystem(['/path/to/allowed/dir']));

const result = await agent.run('List files in the current directory');
console.log(result.content);
```

### With Skills

```typescript
import { Agent, createOpenAI } from 'agent-sdk';

const agent = new Agent({
  model: createOpenAI({ apiKey: process.env.OPENAI_API_KEY }),
  skills: ['./skills/code-review']
});

const result = await agent.run('Review this code for best practices');
console.log(result.content);
```

### Session Management

```typescript
import { Agent, createOpenAI } from 'agent-sdk';

const agent = new Agent({
  model: createOpenAI({ apiKey: process.env.OPENAI_API_KEY }),
  storage: { type: 'jsonl', basePath: './sessions' }
});

// First conversation
const result1 = await agent.run('My name is Alice', { sessionId: 'user-123' });

// Resume the same session later
const result2 = await agent.run('What is my name?', { sessionId: 'user-123' });
console.log(result2.content); // "Your name is Alice"
```

## CLI Usage

```bash
# Interactive chat
agent-sdk chat --model openai --api-key sk-xxx

# Single prompt
agent-sdk run "What is the capital of France?" --model openai

# List available tools
agent-sdk tools list

# List sessions
agent-sdk sessions list

# Connect to MCP server
agent-sdk mcp connect "npx @modelcontextprotocol/server-filesystem /path"
```

## API Reference

### Agent

```typescript
class Agent {
  constructor(config: AgentConfig);
  
  // Stream response
  stream(input: string, options?: StreamOptions): AsyncIterable<StreamEvent>;
  
  // Complete response
  run(input: string, options?: RunOptions): Promise<AgentResult>;
  
  // Tool registration
  registerTool(tool: ToolDefinition): void;
  registerTools(tools: ToolDefinition[]): void;
  
  // Session management
  getSessionManager(): SessionManager;
  
  // Message history
  getMessages(): Message[];
  clearMessages(): void;
}
```

### Models

```typescript
// OpenAI
createOpenAI({ apiKey?, baseUrl?, model? }): ModelAdapter

// Anthropic
createAnthropic({ apiKey?, baseUrl?, model? }): ModelAdapter

// Ollama (local)
createOllama({ baseUrl?, model? }): ModelAdapter

// Generic factory
createModel({ provider, apiKey?, baseUrl?, model? }): ModelAdapter
```

### Tools

```typescript
// Create custom tool
createTool({
  name: string,
  description: string,
  parameters: ZodSchema,
  handler: (args) => Promise<ToolResult>
}): ToolDefinition

// Tool registry
class ToolRegistry {
  register(tool: ToolDefinition): void;
  unregister(name: string): boolean;
  execute(name: string, args: unknown): Promise<ToolResult>;
  getAll(): ToolDefinition[];
}
```

### Storage

```typescript
// JSONL storage (persistent)
createJsonlStorage({ basePath? }): StorageAdapter

// Memory storage (testing)
createMemoryStorage(): StorageAdapter

// Session manager
class SessionManager {
  createSession(id?): string;
  resumeSession(id): Promise<Message[]>;
  saveMessages(messages): Promise<void>;
  loadMessages(): Promise<Message[]>;
  listSessions(): Promise<SessionInfo[]>;
}
```

### MCP

```typescript
// Create MCP client
createMCPClient({
  name: string,
  transport: 'stdio' | 'http',
  command?: string,
  args?: string[],
  url?: string
}): MCPClient

// Preset servers
MCPServers.filesystem(dirs)
MCPServers.git(repoPath)
MCPServers.sqlite(dbPath)
MCPServers.braveSearch(apiKey?)
MCPServers.puppeteer()
```

### Skills

```typescript
// Load skill from path
const loader = createSkillLoader();
const skill = await loader.load('./skills/my-skill');

// Skill registry
const registry = createSkillRegistry();
await registry.loadAll('./skills');
registry.register(skill);
```

## Project Structure

```
agent-sdk/
├── src/
│   ├── core/          # Agent core, types
│   ├── models/        # Model adapters (OpenAI, Anthropic, Ollama)
│   ├── tools/         # Tool registry, built-in tools
│   ├── storage/       # JSONL/Memory storage
│   ├── streaming/     # Streaming event system
│   ├── mcp/           # MCP client integration
│   ├── skills/        # Skill loader and registry
│   ├── cli/           # Command-line interface
│   └── index.ts       # Main entry point
├── tests/             # Unit and integration tests
├── examples/          # Usage examples
├── package.json
├── tsconfig.json
└── tsup.config.ts
```

## Built-in Tools

| Tool | Description |
|------|-------------|
| `read_file` | Read file contents |
| `write_file` | Write to a file |
| `list_files` | List directory contents |
| `delete_file` | Delete a file |
| `file_exists` | Check if file exists |
| `execute_command` | Run shell command |
| `run_python` | Execute Python code |
| `run_node` | Execute Node.js code |
| `http_request` | Make HTTP request |
| `fetch_webpage` | Fetch webpage content |
| `download_file` | Download a file |

## License

MIT
