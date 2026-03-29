import { describe, it, expect } from 'vitest';
import { createStreamFormatter } from '../../src/cli/utils/output.js';

function stripAnsi(s: string): string {
  return s.replace(/\u001b\[[0-9;]*m/g, '');
}

describe('createStreamFormatter', () => {
  it('non-verbose: tool call line and result on separate lines', () => {
    const f = createStreamFormatter({ verbose: false });
    f.format({ type: 'tool_call', id: 'tc1', name: 'Read', arguments: { path: '/a' } });
    const out = f.format({ type: 'tool_result', toolCallId: 'tc1', result: 'ok' });
    const plain = stripAnsi(out);
    const idxTool = plain.indexOf('\n🔧 Read');
    const idxResult = plain.indexOf('\n✓ ');
    expect(idxTool).toBeGreaterThanOrEqual(0);
    expect(idxResult).toBeGreaterThan(idxTool);
    expect(plain.slice(idxResult)).toContain('ok');
  });

  it('non-verbose: tool call line and error on separate lines', () => {
    const f = createStreamFormatter({ verbose: false });
    f.format({ type: 'tool_call', id: 'tc1', name: 'Read', arguments: {} });
    const out = f.format({
      type: 'tool_error',
      toolCallId: 'tc1',
      error: new Error('failed')
    });
    const plain = stripAnsi(out);
    const idxTool = plain.indexOf('\n🔧 Read');
    const idxErr = plain.indexOf('\n✗ ');
    expect(idxTool).toBeGreaterThanOrEqual(0);
    expect(idxErr).toBeGreaterThan(idxTool);
    expect(plain).toContain('failed');
  });

  it('inserts newline before assistant text after tool result', () => {
    const f = createStreamFormatter({ verbose: false });
    f.format({ type: 'tool_call', id: 'tc1', name: 'Read', arguments: {} });
    f.format({ type: 'tool_result', toolCallId: 'tc1', result: 'done' });
    const out = f.format({ type: 'text_delta', content: 'Hello' });
    expect(stripAnsi(out)).toBe('\nHello');
  });

  it('inserts newline before assistant text when metadata is between tool result and text', () => {
    const f = createStreamFormatter({ verbose: false });
    f.format({ type: 'tool_call', id: 'tc1', name: 'Read', arguments: {} });
    f.format({ type: 'tool_result', toolCallId: 'tc1', result: 'done' });
    f.format({
      type: 'metadata',
      data: {
        usage: { promptTokens: 10, completionTokens: 2, totalTokens: 12 }
      }
    });
    const out = f.format({ type: 'text_delta', content: 'Hello' });
    expect(stripAnsi(out)).toBe('\nHello');
  });

  it('inserts newline before assistant text after tool error', () => {
    const f = createStreamFormatter({ verbose: false });
    f.format({ type: 'tool_call', id: 'tc1', name: 'Read', arguments: {} });
    f.format({
      type: 'tool_error',
      toolCallId: 'tc1',
      error: new Error('x')
    });
    const out = f.format({ type: 'text_delta', content: 'Next' });
    expect(stripAnsi(out)).toBe('\nNext');
  });
});
