import { z } from 'zod';
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
  Middleware,
} from 'trpc-controllers';
import type { AppContext } from '../context';
import { UsersService } from '../services/users.service';

const logger: Middleware = async ({ path, type, next }) => {
  console.log(`[${type}] ${path}`);
  return next();
};

@Router('users')
@UseMiddlewares(logger)
@Auth((ctx: AppContext) => (!!ctx.user ? true : 'UNAUTHORIZED'))
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Query('getById')
  @UseZod(z.object({ id: z.string().uuid() }))
  @RateLimit({ points: 1, durationSec: 1 })
  getById(@Ctx() _ctx: AppContext, @Input() input: { id: string }) {
    return this.users.findById(input.id);
  }

  @Mutation('create')
  @UseZod(z.object({ name: z.string().min(3), email: z.string().email() }))
  @Auth((ctx: AppContext) => (ctx.user?.role === 'admin' ? true : 'FORBIDDEN'))
  create(@Input() input: { name: string; email: string }) {
    return this.users.create(input);
  }
}
