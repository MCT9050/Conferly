export interface Message {
  id: string;
  roomId: string;
  content: string;
  senderId: string;
  type: 'text' | 'image' | 'file';
  createdAt: string;
}

class InMemoryMessageStore {
  private messages: Map<string, Message> = new Map();
  
  async findByRoom(roomId: string): Promise<Message[]> {
    return Array.from(this.messages.values())
      .filter(m => m.roomId === roomId)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }
  
  async findById(id: string): Promise<Message | undefined> {
    return this.messages.get(id);
  }
  
  async create(message: Message): Promise<Message> {
    this.messages.set(message.id, message);
    return message;
  }
  
  async delete(id: string): Promise<void> {
    this.messages.delete(id);
  }
}

export class MessageService {
  private store: InMemoryMessageStore;
  
  constructor() {
    this.store = new InMemoryMessageStore();
  }
  
  async getMessagesByRoom(roomId: string): Promise<Message[]> {
    return this.store.findByRoom(roomId);
  }
  
  async createMessage(message: Message): Promise<Message> {
    return this.store.create(message);
  }
  
  async deleteMessage(id: string): Promise<void> {
    return this.store.delete(id);
  }
}