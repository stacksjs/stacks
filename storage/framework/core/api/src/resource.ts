/**
 * API Resources
 *
 * Laravel-like API resources for transforming models and collections
 * into JSON responses with fine-grained control.
 *
 * @example
 * class UserResource extends JsonResource<User> {
 *   toArray() {
 *     return {
 *       id: this.resource.id,
 *       name: this.resource.name,
 *       email: this.resource.email,
 *       posts: PostResource.collection(this.whenLoaded('posts')),
 *       created_at: this.resource.created_at,
 *     }
 *   }
 * }
 *
 * // Usage
 * return new UserResource(user).toResponse()
 * return UserResource.collection(users).toResponse()
 */
import { toPaginator } from '@stacksjs/pagination'
import { withQuery } from './query'

type Request = Record<string, unknown>

/**
 * Wrapper value types for conditional inclusion
 */
export class MissingValue {
  static instance = new MissingValue()
  isMissing(): boolean {
    return true
  }
}

export class MergeValue {
  constructor(public data: Record<string, any>) {}
}

export class ConditionalValue {
  constructor(
    public condition: boolean | (() => boolean),
    public value: any,
    public defaultValue: any = new MissingValue(),
  ) {}

  resolve(): any {
    const shouldInclude = typeof this.condition === 'function' ? this.condition() : this.condition
    return shouldInclude ? this.value : this.defaultValue
  }
}

/**
 * Pagination metadata structure
 */
export interface PaginationMeta {
  current_page: number
  from: number | null
  last_page: number
  per_page: number
  to: number | null
  total: number
}

export interface PaginationLinks {
  first: string | null
  last: string | null
  prev: string | null
  next: string | null
}

export interface PaginatedData<T> {
  data: T[]
  meta: PaginationMeta
  links: PaginationLinks
}

interface ResolutionContext { depth: number, ancestors: WeakSet<object> }
const mergePayloads = new WeakMap<object, Record<string, unknown>>()
const MAX_RESOLVE_DEPTH = 20

/** One resolver owns wrapper handling and the depth/cycle budget at every nesting level. */
function resolveValue(value: unknown, request: Request | undefined, context: ResolutionContext): unknown {
  if (value instanceof MissingValue || value === null || typeof value !== 'object' || value instanceof Date) return value
  if (context.depth >= MAX_RESOLVE_DEPTH) throw new RangeError('Resource serialization exceeded the maximum depth')
  if (context.ancestors.has(value)) throw new TypeError('Resource serialization contains a cycle')
  context.ancestors.add(value)
  const next = { depth: context.depth + 1, ancestors: context.ancestors }
  try {
    if (value instanceof ConditionalValue) return resolveValue(value.resolve(), request, next)
    if (value instanceof MergeValue) return resolveValue(value.data, request, next)
    const merge = mergePayloads.get(value)
    if (merge) return resolveValue(merge, request, next)
    if (value instanceof JsonResource || value instanceof ResourceCollection) return value.resolveAt(request, next)
    if (Array.isArray(value)) {
      const result: unknown[] = []
      for (const item of value) {
        const resolved = resolveValue(item, request, next)
        if (!(resolved instanceof MissingValue)) result.push(resolved)
      }
      return result
    }
    if ('toJSON' in value && typeof value.toJSON === 'function') return resolveValue(value.toJSON(), request, next)
    const entries: Array<[string, unknown]> = []
    for (const [key, item] of Object.entries(value)) {
      const resolved = resolveValue(item, request, next)
      if (resolved instanceof MissingValue) continue
      if (item instanceof MergeValue || (item !== null && typeof item === 'object' && mergePayloads.has(item))) {
        entries.push(...Object.entries(resolved as Record<string, unknown>))
      }
      else entries.push([key, resolved])
    }
    return Object.fromEntries(entries)
  }
  finally { context.ancestors.delete(value) }
}

/**
 * Base JSON Resource class
 *
 * Extend this class to create custom API resources that transform
 * your models into JSON-serializable objects.
 */
export abstract class JsonResource<T = unknown> {
  /** The resource instance being transformed */
  public resource: T

  /** Additional data to merge with the resource */
  public additional: Record<string, any> = {}

  /** The current request (if available) */
  protected request?: Request

  /** Wrap the data in a "data" key */
  public static wrap: string | null = 'data'

  /** Additional meta to include at the top level */
  protected static additionalMeta: Record<string, any> = {}

  constructor(resource: T) {
    this.resource = resource
  }

  /**
   * Transform the resource into an array/object.
   * Override this method in your resource class.
   */
  abstract toArray(request?: Request): Record<string, any>

  /**
   * Set the request instance
   */
  withRequest(request: Request): this {
    this.request = request
    return this
  }

  /**
   * Add additional data to the resource response
   */
  withAdditional(data: Record<string, any>): this {
    this.additional = { ...this.additional, ...data }
    return this
  }

  /**
   * Transform to a plain object (resolving all conditional values)
   */
  resolve(request?: Request): Record<string, any> {
    return resolveValue(this, request, { depth: 0, ancestors: new WeakSet() }) as Record<string, any>
  }

