import { Router } from 'express';
import { chatController } from '../controllers/chatController';
import rateLimit from 'express-rate-limit';

const router = Router();

// Basic rate limiting: 20 requests per minute
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: 'Too many requests, please try again later.' },
});

router.post('/chat', limiter, chatController.handleChat.bind(chatController));
router.post('/clear', chatController.clearHistory.bind(chatController));

export default router;
