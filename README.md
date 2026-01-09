# trpc-controllers

Decorators and class-based routing for tRPC v11 with support for standard and legacy decorators.

## Installation

Requires Node.js >=18.

```bash
npm install trpc-controllers
```

## Quick Start

### Class-based routers

```ts
import { z } from 'zod';
import { initTRPC } from '@trpc/server';
import superjson from 'superjson';
import {
  Router,
  Query,
  Mutation,
  UseZod,
  UseMiddlewares,
  Auth,
  RateLimit,
  Ctx,
  Input,
  createClassRouter,
} from 'trpc-controllers';

interface AppContext {
  user?: { id: string; role: 'user' | 'admin' };
}

const t = initTRPC.context<AppContext>().create({ transformer: superjson });

const logger = async ({ path, type, next }) => {
  console.log(`[${type}] ${path}`);
  return next();
};

@Router('users')
@UseMiddlewares(logger)
export class UsersController {
  @Query('getById')
  @UseZod(z.object({ id: z.string() }))
  getById(@Ctx() _ctx: AppContext, @Input() input: { id: string }) {
    return { id: input.id };
  }

  @Mutation('create')
  @UseZod(z.object({ name: z.string() }))
  @Auth((ctx: AppContext) => (ctx.user?.role === 'admin' ? true : 'FORBIDDEN'))
  @RateLimit({ points: 5, durationSec: 60 })
  create(@Input() input: { name: string }) {
    return { id: '1', name: input.name };
  }
}

const { router: appRouter } = createClassRouter({
  t,
  controllers: { users: new UsersController() },
});

export type AppRouter = typeof appRouter;
```

Tip: use an object for `controllers` to preserve route keys in the inferred types, especially when you register multiple controllers.

### Low-level API

```ts
import { z } from 'zod';
import { initTRPC, TRPCError } from '@trpc/server';
import superjson from 'superjson';
import { makeDecorators } from 'trpc-controllers';

const t = initTRPC.context().create({ transformer: superjson });
const { query, mutation, input, controllerToRouter } = makeDecorators(t);

class UsersController {
  @query()
  @input(z.object({ id: z.string() }))
  getById({ input }: { input: { id: string } }) {
    return { id: input.id };
  }

  @mutation()
  @input(z.object({ name: z.string() }))
  create({ input }: { input: { name: string } }) {
    return { id: '1', name: input.name };
  }
}

const userRouter = controllerToRouter(new UsersController());
const appRouter = t.router({ user: userRouter });

export type AppRouter = typeof appRouter;
```

## Decorator compatibility

- Standard decorators (TypeScript 5) work for class/method decorators.
- Parameter decorators (`@Ctx`, `@Input`) require legacy decorators (`experimentalDecorators: true`).
- If you prefer standard decorators only, use resolvers that receive the tRPC resolver object (e.g. `({ ctx, input }) => {}`).

## Examples

See the [tests](./tests) directory for more examples and the [examples](./examples) folder for Express and Fastify adapters.

## Types package generation

Use `trpc-controllers types` to publish your server router types as a small npm package that any frontend can import.

1. Add a types-only package (e.g. `trpc-types/`) that re-exports your router and has a `tsconfig.json` that emits declarations only:

   ```json
   {
     "extends": "../tsconfig.json",
     "compilerOptions": {
       "composite": true,
       "declaration": true,
       "declarationMap": true,
       "emitDeclarationOnly": true,
       "module": "ESNext",
       "moduleResolution": "Bundler",
       "outDir": "dist",
       "types": []
     },
     "include": ["./src/**/*"]
   }
   ```

2. From the repo root, run:

   ```bash
   npx trpc-controllers types --project ./trpc-types/tsconfig.json
   ```

   This runs `tsc -p` and, if installed, `tsc-alias` to rewrite path aliases (skip with `--no-alias`).

3. Publish the generated package to npm with `types` pointing at the declaration output (e.g. `"types": "dist/index.d.ts"` and `"files": ["dist"]`).

4. In your frontend, install that package and use it for a typed client:

   ```ts
   import superjson from 'superjson';
   import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
   import type { AppRouter } from 'server-trpc-types';

   const trpc = createTRPCProxyClient<AppRouter>({
     transformer: superjson,
     links: [httpBatchLink({ url: '/trpc' })],
   });
   ```


## License

[MIT](./LICENSE)
