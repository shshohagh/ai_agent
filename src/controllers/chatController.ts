import { Request, Response } from 'express';
import { openRouterService } from '../services/openRouterService';
import { Message } from '../types/chat';
import { config } from '../config/config';

export class ChatController {
  async handleChat(req: Request, res: Response) {
    const { message, stream, history = [] } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Use history from frontend, or start fresh if none provided
    const messages: Message[] = history.length > 0 
      ? history 
      : [{ role: 'system', content: config.agent.systemPrompt }, { role: 'user', content: message }];

    try {
      if (stream) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        const streamGenerator = openRouterService.sendMessageStream(messages);

        for await (const chunk of streamGenerator) {
          res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
        }

        res.write('data: [DONE]\n\n');
        res.end();
      } else {
        const response = await openRouterService.sendMessage(messages);
        const assistantMessage = response.choices[0].message;
        
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
    // History is now managed on the client/Firestore, so this is a no-op or can be removed
    res.json({ status: 'History management is now handled via Firestore' });
  }
}

export const chatController = new ChatController();
