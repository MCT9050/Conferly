import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { RoomService } from '../services/roomService';
import { validateCreateRoom } from '../middleware/validation';
import { generateRoomToken, isLiveKitConfigured } from '../services/livekitService';

const router = Router();
const roomService = new RoomService();

router.get('/', async (_req: Request, res: Response) => {
  try {
    const rooms = await roomService.getAllRooms();
    res.json(rooms);
  } catch (_error) {
    res.status(500).json({ error: 'Failed to fetch rooms' });
  }
});

router.post('/', validateCreateRoom, async (req: Request, res: Response) => {
  try {
    const { name, description, maxParticipants } = req.body;
    const room = await roomService.createRoom({
      id: uuidv4(),
      name,
      description,
      maxParticipants: maxParticipants || 50,
      participants: [],
      createdAt: new Date().toISOString(),
    });
    res.status(201).json(room);
  } catch (_error) {
    res.status(500).json({ error: 'Failed to create room' });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const room = await roomService.getRoomById(req.params.id);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }
    res.json(room);
  } catch (_error) {
    res.status(500).json({ error: 'Failed to fetch room' });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await roomService.deleteRoom(req.params.id);
    res.status(204).send();
  } catch (_error) {
    res.status(500).json({ error: 'Failed to delete room' });
  }
});

router.post('/:id/join', async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;
    const room = await roomService.joinRoom(req.params.id, userId);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }
    res.json(room);
  } catch (_error) {
    res.status(500).json({ error: 'Failed to join room' });
  }
});

// POST /api/rooms/token - Generate LiveKit room access token
router.post('/token', async (req: Request, res: Response) => {
  try {
    const { roomId, identity, name, metadata, isHost } = req.body;

    // Validate required fields
    if (!roomId || !identity) {
      return res.status(400).json({ error: 'roomId and identity are required' });
    }

    // Check if LiveKit is configured
    if (!isLiveKitConfigured()) {
      return res.status(503).json({ error: 'LiveKit is not configured' });
    }

    // Generate token
    const result = generateRoomToken({
      roomId,
      identity,
      name,
      metadata,
      isHost: Boolean(isHost),
    });

    if (!result) {
      return res.status(500).json({ error: 'Failed to generate token' });
    }

    res.json({ token: result.token, url: result.url });
  } catch (_error) {
    res.status(500).json({ error: 'Failed to generate token' });
  }
});

export default router;