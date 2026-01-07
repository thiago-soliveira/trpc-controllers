import { z } from 'zod';
import { Router, Query, UseZod, Ctx, Input } from 'trpc-controllers';
import type { AppContext } from '../context';

@Router('math')
export class MathController {
  @Query('double')
  @UseZod(z.object({ x: z.number() }), z.number())
  double(@Ctx() _ctx: AppContext, @Input() input: { x: number }) {
    return input.x * 2;
  }
}
