import type { LLMProvider } from './providerInterface.js';
import { DemoProvider } from './demoProvider.js';
import { logger } from '../observability/logger.js';

class ProviderFactory {
  private activeProvider: LLMProvider;

  constructor() {
    const providerType = (process.env.LLM_PROVIDER || 'demo').toLowerCase();
    const apiKey = process.env.LLM_API_KEY || process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY;

    if (providerType !== 'demo' && !apiKey) {
      logger.warn(`Provider '${providerType}' requested, but no API key was configured. Falling back safely to DemoProvider (deterministic mode).`);
      this.activeProvider = new DemoProvider();
    } else {
      // Default to demo provider
      this.activeProvider = new DemoProvider();
      logger.info(`Initialized active LLM provider: ${this.activeProvider.name}`);
    }
  }

  getProvider(): LLMProvider {
    return this.activeProvider;
  }

  getProviderStatus(): { name: string; isAvailable: boolean; mode: string } {
    return {
      name: this.activeProvider.name,
      isAvailable: this.activeProvider.isAvailable(),
      mode: this.activeProvider.name.includes('demo') ? 'Deterministic Demo Mode' : 'Live Cloud Provider'
    };
  }
}

export const providerFactory = new ProviderFactory();
