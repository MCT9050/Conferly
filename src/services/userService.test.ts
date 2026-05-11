import { UserService, User } from '../services/userService';

describe('UserService', () => {
  let userService: UserService;
  
  beforeEach(() => {
    userService = new UserService();
  });
  
  describe('create', () => {
    it('should create a new user', async () => {
      const user: User = {
        id: 'test-id',
        email: 'test@example.com',
        password: 'hashed-password',
        name: 'Test User',
      };
      
      const created = await userService.create(user);
      
      expect(created.id).toBe(user.id);
      expect(created.email).toBe(user.email);
      expect(created.name).toBe(user.name);
    });
  });
  
  describe('findByEmail', () => {
    it('should find a user by email', async () => {
      const user: User = {
        id: 'test-id',
        email: 'findme@example.com',
        password: 'hashed-password',
        name: 'Find Me',
      };
      
      await userService.create(user);
      const found = await userService.findByEmail('findme@example.com');
      
      expect(found).toBeDefined();
      expect(found?.email).toBe('findme@example.com');
    });
    
    it('should return undefined for non-existent email', async () => {
      const found = await userService.findByEmail('nonexistent@example.com');
      expect(found).toBeUndefined();
    });
  });
  
  describe('findById', () => {
    it('should find a user by id', async () => {
      const user: User = {
        id: 'unique-id',
        email: 'unique@example.com',
        password: 'password',
        name: 'Unique User',
      };
      
      await userService.create(user);
      const found = await userService.findById('unique-id');
      
      expect(found).toBeDefined();
      expect(found?.id).toBe('unique-id');
    });
  });
  
  describe('delete', () => {
    it('should delete a user', async () => {
      const user: User = {
        id: 'delete-id',
        email: 'delete@example.com',
        password: 'password',
        name: 'Delete Me',
      };
      
      await userService.create(user);
      await userService.delete('delete-id');
      
      const found = await userService.findById('delete-id');
      expect(found).toBeUndefined();
    });
  });
});