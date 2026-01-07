import { createCaller } from '../server';

async function main() {
  const caller = createCaller({ user: { id: 'u1', role: 'admin' } });
  const user = await caller.users.create({ name: 'Alice', email: 'alice@example.com' });
  // expect: { id: string; name: string; email: string; createdAt: Date }
  console.log('created', user);
  const fetched = await caller.users.getById({ id: user.id });
  // expect: typeof user | undefined
  console.log('fetched', fetched);
  const doubled = await caller.math.double({ x: 5 });
  // expect: number
  console.log('double', doubled);
}

main();
