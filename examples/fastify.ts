import Fastify from 'fastify';
import { fastifyTRPCPlugin } from '@trpc/server/adapters/fastify';
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

async function main() {
  const fastify = Fastify();
  await fastify.register(fastifyTRPCPlugin, {
    prefix: '/trpc',
    trpcOptions: { router, createContext: () => ({}) },
  });
  await fastify.listen({ port: 3000 });
  const caller = router.createCaller({});
  console.log(await caller.helloController.hello({ name: 'world' }));
}

main();
