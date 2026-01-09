import type {
  AnyProcedure,
  AnyRouter,
  AnyTRPCRootTypes,
  TRPCBuiltRouter,
  TRPCMutationProcedure,
  TRPCQueryProcedure,
  TRPCRouterRecord,
  TRPCSubscriptionProcedure,
  TRPCRootObject,
  TRPCRuntimeConfigOptions,
} from '@trpc/server';
import { readStore, type ClassMeta, type MethodMeta, type ParamMeta } from './meta';
import type { InferInput, InferOutput } from './types';

type ControllersInput = readonly Record<string, any>[] | Record<string, Record<string, any>>;

type BuiltRouter<
  TRoot extends AnyTRPCRootTypes,
  TRecord extends TRPCRouterRecord,
> = TRPCBuiltRouter<TRoot, TRecord>;

type RootTypesOf<
  TContext extends object,
  TMeta extends object,
  TOptions extends TRPCRuntimeConfigOptions<TContext, TMeta>,
> = TRPCRootObject<TContext, TMeta, TOptions>['_config']['$types'];

type ControllerMethodKeys<TController> = {
  [K in keyof TController]: TController[K] extends (...args: any[]) => any ? K : never;
}[keyof TController];

type ControllerProcedure<
  TController,
  K extends ControllerMethodKeys<TController>,
> = InferOutput<TController, K> extends AsyncIterable<any>
  ? TRPCSubscriptionProcedure<{
      input: InferInput<TController, K>;
      output: InferOutput<TController, K>;
      meta: unknown;
    }>
  :
      | TRPCQueryProcedure<{
          input: InferInput<TController, K>;
          output: InferOutput<TController, K>;
          meta: unknown;
        }>
      | TRPCMutationProcedure<{
          input: InferInput<TController, K>;
          output: InferOutput<TController, K>;
          meta: unknown;
        }>;

type ControllerRecord<TController> = {
  [K in Extract<ControllerMethodKeys<TController>, string>]: ControllerProcedure<
    TController,
    K
  >;
};

type ControllersRecord<TControllers> = TControllers extends readonly any[]
  ? Record<string, ControllerRecord<TControllers[number]>>
  : { [K in keyof TControllers]: ControllerRecord<TControllers[K]> };

type ControllerRouters<TControllers, TRoot extends AnyTRPCRootTypes> =
  TControllers extends readonly any[]
    ? Record<string, BuiltRouter<TRoot, ControllerRecord<TControllers[number]>>>
    : { [K in keyof TControllers]: BuiltRouter<TRoot, ControllerRecord<TControllers[K]>> };

export type ClassRouterRootTypes<
  TContext extends object,
  TMeta extends object,
  TOptions extends TRPCRuntimeConfigOptions<TContext, TMeta>,
> = RootTypesOf<TContext, TMeta, TOptions>;

export type ClassRouter<
  TContext extends object,
  TMeta extends object,
  TOptions extends TRPCRuntimeConfigOptions<TContext, TMeta>,
  TControllers extends ControllersInput,
> = BuiltRouter<ClassRouterRootTypes<TContext, TMeta, TOptions>, ControllersRecord<TControllers>>;

export type ClassRouters<
  TContext extends object,
  TMeta extends object,
  TOptions extends TRPCRuntimeConfigOptions<TContext, TMeta>,
  TControllers extends ControllersInput,
> = ControllerRouters<TControllers, ClassRouterRootTypes<TContext, TMeta, TOptions>>;

export type CreateClassRouterResult<
  TContext extends object,
  TMeta extends object,
  TOptions extends TRPCRuntimeConfigOptions<TContext, TMeta>,
  TControllers extends ControllersInput,
> = {
  router: ClassRouter<TContext, TMeta, TOptions, TControllers>;
  routers: ClassRouters<TContext, TMeta, TOptions, TControllers>;
};

function defaultRouterName(ctorName: string) {
  if (!ctorName) return 'router';
  return ctorName.charAt(0).toLowerCase() + ctorName.slice(1);
}

function buildResolver<T extends Record<string, any>>(
  instance: T,
  methodName: string,
  paramMeta?: ParamMeta,
) {
  const method = (instance as any)[methodName];
  if (typeof method !== 'function') {
    throw new Error(`tRPC handler "${methodName}" is not a function`);
  }
  const bound = method.bind(instance);
  if (!paramMeta || (paramMeta.ctxIndex == null && paramMeta.inputIndex == null)) {
    return bound;
  }
  return (opts: { ctx: unknown; input: unknown }) => {
    const args: unknown[] = [];
    if (paramMeta.ctxIndex != null) args[paramMeta.ctxIndex] = opts.ctx;
    if (paramMeta.inputIndex != null) args[paramMeta.inputIndex] = opts.input;
    return bound(...args);
  };
}

