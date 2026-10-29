import { z } from 'zod';

export interface LLMProvider {
  name: string;
  isAvailable(): boolean;
  completeStructured<T>(prompt: string, schema: z.ZodSchema<T>, systemPrompt?: string): Promise<T>;
}

export type LLMProviderType = 'demo' | 'openai' | 'anthropic' | 'gemini';
