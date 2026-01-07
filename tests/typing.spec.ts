import { describe, it, expectTypeOf, expect } from 'vitest';
import { initTRPC } from '@trpc/server';
import { z } from 'zod';
import { makeDecorators } from '../src';

const t = initTRPC.create();
const { query, mutation, input, controllerToRouter } = makeDecorators(t);

class UserController {
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

const userRouter = controllerToRouter(new UserController());

describe('typing', () => {
  it('keeps literal route keys', () => {
    type Keys = keyof typeof userRouter['_def']['record'];
    expectTypeOf<Keys>().toEqualTypeOf<'getById' | 'create'>();
  });
});

describe('context isolation', () => {
  it('stores metadata separately for each decorator context', () => {
    const t1 = initTRPC.create();
    const d1 = makeDecorators(t1);
    const t2 = initTRPC.create();
    const d2 = makeDecorators(t2);

    class Ctrl {
      @d1.query()
      one() {
        return 1;
      }

      @d2.query()
      two() {
        return 2;
      }
    }

    const r1 = d1.controllerToRouter(new Ctrl());
    const r2 = d2.controllerToRouter(new Ctrl());

    expect(Object.keys(r1._def.record)).toEqual(['one']);
    expect(Object.keys(r2._def.record)).toEqual(['two']);
  });
});
