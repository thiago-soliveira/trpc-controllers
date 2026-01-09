import type { z } from 'zod';
import type {
  AnyMiddlewareFunction,
  AnyProcedure,
  TRPCRootObject,
  TRPCRuntimeConfigOptions,
} from '@trpc/server';
import { TRPCError } from '@trpc/server';
import {
  getStoreFromContext,
  getStoreFromCtor,
  type ClassMeta,
  type DecoratorStore,
  type Guard,
  type MethodMeta,
  type ParamMeta,
  type RateLimitOptions,
} from './meta';

function isDecoratorContext(value: unknown): value is { kind: string; name?: PropertyKey } {
  return !!value && typeof value === 'object' && 'kind' in value;
}

function ensureClassMeta(store: DecoratorStore): ClassMeta {
  return (store.class ??= {});
}

function ensureMethodMeta(store: DecoratorStore, name: PropertyKey): MethodMeta {
  const methods = (store.methods ??= {});
  return (methods[name] ??= {});
}

function ensureParamMeta(store: DecoratorStore, name: PropertyKey): ParamMeta {
  const params = (store.params ??= {});
  return (params[name] ??= {});
}

function methodStoreFromArgs(args: any[]): { meta: MethodMeta; name: PropertyKey } | null {
  if (isDecoratorContext(args[1])) {
    const context = args[1];
    const store = getStoreFromContext(context);
    const name = context.name as PropertyKey | undefined;
    if (!name) return null;
    return { meta: ensureMethodMeta(store, name), name };
  }
  const target = args[0];
  const name = args[1] as PropertyKey;
  if (!name) return null;
  const ctor = typeof target === 'function' ? target : target?.constructor;
  if (!ctor) return null;
  const store = getStoreFromCtor(ctor);
  return { meta: ensureMethodMeta(store, name), name };
}

function classStoreFromArgs(args: any[]): ClassMeta | null {
  if (isDecoratorContext(args[1])) {
    const context = args[1];
    if (context.kind !== 'class') return null;
    const store = getStoreFromContext(context);
    return ensureClassMeta(store);
  }
  const ctor = args[0];
  if (typeof ctor !== 'function') return null;
  const store = getStoreFromCtor(ctor);
  return ensureClassMeta(store);
}

function createMethodDecorator(apply: (meta: MethodMeta) => void) {
  return (...args: any[]) => {
    const entry = methodStoreFromArgs(args);
    if (!entry) return;
    apply(entry.meta);
  };
}

function createClassDecorator(apply: (meta: ClassMeta) => void) {
  return (...args: any[]) => {
    const meta = classStoreFromArgs(args);
    if (!meta) return;
    apply(meta);
  };
}

function createClassOrMethodDecorator(
  applyClass: (meta: ClassMeta) => void,
  applyMethod: (meta: MethodMeta) => void,
) {
  return (...args: any[]) => {
    if (isDecoratorContext(args[1])) {
      const context = args[1];
      if (context.kind === 'class') {
        const store = getStoreFromContext(context);
        applyClass(ensureClassMeta(store));
        return;
      }
      const store = getStoreFromContext(context);
      applyMethod(ensureMethodMeta(store, context.name ?? ''));
      return;
    }
    if (args.length === 1) {
      const meta = classStoreFromArgs(args);
      if (!meta) return;
      applyClass(meta);
      return;
    }
    const entry = methodStoreFromArgs(args);
    if (!entry) return;
    applyMethod(entry.meta);
  };
}

function normalizeMiddlewares(
  middlewares: (AnyMiddlewareFunction | AnyMiddlewareFunction[])[],
): AnyMiddlewareFunction[] {
  const flat: AnyMiddlewareFunction[] = [];
  for (const item of middlewares) {
    if (Array.isArray(item)) flat.push(...item);
    else if (item) flat.push(item);
  }
  return flat;
}

const rateLimitStore = new Map<
  string,
  {
    count: number;
    resetAt: number;
  }
>();

function createAuthMiddleware<TContext, TInput>(guard: Guard<TContext, TInput>): AnyMiddlewareFunction {
  return async ({ ctx, input, next }) => {
    const result = await guard(ctx as TContext, input as TInput);
    if (result === true) return next();
    if (result === 'FORBIDDEN' || result === 'UNAUTHORIZED') {
      throw new TRPCError({ code: result });
    }
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  };
}

