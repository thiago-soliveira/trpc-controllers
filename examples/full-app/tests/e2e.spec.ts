import { describe, it, expect } from 'vitest';
import { createCaller } from '../src/server';

describe('e2e', () => {
  it('creates and fetches user', async () => {
    const caller = createCaller({ user: { id: 'u1', role: 'admin' } });
    const created = await caller.users.create({ name: 'Alice', email: 'alice@example.com' });
    expect(created.createdAt).toBeInstanceOf(Date);
    const fetched = await caller.users.getById({ id: created.id });
    expect(fetched).toEqual(created);
    await new Promise((r) => setTimeout(r, 1100));
  });

  it('rate limit', async () => {
    const caller = createCaller({ user: { id: 'u1', role: 'admin' } });
    const created = await caller.users.create({ name: 'Bob', email: 'bob@example.com' });
    await caller.users.getById({ id: created.id });
    await expect(caller.users.getById({ id: created.id })).rejects.toHaveProperty('code', 'TOO_MANY_REQUESTS');
  });

  it('zod error', async () => {
    const caller = createCaller({ user: { id: 'u1', role: 'admin' } });
    await expect(
      caller.users.create({ name: 'Al', email: 'not-email' })
    ).rejects.toHaveProperty('code', 'BAD_REQUEST');
  });

  it('unauthorized', async () => {
    const caller = createCaller({});
    await expect(
      caller.users.create({ name: 'Alice', email: 'alice@example.com' })
    ).rejects.toHaveProperty('code', 'UNAUTHORIZED');
  });

  it('forbidden', async () => {
    const caller = createCaller({ user: { id: 'u2', role: 'user' } });
    await expect(
      caller.users.create({ name: 'Alice', email: 'alice@example.com' })
    ).rejects.toHaveProperty('code', 'FORBIDDEN');
  });

  it('math.double', async () => {
    const caller = createCaller({ user: { id: 'u1', role: 'admin' } });
    expect(await caller.math.double({ x: 2 })).toBe(4);
  });
});