  /** @internal Preserve the caller's depth/cycle budget and request in nested resources. */
  resolveAt(request: Request | undefined, context: ResolutionContext): Record<string, any> {
    const req = request ?? this.request
    return resolveValue(this.toArray(req), req, context) as Record<string, any>
  }

  /**
   * Convert the resource to a JSON response object
   */
  toResponse(request?: Request): Record<string, any> {
    const data = this.resolve(request)
    const wrap = (this.constructor as typeof JsonResource).wrap

    if (wrap) {
      return {
        [wrap]: data,
        ...this.additional,
      }
    }

    return { ...data, ...this.additional }
  }

  /**
   * Convert to JSON string
   */
  toJson(request?: Request): string {
    return JSON.stringify(this.toResponse(request))
  }

  /**
   * Standard JavaScript serialization hook.
   * Called automatically by JSON.stringify() for proper resource serialization.
   */
  toJSON(): Record<string, unknown> {
    return this.toResponse()
  }

  /**
   * Create a resource collection
   */
  static collection<T, R extends JsonResource<T>>(
    this: new (resource: T) => R,
    resources: T[],
  ): ResourceCollection<T, R> {
    return new ResourceCollection(resources, this)
  }

  /**
   * Conditionally include a value
   *
   * @example
   * return {
   *   secret: this.when(user.isAdmin, this.resource.secret),
   * }
   */
  protected when<V>(condition: boolean | (() => boolean), value: V | (() => V), defaultValue?: any): V | MissingValue {
    const shouldInclude = typeof condition === 'function' ? condition() : condition

    if (shouldInclude) {
      return typeof value === 'function' ? (value as () => V)() : value
    }

    return defaultValue !== undefined ? defaultValue : MissingValue.instance
  }

  /**
   * Conditionally include a value when it's not null/undefined
   */
  protected whenNotNull<V>(value: V | null | undefined, transform?: (v: V) => any): any | MissingValue {
    if (value === null || value === undefined) {
      return MissingValue.instance
    }
    return transform ? transform(value) : value
  }

  /**
   * Include a value when a relationship is loaded
   *
   * @example
   * return {
   *   posts: this.whenLoaded('posts', () => PostResource.collection(this.resource.posts)),
   * }
   */
  protected whenLoaded<V>(
    relationship: string,
    value?: V | (() => V),
    defaultValue?: any,
  ): V | any[] | MissingValue {
    // The relationship name arrives as a runtime string, so the resource is
    // read by key. `Record<string, unknown>` says that; `any` also unchecked
    // the value handed back to the caller.
    const resource = this.resource as Record<string, unknown>

    // Check if the relationship exists and is loaded
    const isLoaded = relationship in resource && resource[relationship] !== undefined

    if (!isLoaded) {
      return defaultValue !== undefined ? defaultValue : MissingValue.instance
    }

    if (value !== undefined) {
      return typeof value === 'function' ? (value as () => V)() : value
    }

    // The loaded relationship, whatever the model put there.
    return resource[relationship] as V | unknown[]
  }

  /**
   * Include a count when it's available
   */
  protected whenCounted(relationship: string, defaultValue?: number): number | MissingValue {
    const resource = this.resource as Record<string, unknown>
    const countKey = `${relationship}_count`

    if (countKey in resource) {
      return Number(resource[countKey])
    }

    return defaultValue !== undefined ? defaultValue : MissingValue.instance
  }

  /**
   * Merge additional attributes conditionally
   *
   * @example
   * return {
   *   id: this.resource.id,
   *   ...this.merge({
   *     secret: this.resource.secret,
   *     admin_notes: this.resource.adminNotes,
   *   }),
   * }
   */
  protected merge(data: Record<string, any>): Record<string, any> {
    const spreadable = { ...data }
    mergePayloads.set(spreadable, data)
    return spreadable
  }

  /**
   * Conditionally merge attributes
   */
  protected mergeWhen(condition: boolean | (() => boolean), data: Record<string, any> | (() => Record<string, any>)): Record<string, any> | MissingValue {
    const shouldInclude = typeof condition === 'function' ? condition() : condition

    if (!shouldInclude) {
      return MissingValue.instance
    }

    const resolvedData = typeof data === 'function' ? data() : data
    return this.merge(resolvedData)
  }

  /**
   * Disable wrapping for all resources of this type
   */
  static withoutWrapping(): void {
    this.wrap = null
  }

  /**
   * Set a custom wrap key
   */
  static wrapWith(key: string): void {
    this.wrap = key
  }
}

/**
 * Resource Collection
 *
 * Wraps an array of resources with collection-specific functionality.
 */
export class ResourceCollection<T = unknown, R extends JsonResource<T> = JsonResource<T>> {
  public resources: T[]
  public ResourceClass: new (resource: T) => R
  public additional: Record<string, any> = {}
  protected request?: Request

  /** Wrap the collection in a key */
  public static wrap: string | null = 'data'

  constructor(resources: T[], ResourceClass: new (resource: T) => R) {
    this.resources = resources
    this.ResourceClass = ResourceClass
  }