function buildProcedure<
  TContext extends object,
  TMeta extends object,
  TOptions extends TRPCRuntimeConfigOptions<TContext, TMeta>,
>(
  t: TRPCRootObject<TContext, TMeta, TOptions>,
  instance: Record<string, any>,
  methodName: string,
  classMeta: ClassMeta,
  methodMeta: MethodMeta,
  paramMeta?: ParamMeta,
) {
  let builder = t.procedure;
  if (classMeta.middlewares) {
    for (const mw of classMeta.middlewares) builder = builder.use(mw);
  }
  if (methodMeta.middlewares) {
    for (const mw of methodMeta.middlewares) builder = builder.use(mw);
  }
  const combinedMeta = { ...(classMeta.meta ?? {}), ...(methodMeta.meta ?? {}) };
  if (Object.keys(combinedMeta).length) builder = builder.meta(combinedMeta as any);
  if (methodMeta.input) builder = builder.input(methodMeta.input);
  if (methodMeta.output) builder = builder.output(methodMeta.output);
  const resolver = buildResolver(instance, methodName, paramMeta);
  const kind = methodMeta.kind ?? 'query';
  if (kind === 'mutation') return builder.mutation(resolver as any);
  if (kind === 'subscription') return (builder as any).subscription(resolver as any);
  return builder.query(resolver as any);
}

function controllerToRouter<
  TContext extends object,
  TMeta extends object,
  TOptions extends TRPCRuntimeConfigOptions<TContext, TMeta>,
  TController extends Record<string, any>,
>(
  t: TRPCRootObject<TContext, TMeta, TOptions>,
  instance: TController,
): {
  name?: string;
  router: BuiltRouter<
    RootTypesOf<TContext, TMeta, TOptions>,
    ControllerRecord<TController>
  >;
} {
  const ctor = instance.constructor as any;
  const store = readStore(ctor);
  const classMeta = store.class ?? {};
  const methods = store.methods ?? {};
  const params = store.params ?? {};
  const record: Record<string, AnyProcedure> = {};
  for (const key of Reflect.ownKeys(methods)) {
    if (typeof key !== 'string') continue;
    const methodMeta = methods[key] as MethodMeta;
    const routeName = methodMeta.name ?? key;
    if (record[routeName]) {
      throw new Error(`Duplicate tRPC route name "${routeName}" in ${ctor?.name ?? 'controller'}`);
    }
    const procedure = buildProcedure(t, instance, key, classMeta, methodMeta, params[key]);
    record[routeName] = procedure;
  }
  return {
    name: classMeta.name,
    router: t.router(record as Record<string, AnyProcedure>) as BuiltRouter<
      RootTypesOf<TContext, TMeta, TOptions>,
      ControllerRecord<TController>
    >,
  };
}

export function createClassRouter<
  TContext extends object,
  TMeta extends object,
  TOptions extends TRPCRuntimeConfigOptions<TContext, TMeta>,
  TControllers extends ControllersInput,
>({
  t,
  controllers,
}: {
  t: TRPCRootObject<TContext, TMeta, TOptions>;
  controllers: TControllers;
}): CreateClassRouterResult<TContext, TMeta, TOptions, TControllers> {
  const routers = {} as ControllerRouters<
    TControllers,
    RootTypesOf<TContext, TMeta, TOptions>
  >;
  if (Array.isArray(controllers)) {
    for (const controller of controllers) {
      const { name, router } = controllerToRouter(t, controller);
      const key = name ?? defaultRouterName(controller.constructor?.name ?? '');
      if ((routers as Record<string, AnyRouter>)[key]) {
        throw new Error(`Duplicate controller router name "${key}"`);
      }
      (routers as Record<string, AnyRouter>)[key] = router;
    }
  } else {
    for (const [key, controller] of Object.entries(controllers)) {
      const { router } = controllerToRouter(t, controller);
      (routers as Record<string, AnyRouter>)[key] = router;
    }
  }
  const router = t.router(routers as Record<string, AnyRouter>) as BuiltRouter<
    RootTypesOf<TContext, TMeta, TOptions>,
    ControllersRecord<TControllers>
  >;
  return { router, routers };
}
