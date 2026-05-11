export interface Room {
  id: string;
  name: string;
  description?: string;
  maxParticipants: number;
  participants: string[];
  createdAt: string;
}

class InMemoryRoomStore {
  private rooms: Map<string, Room> = new Map();
  
  async getAll(): Promise<Room[]> {
    return Array.from(this.rooms.values());
  }
  
  async findById(id: string): Promise<Room | undefined> {
    return this.rooms.get(id);
  }
  
  async create(room: Room): Promise<Room> {
    this.rooms.set(room.id, room);
    return room;
  }
  
  async update(id: string, data: Partial<Room>): Promise<Room | undefined> {
    const room = this.rooms.get(id);
    if (!room) return undefined;
    const updated = { ...room, ...data };
    this.rooms.set(id, updated);
    return updated;
  }
  
  async delete(id: string): Promise<void> {
    this.rooms.delete(id);
  }
}

export class RoomService {
  private store: InMemoryRoomStore;
  
  constructor() {
    this.store = new InMemoryRoomStore();
  }
  
  async getAllRooms(): Promise<Room[]> {
    return this.store.getAll();
  }
  
  async getRoomById(id: string): Promise<Room | undefined> {
    return this.store.findById(id);
  }
  
  async createRoom(room: Room): Promise<Room> {
    return this.store.create(room);
  }
  
  async joinRoom(roomId: string, userId: string): Promise<Room | undefined> {
    const room = await this.store.findById(roomId);
    if (!room) return undefined;
    
    if (room.participants.includes(userId)) {
      return room;
    }
    
    if (room.participants.length >= room.maxParticipants) {
      throw new Error('Room is full');
    }
    
    return this.store.update(roomId, {
      participants: [...room.participants, userId],
    });
  }
  
  async deleteRoom(id: string): Promise<void> {
    return this.store.delete(id);
  }
}