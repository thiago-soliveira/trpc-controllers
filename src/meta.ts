import type { AnyMiddlewareFunction } from '@trpc/server';
import type { z } from 'zod';

export type Middleware = AnyMiddlewareFunction;
export type GuardResult = true | false | 'UNAUTHORIZED' | 'FORBIDDEN';
export type Guard<TContext = unknown, TInput = unknown> = (
  ctx: TContext,
  input: TInput,
) => GuardResult | Promise<GuardResult>;
export type RateLimitOptions<TContext = unknown> = {
  points: number;
  durationSec: number;
  key?: (ctx: TContext) => string;
};

export type MethodKind = 'query' | 'mutation' | 'subscription';

export type MethodMeta = {
  kind?: MethodKind;
  name?: string;
  input?: z.ZodTypeAny;
  output?: z.ZodTypeAny;
  middlewares?: AnyMiddlewareFunction[];
  meta?: Record<string, unknown>;
};

export type ClassMeta = {
  name?: string;
  middlewares?: AnyMiddlewareFunction[];
  meta?: Record<string, unknown>;
};

export type ParamMeta = {
  ctxIndex?: number;
  inputIndex?: number;
};

export type DecoratorStore = {
  class?: ClassMeta;
  methods?: Record<PropertyKey, MethodMeta>;
  params?: Record<PropertyKey, ParamMeta>;
};

const META_KEY = Symbol('trpc-controllers');
const metadataSymbol = ((Symbol as any).metadata ??= Symbol('Symbol.metadata')) as symbol;

function ensureStore(holder: Record<PropertyKey, unknown>): DecoratorStore {
  return (holder[META_KEY] ??= {}) as DecoratorStore;
}

export function getStoreFromContext(context: any): DecoratorStore {
  const metaObj = ((context as any).metadata ??= {}) as Record<PropertyKey, unknown>;
  return ensureStore(metaObj);
}

export function getStoreFromCtor(ctor: any): DecoratorStore {
  return ensureStore(ctor as Record<PropertyKey, unknown>);
}

function mergeArrays<T>(a?: T[], b?: T[]): T[] | undefined {
  if (!a?.length && !b?.length) return undefined;
  return [...(a ?? []), ...(b ?? [])];
}

function mergeMetaObjects(
  a?: Record<string, unknown>,
  b?: Record<string, unknown>,
): Record<string, unknown> | undefined {
  if (!a && !b) return undefined;
  return { ...(a ?? {}), ...(b ?? {}) };
}

function mergeClassMeta(a?: ClassMeta, b?: ClassMeta): ClassMeta | undefined {
  if (!a && !b) return undefined;
  return {
    name: b?.name ?? a?.name,
    middlewares: mergeArrays(a?.middlewares, b?.middlewares),
    meta: mergeMetaObjects(a?.meta, b?.meta),
  };
}

function mergeMethodMeta(a?: MethodMeta, b?: MethodMeta): MethodMeta | undefined {
  if (!a && !b) return undefined;
  return {
    kind: b?.kind ?? a?.kind,
    name: b?.name ?? a?.name,
    input: b?.input ?? a?.input,
    output: b?.output ?? a?.output,
    middlewares: mergeArrays(a?.middlewares, b?.middlewares),
    meta: mergeMetaObjects(a?.meta, b?.meta),
  };
}

function mergeParamMeta(a?: ParamMeta, b?: ParamMeta): ParamMeta | undefined {
  if (!a && !b) return undefined;
  return {
    ctxIndex: b?.ctxIndex ?? a?.ctxIndex,
    inputIndex: b?.inputIndex ?? a?.inputIndex,
  };
}

function ownKeys(obj?: Record<PropertyKey, unknown>): PropertyKey[] {
  return obj ? (Reflect.ownKeys(obj) as PropertyKey[]) : [];
}

function mergeRecord<T>(
  a: Record<PropertyKey, T> | undefined,
  b: Record<PropertyKey, T> | undefined,
  mergeValue: (x?: T, y?: T) => T | undefined,
): Record<PropertyKey, T> | undefined {
  const keys = new Set<PropertyKey>([...ownKeys(a), ...ownKeys(b)]);
  if (!keys.size) return undefined;
  const result: Record<PropertyKey, T> = {};
  for (const key of keys) {
    const merged = mergeValue(a?.[key], b?.[key]);
    if (merged !== undefined) result[key] = merged;
  }
  return result;
}

export function readStore(ctor: any): DecoratorStore {
  const legacy = (ctor as any)[META_KEY] as DecoratorStore | undefined;
  const standard = ((ctor as any)[metadataSymbol] as any)?.[META_KEY] as DecoratorStore | undefined;
  return {
    class: mergeClassMeta(legacy?.class, standard?.class),
    methods: mergeRecord(legacy?.methods, standard?.methods, mergeMethodMeta),
    params: mergeRecord(legacy?.params, standard?.params, mergeParamMeta),
  };
}
