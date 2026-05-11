export interface User {
  id: string;
  email: string;
  password: string;
  name: string;
  createdAt?: string;
}

class InMemoryUserStore {
  private users: Map<string, User> = new Map();
  
  async findById(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }
  
  async findByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(u => u.email === email);
  }
  
  async create(user: User): Promise<User> {
    this.users.set(user.id, user);
    return user;
  }
  
  async update(id: string, data: Partial<User>): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    const updated = { ...user, ...data };
    this.users.set(id, updated);
    return updated;
  }
  
  async delete(id: string): Promise<void> {
    this.users.delete(id);
  }
}

export class UserService {
  private store: InMemoryUserStore;
  
  constructor() {
    this.store = new InMemoryUserStore();
  }
  
  async findById(id: string): Promise<User | undefined> {
    return this.store.findById(id);
  }
  
  async findByEmail(email: string): Promise<User | undefined> {
    return this.store.findByEmail(email);
  }
  
  async create(user: User): Promise<User> {
    return this.store.create(user);
  }
  
  async update(id: string, data: Partial<User>): Promise<User | undefined> {
    return this.store.update(id, data);
  }
  
  async delete(id: string): Promise<void> {
    return this.store.delete(id);
  }
}