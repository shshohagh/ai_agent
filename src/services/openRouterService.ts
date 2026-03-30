import axios, { AxiosInstance } from 'axios';
import axiosRetry from 'axios-retry';
import { config } from '../config/config';
import { Message } from '../types/chat';

export class OpenRouterService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: config.openRouter.baseUrl,
      headers: {
        'Authorization': `Bearer ${config.openRouter.apiKey}`,
        'HTTP-Referer': config.server.appUrl,
        'X-Title': 'OpenRouter AI Agent',
        'Content-Type': 'application/json',
      },
    });

    // Add retry logic for failed API calls
    axiosRetry(this.client, {
      retries: 3,
      retryDelay: axiosRetry.exponentialDelay,
      retryCondition: (error) => {
        return axiosRetry.isNetworkOrIdempotentRequestError(error) || error.response?.status === 429;
      },
    });
  }

  async sendMessage(messages: Message[], tools?: any[]) {
    try {
      const response = await this.client.post('/chat/completions', {
        model: config.openRouter.model,
        messages,
        tools,
      });

      return response.data;
    } catch (error: any) {
      console.error('OpenRouter API Error:', error.response?.data || error.message);
      throw new Error(error.response?.data?.error?.message || 'Failed to communicate with OpenRouter');
    }
  }

  async *sendMessageStream(messages: Message[], tools?: any[]) {
    try {
      const response = await this.client.post('/chat/completions', {
        model: config.openRouter.model,
        messages,
        tools,
        stream: true,
      }, {
        responseType: 'stream',
      });

      // Node.js stream handling
      for await (const chunk of response.data) {
        const lines = chunk.toString().split('\n').filter((line: string) => line.trim() !== '');
        for (const line of lines) {
          const message = line.replace(/^data: /, '');
          if (message === '[DONE]') return;
          try {
            const parsed = JSON.parse(message);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) yield content;
          } catch (e) {
            // Ignore parse errors for partial chunks
          }
        }
      }
    } catch (error: any) {
      console.error('OpenRouter Stream Error:', error.message);
      throw error;
    }
  }
}

export const openRouterService = new OpenRouterService();
