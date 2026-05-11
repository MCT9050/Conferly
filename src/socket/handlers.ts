import { Socket as SocketType, Server as SocketIOServer } from 'socket.io';
import logger from '../utils/logger';

interface RTCSignal {
  type: string;
  sdp?: string;
}

interface RTCIceCandidateInit {
  candidate: string;
  sdpMid: string | null;
  sdpMLineIndex: number | null;
}

// Track active rooms per socket to clean up on disconnect
const socketRooms = new Map<string, Set<string>>();

// Clean up all event listeners and intervals for a socket
const cleanupSocket = (socket: SocketType) => {
  const rooms = socketRooms.get(socket.id);
  if (rooms) {
    rooms.forEach((roomId: string) => {
      socket.leave(roomId);
    });
    socketRooms.delete(socket.id);
  }
  // Remove all listeners to prevent memory leaks
  socket.removeAllListeners();
};

export const setupSocketHandlers = (socket: SocketType, io: SocketIOServer) => {
  // Track rooms for cleanup on disconnect
  socketRooms.set(socket.id, new Set());

  socket.on('join-room', (data: { roomId: string; userId: string }) => {
    try {
      const { roomId, userId } = data;
      socket.join(roomId);
      
      // Track room for cleanup
      const rooms = socketRooms.get(socket.id);
      if (rooms) rooms.add(roomId);
      
      socket.to(roomId).emit('user-joined', { userId });
      logger.info(`User ${userId} joined room ${roomId}`);
    } catch (error) {
      logger.error(`Error in join-room handler: ${(error as Error).message}`);
    }
  });
  
  socket.on('leave-room', (data: { roomId: string; userId: string }) => {
    try {
      const { roomId, userId } = data;
      socket.leave(roomId);
      
      // Remove room from tracking
      const rooms = socketRooms.get(socket.id);
      if (rooms) rooms.delete(roomId);
      
      socket.to(roomId).emit('user-left', { userId });
      logger.info(`User ${userId} left room ${roomId}`);
    } catch (error) {
      logger.error(`Error in leave-room handler: ${(error as Error).message}`);
    }
  });
  
  socket.on('message', (data: { roomId: string; content: string; senderId: string }) => {
    try {
      const { roomId, content, senderId } = data;
      io.to(roomId).emit('message', {
        roomId,
        content,
        senderId,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error(`Error in message handler: ${(error as Error).message}`);
    }
  });
  
  socket.on('typing', (data: { roomId: string; userId: string }) => {
    try {
      const { roomId, userId } = data;
      socket.to(roomId).emit('user-typing', { userId });
    } catch (error) {
      logger.error(`Error in typing handler: ${(error as Error).message}`);
    }
  });
  
  socket.on('offer', (data: { roomId: string; offer: RTCSignal }) => {
    try {
      const { roomId, offer } = data;
      socket.to(roomId).emit('offer', { offer, senderId: socket.id });
    } catch (error) {
      logger.error(`Error in offer handler: ${(error as Error).message}`);
    }
  });
  
  socket.on('answer', (data: { roomId: string; answer: RTCSignal }) => {
    try {
      const { roomId, answer } = data;
      socket.to(roomId).emit('answer', { answer, senderId: socket.id });
    } catch (error) {
      logger.error(`Error in answer handler: ${(error as Error).message}`);
    }
  });
  
  socket.on('ice-candidate', (data: { roomId: string; candidate: RTCIceCandidateInit }) => {
    try {
      const { roomId, candidate } = data;
      socket.to(roomId).emit('ice-candidate', { candidate, senderId: socket.id });
    } catch (error) {
      logger.error(`Error in ice-candidate handler: ${(error as Error).message}`);
    }
  });
  
  // Properly handle disconnect with full cleanup
  socket.on('disconnect', (reason: string) => {
    try {
      cleanupSocket(socket);
      logger.info(`Client ${socket.id} disconnected: ${reason}`);
    } catch (error) {
      logger.error(`Error in disconnect handler: ${(error as Error).message}`);
    }
  });
};