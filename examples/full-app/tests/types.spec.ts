import { describe, it, expectTypeOf } from 'vitest';
import { createCaller } from '../src/server';
import type { AppContext } from '../src/context';
import { UsersController } from '../src/controllers/users.controller';
import { MathController } from '../src/controllers/math.controller';
import type { InferInput, InferOutput } from 'trpc-controllers';

describe('types', () => {
  it('users.getById', () => {
    expectTypeOf<InferInput<UsersController, 'getById'>>().toEqualTypeOf<{ id: string }>();
    expectTypeOf<InferOutput<UsersController, 'getById'>>().toEqualTypeOf<{
      id: string;
      name: string;
      email: string;
      createdAt: Date;
    } | undefined>();
  });

  it('users.create', () => {
    expectTypeOf<InferInput<UsersController, 'create'>>().toEqualTypeOf<{ name: string; email: string }>();
    expectTypeOf<InferOutput<UsersController, 'create'>>().toEqualTypeOf<{
      id: string;
      name: string;
      email: string;
      createdAt: Date;
    }>();
  });

  it('math.double', () => {
    expectTypeOf<InferInput<MathController, 'double'>>().toEqualTypeOf<{ x: number }>();
    expectTypeOf<InferOutput<MathController, 'double'>>().toEqualTypeOf<number>();
  });

  it('createCaller accepts AppContext', () => {
    expectTypeOf(createCaller).parameters.toEqualTypeOf<[AppContext]>();
  });
});
