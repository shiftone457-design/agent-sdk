// Model adapters
export { BaseModelAdapter, zodToJsonSchema, toolsToModelSchema, mergeTokenUsage } from './base.js';
export { OpenAIAdapter, createOpenAI } from './openai.js';
export type { OpenAIConfig } from './openai.js';
export { AnthropicAdapter, createAnthropic } from './anthropic.js';
export type { AnthropicConfig } from './anthropic.js';
export { OllamaAdapter, createOllama } from './ollama.js';
export type { OllamaConfig } from './ollama.js';

import type { ModelAdapter } from '../core/types.js';
import { OpenAIAdapter } from './openai.js';
import { AnthropicAdapter } from './anthropic.js';
import { OllamaAdapter } from './ollama.js';

export type ModelProvider = 'openai' | 'anthropic' | 'ollama';

export interface CreateModelConfig {
  provider: ModelProvider;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
}

/**
 * 创建模型适配器工厂函数
 */
export function createModel(config: CreateModelConfig): ModelAdapter {
  switch (config.provider) {
    case 'openai':
      return new OpenAIAdapter({
        apiKey: config.apiKey,
        baseUrl: config.baseUrl,
        model: config.model
      });
    case 'anthropic':
      return new AnthropicAdapter({
        apiKey: config.apiKey,
        baseUrl: config.baseUrl,
        model: config.model
      });
    case 'ollama':
      return new OllamaAdapter({
        baseUrl: config.baseUrl,
        model: config.model
      });
    default:
      throw new Error(`Unknown model provider: ${config.provider}`);
  }
}
