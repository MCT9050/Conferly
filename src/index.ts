import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import dotenv from 'dotenv';
import path from 'path';
import authRoutes from './routes/auth';
import roomRoutes from './routes/rooms';
import messageRoutes from './routes/messages';
import { setupSocketHandlers } from './socket/handlers';
import { errorHandler } from './middleware/errorHandler';
import { authMiddleware } from './middleware/auth';
import logger from './utils/logger';

dotenv.config();

// Validate critical environment variables
const requiredEnvVars = ['JWT_SECRET'];
const missingVars: string[] = [];

for (const varName of requiredEnvVars) {
  if (!process.env[varName]) {
    missingVars.push(varName);
  }
}

if (missingVars.length > 0) {
  console.error(`ERROR: Missing required environment variables: ${missingVars.join(', ')}`);
  // In production, exit with error. In development, use fallback.
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  } else {
    console.warn('WARNING: Using insecure default JWT_SECRET. Do not use in production!');
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key-do-not-use-in-production';
  }
}

const app: Application = express();
const httpServer = createServer(app);
const io: SocketIOServer = new SocketIOServer(httpServer, {
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 4000;

if (isNaN(PORT) || PORT < 1 || PORT > 65535) {
  logger.error(`Invalid PORT: ${process.env.PORT}. Using default 4000.`);
}

// Serve static files from public directory
app.use(express.static(path.join(__dirname, '../public')));

app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/rooms', authMiddleware, roomRoutes);
app.use('/api/messages', authMiddleware, messageRoutes);

// Serve index.html for root route
app.get('/', (_req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' });
});

app.use(errorHandler);

io.on('connection', (socket) => {
  logger.info(`Client connected: ${socket.id}`);
  setupSocketHandlers(socket, io);
});

const startServer = () => {
  httpServer.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
  });
};

if (require.main === module) {
  startServer();
}

export { app, io, httpServer };