import express from 'express';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { initTRPC } from '@trpc/server';
import superjson from 'superjson';
import { UsersController } from './controllers/users.controller';
import { MathController } from './controllers/math.controller';
import { UsersService } from './services/users.service';
import type { AppContext } from './context';
import { createClassRouter } from 'trpc-controllers';

const t = initTRPC.context<AppContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return { ...shape, message: error.message };
  },
});

const usersService = new UsersService();

const { router: appRouter } = createClassRouter({
  t,
  controllers: {
    users: new UsersController(usersService),
    math: new MathController(),
  },
});

export type AppRouter = typeof appRouter;
export const createCaller = (ctx: AppContext) => appRouter.createCaller(ctx);

export async function start() {
  const app = express();
  app.use(
    '/trpc',
    createExpressMiddleware({
      router: appRouter,
      createContext: ({ req }) => {
        const id = req.headers['x-user-id'];
        const role = req.headers['x-user-role'];
        if (typeof id === 'string' && (role === 'user' || role === 'admin')) {
          return { user: { id, role } };
        }
        return {};
      },
    })
  );
  const port = 3000;
  await app.listen(port);
  console.log(`Server running on http://localhost:${port}/trpc`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  start();
}
