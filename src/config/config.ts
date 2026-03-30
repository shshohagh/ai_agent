import dotenv from 'dotenv';
dotenv.config();

export const config = {
  openRouter: {
    apiKey: process.env.OPENROUTER_API_KEY || '',
    model: process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini',
    baseUrl: 'https://openrouter.ai/api/v1',
  },
  server: {
    port: 3000,
    appUrl: process.env.APP_URL || 'http://localhost:3000',
  },
  agent: {
    systemPrompt: "You are a helpful, professional AI assistant. You MUST provide all responses in the Bangla language. You provide clear, concise, and accurate information.",
  }
};
