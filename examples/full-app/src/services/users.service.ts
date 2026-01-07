import { randomUUID } from 'node:crypto';

export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
}

export class UsersService {
  private users = new Map<string, User>();

  findById(id: string): User | undefined {
    return this.users.get(id);
  }

  create(data: { name: string; email: string }): User {
    const user: User = { id: randomUUID(), createdAt: new Date(), ...data };
    this.users.set(user.id, user);
    return user;
  }
}
