export interface AppContext {
  user?: { id: string; role: 'user' | 'admin' };
}
