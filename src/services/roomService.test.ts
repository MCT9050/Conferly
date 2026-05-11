import { RoomService, Room } from '../services/roomService';

describe('RoomService', () => {
  let roomService: RoomService;
  
  beforeEach(() => {
    roomService = new RoomService();
  });
  
  describe('createRoom', () => {
    it('should create a new room', async () => {
      const room: Room = {
        id: 'room-1',
        name: 'Test Room',
        description: 'A test room',
        maxParticipants: 50,
        participants: [],
        createdAt: new Date().toISOString(),
      };
      
      const created = await roomService.createRoom(room);
      
      expect(created.id).toBe(room.id);
      expect(created.name).toBe(room.name);
    });
  });
  
  describe('getAllRooms', () => {
    it('should return all rooms', async () => {
      const room1: Room = {
        id: 'room-1',
        name: 'Room 1',
        maxParticipants: 50,
        participants: [],
        createdAt: new Date().toISOString(),
      };
      const room2: Room = {
        id: 'room-2',
        name: 'Room 2',
        maxParticipants: 30,
        participants: [],
        createdAt: new Date().toISOString(),
      };
      
      await roomService.createRoom(room1);
      await roomService.createRoom(room2);
      
      const rooms = await roomService.getAllRooms();
      expect(rooms).toHaveLength(2);
    });
  });
  
  describe('getRoomById', () => {
    it('should find a room by id', async () => {
      const room: Room = {
        id: 'find-room',
        name: 'Find Room',
        maxParticipants: 50,
        participants: [],
        createdAt: new Date().toISOString(),
      };
      
      await roomService.createRoom(room);
      const found = await roomService.getRoomById('find-room');
      
      expect(found).toBeDefined();
      expect(found?.name).toBe('Find Room');
    });
    
    it('should return undefined for non-existent room', async () => {
      const found = await roomService.getRoomById('non-existent');
      expect(found).toBeUndefined();
    });
  });
  
  describe('joinRoom', () => {
    it('should allow user to join room', async () => {
      const room: Room = {
        id: 'join-room',
        name: 'Join Room',
        maxParticipants: 50,
        participants: [],
        createdAt: new Date().toISOString(),
      };
      
      await roomService.createRoom(room);
      const updated = await roomService.joinRoom('join-room', 'user-1');
      
      expect(updated?.participants).toContain('user-1');
    });
  });
  
  describe('deleteRoom', () => {
    it('should delete a room', async () => {
      const room: Room = {
        id: 'delete-room',
        name: 'Delete Room',
        maxParticipants: 50,
        participants: [],
        createdAt: new Date().toISOString(),
      };
      
      await roomService.createRoom(room);
      await roomService.deleteRoom('delete-room');
      
      const found = await roomService.getRoomById('delete-room');
      expect(found).toBeUndefined();
    });
  });
});