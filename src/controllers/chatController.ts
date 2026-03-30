import { Request, Response } from 'express';
import { openRouterService } from '../services/openRouterService';
import { Message } from '../types/chat';
import { config } from '../config/config';

// Simple in-memory history management
const conversationHistory: Record<string, Message[]> = {};

export class ChatController {
  async handleChat(req: Request, res: Response) {
    const { message, stream, sessionId = 'default' } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Initialize history if not exists
    if (!conversationHistory[sessionId]) {
      conversationHistory[sessionId] = [
        { role: 'system', content: config.agent.systemPrompt }
      ];
    }

    // Add user message to history
    conversationHistory[sessionId].push({ role: 'user', content: message });

    try {
      if (stream) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        let fullResponse = '';
        const streamGenerator = openRouterService.sendMessageStream(conversationHistory[sessionId]);

        for await (const chunk of streamGenerator) {
          fullResponse += chunk;
          res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
        }

        // Add assistant response to history
        conversationHistory[sessionId].push({ role: 'assistant', content: fullResponse });
        res.write('data: [DONE]\n\n');
        res.end();
      } else {
        const response = await openRouterService.sendMessage(conversationHistory[sessionId]);
        const assistantMessage = response.choices[0].message;
        
        // Add assistant response to history
        conversationHistory[sessionId].push(assistantMessage);

        res.json({
          message: assistantMessage.content,
          usage: response.usage,
        });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async clearHistory(req: Request, res: Response) {
    const { sessionId = 'default' } = req.body;
    conversationHistory[sessionId] = [
      { role: 'system', content: config.agent.systemPrompt }
    ];
    res.json({ status: 'History cleared' });
  }
}

export const chatController = new ChatController();
