import express from 'express';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { initTRPC } from '@trpc/server';
import superjson from 'superjson';
import { z } from 'zod';
import { Router, Query, Input, UseZod, createClassRouter } from '../src';

interface Ctx { }
const t = initTRPC.context<Ctx>().create({ transformer: superjson });

@Router()
class HelloController {
  @Query('hello')
  @UseZod(z.object({ name: z.string() }), z.string())
  hello(@Input() input: { name: string }) {
    return `Hello ${input.name}`;
  }
}

const { router } = createClassRouter({
  t,
  controllers: { helloController: new HelloController() },
});

const app = express();
app.use('/trpc', createExpressMiddleware({ router, createContext: () => ({}) }));

async function main() {
  await app.listen(3000);
  const caller = router.createCaller({});
  console.log(await caller.helloController.hello({ name: 'world' }));
}

main();