function createRateLimitMiddleware<TContext>(options: RateLimitOptions<TContext>): AnyMiddlewareFunction {
  const durationMs = Math.max(1, options.durationSec) * 1000;
  return async ({ ctx, path, next }) => {
    const keyPart = options.key ? options.key(ctx as any) : 'global';
    const key = `${path ?? 'unknown'}:${keyPart ?? 'global'}`;
    const now = Date.now();
    const entry = rateLimitStore.get(key);
    if (!entry || now >= entry.resetAt) {
      rateLimitStore.set(key, { count: 1, resetAt: now + durationMs });
      return next();
    }
    entry.count += 1;
    if (entry.count > options.points) {
      throw new TRPCError({ code: 'TOO_MANY_REQUESTS' });
    }
    return next();
  };
}

export function Router(name?: string) {
  return createClassDecorator((meta) => {
    if (name) meta.name = name;
  });
}

export function Query(name?: string) {
  return createMethodDecorator((meta) => {
    meta.kind = 'query';
    if (name) meta.name = name;
  });
}

export function Mutation(name?: string) {
  return createMethodDecorator((meta) => {
    meta.kind = 'mutation';
    if (name) meta.name = name;
  });
}

export function Subscription(name?: string) {
  return createMethodDecorator((meta) => {
    meta.kind = 'subscription';
    if (name) meta.name = name;
  });
}

export function UseZod(input: z.ZodTypeAny, output?: z.ZodTypeAny) {
  return createMethodDecorator((meta) => {
    meta.input = input;
    if (output) meta.output = output;
  });
}

export function UseMiddlewares(...middlewares: (AnyMiddlewareFunction | AnyMiddlewareFunction[])[]) {
  return createClassOrMethodDecorator(
    (meta) => {
      meta.middlewares = [...(meta.middlewares ?? []), ...normalizeMiddlewares(middlewares)];
    },
    (meta) => {
      meta.middlewares = [...(meta.middlewares ?? []), ...normalizeMiddlewares(middlewares)];
    },
  );
}

export function Auth<TContext = unknown, TInput = unknown>(guard: Guard<TContext, TInput>) {
  const mw = createAuthMiddleware(guard);
  return createClassOrMethodDecorator(
    (meta) => {
      meta.middlewares = [...(meta.middlewares ?? []), mw];
    },
    (meta) => {
      meta.middlewares = [...(meta.middlewares ?? []), mw];
    },
  );
}

export function RateLimit<TContext = unknown>(options: RateLimitOptions<TContext>) {
  const mw = createRateLimitMiddleware(options);
  return createClassOrMethodDecorator(
    (meta) => {
      meta.middlewares = [...(meta.middlewares ?? []), mw];
    },
    (meta) => {
      meta.middlewares = [...(meta.middlewares ?? []), mw];
    },
  );
}

export function Meta(meta: Record<string, unknown>) {
  return createClassOrMethodDecorator(
    (classMeta) => {
      classMeta.meta = { ...(classMeta.meta ?? {}), ...meta };
    },
    (methodMeta) => {
      methodMeta.meta = { ...(methodMeta.meta ?? {}), ...meta };
    },
  );
}

export function Ctx() {
  return (target: any, propertyKey: string | symbol, parameterIndex: number) => {
    if (typeof parameterIndex !== 'number' || !propertyKey) return;
    const ctor = typeof target === 'function' ? target : target?.constructor;
    if (!ctor) return;
    const store = getStoreFromCtor(ctor);
    ensureMethodMeta(store, propertyKey);
    const meta = ensureParamMeta(store, propertyKey);
    meta.ctxIndex = parameterIndex;
  };
}

export function Input() {
  return (target: any, propertyKey: string | symbol, parameterIndex: number) => {
    if (typeof parameterIndex !== 'number' || !propertyKey) return;
    const ctor = typeof target === 'function' ? target : target?.constructor;
    if (!ctor) return;
    const store = getStoreFromCtor(ctor);
    ensureMethodMeta(store, propertyKey);
    const meta = ensureParamMeta(store, propertyKey);
    meta.inputIndex = parameterIndex;
  };
}

export function makeDecorators<
  TContext extends object,
  TMeta extends object,
  TOptions extends TRPCRuntimeConfigOptions<TContext, TMeta>,
