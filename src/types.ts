type Last<T extends readonly unknown[]> = T extends readonly [...unknown[], infer L] ? L : never;

export type InferInput<TController, TKey extends keyof TController> =
  TController[TKey] extends (...args: infer A) => any
    ? A extends []
      ? void
      : Last<A>
    : never;

export type InferOutput<TController, TKey extends keyof TController> =
  TController[TKey] extends (...args: any[]) => infer R ? Awaited<R> : never;