  /**
   * Set the request instance
   */
  withRequest(request: Request): this {
    this.request = request
    return this
  }

  /**
   * Add additional data to the response
   */
  withAdditional(data: Record<string, any>): this {
    this.additional = { ...this.additional, ...data }
    return this
  }

  /**
   * Transform all resources
   */
  resolve(request?: Request): Record<string, any>[] {
    return resolveValue(this, request, { depth: 0, ancestors: new WeakSet() }) as Record<string, any>[]
  }

  /** @internal Preserve the parent resource's request and serialization budget. */
  resolveAt(request: Request | undefined, context: ResolutionContext): Record<string, any>[] {
    const req = request ?? this.request
    const resources = this.resources.map((resource) => {
      const instance = new this.ResourceClass(resource)
      if (req) instance.withRequest(req)
      return instance
    })
    return resolveValue(resources, req, context) as Record<string, any>[]
  }

  /**
   * Convert to response object
   */
  toResponse(request?: Request): Record<string, any> {
    const data = this.resolve(request)
    const wrap = (this.constructor as typeof ResourceCollection).wrap

    if (wrap) {
      return {
        [wrap]: data,
        ...this.additional,
      }
    }

    return { data, ...this.additional }
  }

  /**
   * Convert to JSON string
   */
  toJson(request?: Request): string {
    return JSON.stringify(this.toResponse(request))
  }

  /** Standard serialization must expose the transformed response, never source rows or request context. */
  toJSON(): Record<string, unknown> {
    return this.toResponse()
  }

  /**
   * Get the count of resources
   */
  count(): number {
    return this.resources.length
  }

  /**
   * Check if collection is empty
   */
  isEmpty(): boolean {
    return this.resources.length === 0
  }

  /**
   * Check if collection is not empty
   */
  isNotEmpty(): boolean {
    return this.resources.length > 0
  }
}

/**
 * Paginated Resource Collection
 *
 * Handles paginated data with meta and links.
 */
export class PaginatedResourceCollection<T = unknown, R extends JsonResource<T> = JsonResource<T>> extends ResourceCollection<T, R> {
  public meta: PaginationMeta
  public links: PaginationLinks

  constructor(
    paginatedData: PaginatedData<T>,
    ResourceClass: new (resource: T) => R,
  ) {
    super(paginatedData.data, ResourceClass)
    this.meta = paginatedData.meta
    this.links = paginatedData.links
  }

  /**
   * Create from pagination result
   */
  static fromPagination<T, R extends JsonResource<T>>(
    data: T[],
    ResourceClass: new (resource: T) => R,
    options: {
      currentPage: number
      perPage: number
      total: number
      baseUrl?: string
    },
  ): PaginatedResourceCollection<T, R> {
    const { currentPage, perPage, total, baseUrl = '' } = options
    for (const [name, value] of Object.entries({ currentPage, perPage, total })) {
      if (!Number.isSafeInteger(value) || value < (name === 'total' ? 0 : 1))
        throw new RangeError(`${name} must be a safe integer ${name === 'total' ? 'at least zero' : 'greater than zero'}`)
    }
    const offset = (currentPage - 1) * perPage
    if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(offset + data.length) || data.length > perPage || (data.length > 0 && offset + data.length > total))
      throw new RangeError('Pagination rows do not fit the requested page and total')
    const page = toPaginator({ data, meta: { page: currentPage, perPage, total, lastPage: Math.ceil(total / perPage) } })
    const link = (number: number) => withQuery(baseUrl, { page: number }, true)

    return new PaginatedResourceCollection(
      {
        data,
        meta: {
          current_page: currentPage,
          from: page.from,
          last_page: page.last_page,
          per_page: perPage,
          to: page.to,
          total,
        },
        links: {
          first: link(1),
          last: link(page.last_page),
          prev: currentPage > 1 ? link(currentPage - 1) : null,
          next: page.has_more_pages ? link(currentPage + 1) : null,
        },
      },
      ResourceClass,
    )
  }

  /**
   * Convert to response with pagination
   */
  toResponse(request?: Request): Record<string, any> {
    const data = this.resolve(request)

    return {
      data,
      meta: this.meta,
      links: this.links,
      ...this.additional,
    }
  }
}

/**
 * Anonymous Resource
 *
 * Create a resource inline without a class.
 */
export function resource<T>(
  data: T,
  transform: (resource: T) => Record<string, any>,
): { toResponse: () => Record<string, any>, toJson: () => string } {
  const transformed = transform(data)

  return {
    toResponse: () => ({ data: transformed }),
    toJson: () => JSON.stringify({ data: transformed }),
  }
}

/**
 * Anonymous Collection
 *
 * Create a collection inline without a class.
 */
export function collection<T>(
  data: T[],
  transform: (resource: T) => Record<string, any>,
): { toResponse: () => Record<string, any>, toJson: () => string } {
  const transformed = data.map(transform)

  return {
    toResponse: () => ({ data: transformed }),
    toJson: () => JSON.stringify({ data: transformed }),
  }
}