>(t: TRPCRootObject<TContext, TMeta, TOptions>) {
  (Symbol as any).metadata ??= Symbol('Symbol.metadata');
  const metadataSymbol = ((Symbol as any).metadata ??= Symbol('Symbol.metadata')) as symbol;
  const META_KEY = Symbol('trpc');
  type MethodMeta = {
    kind: 'query' | 'mutation';
    input?: z.ZodTypeAny;
    use?: AnyMiddlewareFunction[];
    meta?: Record<string, unknown>;
  };
  type MethodDec = (...args: any[]) => void;

  function getMetaFromContext(context: any): MethodMeta {
    const metaObj = ((context as any).metadata ??= {}) as Record<PropertyKey, any>;
    const byName = (metaObj[META_KEY] ??= {} as Record<PropertyKey, MethodMeta>);
    const all = (byName[context.name] ??= {} as MethodMeta);
    if (!('kind' in all)) all.kind = 'query';
    return all;
  }

  function getMetaFromTarget(target: any, name: PropertyKey): MethodMeta {
    const ctor = typeof target === 'function' ? target : target?.constructor;
    if (!ctor) return {} as MethodMeta;
    const byName = ((ctor as any)[META_KEY] ??= {} as Record<PropertyKey, MethodMeta>);
    const all = (byName[name] ??= {} as MethodMeta);
    if (!('kind' in all)) all.kind = 'query';
    return all;
  }

  function getMeta(args: any[]): MethodMeta {
    if (isDecoratorContext(args[1])) {
      return getMetaFromContext(args[1]);
    }
    return getMetaFromTarget(args[0], args[1]);
  }

  function applyOpts(
    meta: MethodMeta,
    opts?: {
      input?: z.ZodTypeAny;
      use?: AnyMiddlewareFunction | AnyMiddlewareFunction[];
      meta?: Record<string, unknown>;
    },
  ) {
    if (!opts) return;
    if (opts.input) meta.input = opts.input;
    if (opts.use) {
      const arr = Array.isArray(opts.use) ? opts.use : [opts.use];
      meta.use = [...(meta.use ?? []), ...arr];
    }
    if (opts.meta) meta.meta = { ...(meta.meta ?? {}), ...opts.meta };
  }

  function query(
    opts?: {
      input?: z.ZodTypeAny;
      use?: AnyMiddlewareFunction | AnyMiddlewareFunction[];
      meta?: Record<string, unknown>;
    },
  ): MethodDec {
    return (...args) => {
      const meta = getMeta(args);
      meta.kind = 'query';
      applyOpts(meta, opts);
    };
  }

  function mutation(
    opts?: {
      input?: z.ZodTypeAny;
      use?: AnyMiddlewareFunction | AnyMiddlewareFunction[];
      meta?: Record<string, unknown>;
    },
  ): MethodDec {
    return (...args) => {
      const meta = getMeta(args);
      meta.kind = 'mutation';
      applyOpts(meta, opts);
    };
  }

  function input(schema: z.ZodTypeAny): MethodDec {
    return (...args) => {
      const meta = getMeta(args);
      meta.input = schema;
    };
  }

  function use(mw: AnyMiddlewareFunction): MethodDec {
    return (...args) => {
      const meta = getMeta(args);
      meta.use = [...(meta.use ?? []), mw];
    };
  }

  function meta(extra: Record<string, unknown>): MethodDec {
    return (...args) => {
      const m = getMeta(args);
      m.meta = { ...(m.meta ?? {}), ...extra };
    };
  }

  function controllerToRouter<T extends Record<string, any>>(instance: T) {
    const ctor = instance.constructor as any;
    const metas: Record<string, MethodMeta> | undefined =
      ((ctor[metadataSymbol] as any)?.[META_KEY] as any) ?? (ctor as any)[META_KEY];
    const record: Record<string, any> = {};
    if (metas) {
      for (const [name, m] of Object.entries(metas)) {
        let builder = t.procedure;
        if (m.use) for (const mw of m.use) builder = builder.use(mw);
        if (m.meta) builder = builder.meta(m.meta as any);
        if (m.input) builder = builder.input(m.input);
        const resolver = (instance as any)[name].bind(instance);
        record[name] =
          m.kind === 'mutation'
            ? builder.mutation(resolver)
            : builder.query(resolver);
      }
    }
    type Keys = {
      [K in keyof T]: T[K] extends (...args: any[]) => any ? K : never;
    }[keyof T];
    return t.router(record as Record<Extract<Keys, string>, AnyProcedure>);
  }

  return { query, mutation, input, use, meta, controllerToRouter } as const;
}

export type ControllerToRouter = ReturnType<typeof makeDecorators>['controllerToRouter'];
