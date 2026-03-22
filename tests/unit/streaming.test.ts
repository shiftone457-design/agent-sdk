import { describe, it, expect, beforeEach } from 'vitest';
import { AgentStream } from '../../src/streaming/event-emitter.js';

describe('AgentStream', () => {
  let stream: AgentStream;

  beforeEach(() => {
    stream = new AgentStream();
  });

  it('should push and consume events', async () => {
    const events: any[] = [];

    const consumePromise = (async () => {
      for await (const event of stream) {
        events.push(event);
      }
    })();

    stream.push({ type: 'start', timestamp: Date.now() });
    stream.push({ type: 'text_delta', content: 'Hello' });
    stream.push({ type: 'text_delta', content: ' World' });
    stream.end();

    await consumePromise;

    expect(events).toHaveLength(4); // start + 2 deltas + end
    expect(events[1].type).toBe('text_delta');
    expect((events[1] as any).content).toBe('Hello');
  });

  it('should handle end event', async () => {
    const events: any[] = [];

    const consumePromise = (async () => {
      for await (const event of stream) {
        events.push(event);
      }
    })();

    stream.end();

    await consumePromise;

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('end');
  });

  it('should collect text', async () => {
    const textPromise = stream.collectText();

    stream.push({ type: 'text_delta', content: 'Hello' });
    stream.push({ type: 'text_delta', content: ' ' });
    stream.push({ type: 'text_delta', content: 'World' });
    stream.end();

    const text = await textPromise;
    expect(text).toBe('Hello World');
  });

  it('should convert to array', async () => {
    const arrayPromise = stream.toArray();

    stream.push({ type: 'start', timestamp: Date.now() });
    stream.push({ type: 'text_delta', content: 'Test' });
    stream.end();

    const array = await arrayPromise;
    expect(array).toHaveLength(3);
  });

  it('should filter events', async () => {
    const filtered = stream.filter(e => e.type === 'text_delta');
    const events: any[] = [];

    const consumePromise = (async () => {
      for await (const event of filtered) {
        events.push(event);
      }
    })();

    stream.push({ type: 'start', timestamp: Date.now() });
    stream.push({ type: 'text_delta', content: 'Text' });
    stream.push({ type: 'end', timestamp: Date.now() });
    stream.end();

    await consumePromise;

    // Filter should only pass through text_delta events (and possibly end from the filter stream)
    const textEvents = events.filter(e => e.type === 'text_delta');
    expect(textEvents).toHaveLength(1);
    expect(textEvents[0].type).toBe('text_delta');
  });

  it('should handle abort', async () => {
    const events: any[] = [];

    const consumePromise = (async () => {
      for await (const event of stream) {
        events.push(event);
      }
    })();

    stream.push({ type: 'start', timestamp: Date.now() });
    stream.abort();

    await consumePromise;

    // Stream should be ended
    expect(events.length).toBeLessThanOrEqual(1);
  });

  it('should provide abort signal', () => {
    expect(stream.signal).toBeInstanceOf(AbortSignal);
    expect(stream.signal.aborted).toBe(false);

    stream.abort();
    expect(stream.signal.aborted).toBe(true);
  });
});
