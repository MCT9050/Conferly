import { MessageService, Message } from '../services/messageService';

describe('MessageService', () => {
  let messageService: MessageService;
  
  beforeEach(() => {
    messageService = new MessageService();
  });
  
  describe('createMessage', () => {
    it('should create a new message', async () => {
      const message: Message = {
        id: 'msg-1',
        roomId: 'room-1',
        content: 'Hello World',
        senderId: 'user-1',
        type: 'text',
        createdAt: new Date().toISOString(),
      };
      
      const created = await messageService.createMessage(message);
      
      expect(created.id).toBe(message.id);
      expect(created.content).toBe('Hello World');
    });
  });
  
  describe('getMessagesByRoom', () => {
    it('should return messages for a room', async () => {
      const msg1: Message = {
        id: 'msg-1',
        roomId: 'room-1',
        content: 'First message',
        senderId: 'user-1',
        type: 'text',
        createdAt: new Date().toISOString(),
      };
      const msg2: Message = {
        id: 'msg-2',
        roomId: 'room-1',
        content: 'Second message',
        senderId: 'user-2',
        type: 'text',
        createdAt: new Date().toISOString(),
      };
      
      await messageService.createMessage(msg1);
      await messageService.createMessage(msg2);
      
      const messages = await messageService.getMessagesByRoom('room-1');
      expect(messages).toHaveLength(2);
    });
    
    it('should return empty array for room with no messages', async () => {
      const messages = await messageService.getMessagesByRoom('empty-room');
      expect(messages).toHaveLength(0);
    });
  });
  
  describe('deleteMessage', () => {
    it('should delete a message', async () => {
      const message: Message = {
        id: 'delete-msg',
        roomId: 'room-1',
        content: 'Delete me',
        senderId: 'user-1',
        type: 'text',
        createdAt: new Date().toISOString(),
      };
      
      await messageService.createMessage(message);
      await messageService.deleteMessage('delete-msg');
      
      const messages = await messageService.getMessagesByRoom('room-1');
      expect(messages).toHaveLength(0);
    });
  });
});