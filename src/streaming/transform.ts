import type { StreamChunk, StreamEvent, ToolCall, TokenUsage } from '../core/types.js';
import { AgentStream } from './event-emitter.js';

/**
 * 流转换器
 * 将模型的 StreamChunk 转换为统一的 StreamEvent
 */
export class StreamTransformer {
  private currentToolCall: {
    id: string;
    name: string;
    arguments: string;
  } | null = null;

  private usage: TokenUsage | undefined;

  /**
   * 转换模型流为事件流
   */
  async *transform(chunks: AsyncIterable<StreamChunk>): AsyncIterable<StreamEvent> {
    yield { type: 'start', timestamp: Date.now() };

    for await (const chunk of chunks) {
      const events = this.processChunk(chunk);
      for (const event of events) {
        yield event;
      }
    }

    // 处理剩余的工具调用
    if (this.currentToolCall) {
      yield this.finalizeToolCall();
    }

    yield { type: 'end', usage: this.usage, timestamp: Date.now() };
  }

  /**
   * 处理单个 chunk
   */
  private processChunk(chunk: StreamChunk): StreamEvent[] {
    const events: StreamEvent[] = [];

    switch (chunk.type) {
      case 'text':
        if (chunk.content) {
          events.push({ type: 'text_delta', content: chunk.content });
        }
        break;

      case 'tool_call_start':
        // 开始新的工具调用
        if (this.currentToolCall) {
          events.push(this.finalizeToolCall());
        }
        if (chunk.toolCall) {
          this.currentToolCall = {
            id: chunk.toolCall.id,
            name: chunk.toolCall.name,
            arguments: ''
          };
          events.push({
            type: 'tool_call_start',
            id: chunk.toolCall.id,
            name: chunk.toolCall.name
          });
        }
        break;

      case 'tool_call_delta':
        if (this.currentToolCall && chunk.content) {
          this.currentToolCall.arguments += chunk.content;
          events.push({
            type: 'tool_call_delta',
            id: this.currentToolCall.id,
            arguments: chunk.content
          });
        }
        break;

      case 'tool_call':
        if (chunk.toolCall) {
          if (this.currentToolCall) {
            events.push(this.finalizeToolCall());
          }
          events.push({
            type: 'tool_call',
            id: chunk.toolCall.id,
            name: chunk.toolCall.name,
            arguments: chunk.toolCall.arguments
          });
          this.currentToolCall = null;
        }
        break;

      case 'tool_call_end':
        if (this.currentToolCall) {
          events.push(this.finalizeToolCall());
          this.currentToolCall = null;
        }
        break;

      case 'thinking':
        if (chunk.content) {
          events.push({ 
            type: 'thinking', 
            content: chunk.content,
            signature: chunk.signature
          });
        }
        break;

      case 'error':
        if (chunk.error) {
          events.push({ type: 'error', error: chunk.error });
        }
        break;

      case 'metadata':
        if (chunk.metadata) {
          if (chunk.metadata.usage) {
            this.usage = chunk.metadata.usage as TokenUsage;
          }
          events.push({ type: 'metadata', data: chunk.metadata });
        }
        break;

      case 'done':
        // handled in the main loop
        break;
    }

    return events;
  }

  /**
   * 完成工具调用
   */
  private finalizeToolCall(): StreamEvent {
    if (!this.currentToolCall) {
      throw new Error('No current tool call');
    }

    const toolCall: ToolCall = {
      id: this.currentToolCall.id,
      name: this.currentToolCall.name,
      arguments: this.safeParseJSON(this.currentToolCall.arguments)
    };

    const event: StreamEvent = {
      type: 'tool_call',
      id: toolCall.id,
      name: toolCall.name,
      arguments: toolCall.arguments
    };

    this.currentToolCall = null;
    return event;
  }

  /**
   * 安全解析 JSON
   */
  private safeParseJSON(str: string): unknown {
    try {
      return JSON.parse(str);
    } catch {
      return str;
    }
  }
}

/**
 * 转换模型流为事件流
 */
export async function* transformStream(chunks: AsyncIterable<StreamChunk>): AsyncIterable<StreamEvent> {
  const transformer = new StreamTransformer();
  yield* transformer.transform(chunks);
}

/**
 * 将模型流转换为 AgentStream
 */
export function toAgentStream(chunks: AsyncIterable<StreamChunk>): AgentStream {
  const stream = new AgentStream();

  (async () => {
    try {
      for await (const event of transformStream(chunks)) {
        stream.push(event);
      }
      stream.end();
    } catch (error) {
      stream.throwError(error as Error);
    }
  })();

  return stream;
}
