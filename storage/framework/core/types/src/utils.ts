/**
 * Null or whatever.
 */
export type Nullable<T> = T | null | undefined

/**
 * Function
 */
export type Fn<T = void> = () => T

/**
 * Array, or not yet
 */
export type Arrayable<T> = T | Array<T>

/**
 * Constructor.
 */
export type Constructor<T = void> = new (..._args: any[]) => T

/**
 * Defines an intersection type of all union items.
 *
 * @param U Union of any types that will be intersected.
 * @returns U items intersected
 * @see https://stackoverflow.com/a/50375286/9259330
 */
export type UnionToIntersection<U> = (U extends unknown ? (k: U) => void : never) extends (k: infer I) => void
  ? I
  : never

export type MergeInsertions<T> = T extends object ? { [K in keyof T]: MergeInsertions<T[K]> } : T

type MergeLeaf = Date | RegExp | Error | ReadonlyMap<unknown, unknown> | ReadonlySet<unknown>
  | WeakMap<object, unknown> | WeakSet<object> | PromiseLike<unknown> | ArrayBuffer | ArrayBufferView
  | URL | URLSearchParams | Blob | Headers | Request | Response | FormData | ((...args: any[]) => unknown)

/** Plain records merge recursively; arrays, primitives and built-in instances are values. */
export type DeepMerge<F, S> = S extends MergeLeaf | readonly unknown[] ? S
  : S extends object
    ? F extends MergeLeaf | readonly unknown[] ? S
      : F extends object ? {
        [K in keyof F | keyof S]: K extends keyof S & keyof F
          ? {} extends Pick<S, K> ? F[K] | DeepMerge<F[K], S[K]> : DeepMerge<F[K], S[K]>
          : K extends keyof S ? S[K] : K extends keyof F ? F[K] : never
      } : S
    : S

export type DeepPartial<T> = {
  [P in keyof T]?: DeepPartial<T[P]>
}
