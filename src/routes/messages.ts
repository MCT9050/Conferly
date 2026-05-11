import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { MessageService } from '../services/messageService';

const router = Router();
const messageService = new MessageService();

router.get('/room/:roomId', async (req: Request, res: Response) => {
  try {
    const messages = await messageService.getMessagesByRoom(req.params.roomId);
    res.json(messages);
  } catch (_error) {
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const { roomId, content, senderId, type } = req.body;
    const message = await messageService.createMessage({
      id: uuidv4(),
      roomId,
      content,
      senderId,
      type: type || 'text',
      createdAt: new Date().toISOString(),
    });
    res.status(201).json(message);
  } catch (_error) {
    res.status(500).json({ error: 'Failed to send message' });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await messageService.deleteMessage(req.params.id);
    res.status(204).send();
  } catch (_error) {
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

export default router;