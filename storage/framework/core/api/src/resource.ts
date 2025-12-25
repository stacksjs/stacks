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

import type { Request } from '@stacksjs/router'

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

/**
 * Base JSON Resource class
 *
 * Extend this class to create custom API resources that transform
 * your models into JSON-serializable objects.
 */
export abstract class JsonResource<T = any> {
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
    const data = this.toArray(request || this.request)
    return this.filterAndResolve(data)
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
    const resource = this.resource as any

    // Check if the relationship exists and is loaded
    const isLoaded = relationship in resource && resource[relationship] !== undefined

    if (!isLoaded) {
      return defaultValue !== undefined ? defaultValue : MissingValue.instance
    }

    if (value !== undefined) {
      return typeof value === 'function' ? (value as () => V)() : value
    }

    return resource[relationship]
  }

  /**
   * Include a count when it's available
   */
  protected whenCounted(relationship: string, defaultValue?: number): number | MissingValue {
    const resource = this.resource as any
    const countKey = `${relationship}_count`

    if (countKey in resource) {
      return resource[countKey]
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
  protected merge(data: Record<string, any>): MergeValue {
    return new MergeValue(data)
  }

  /**
   * Conditionally merge attributes
   */
  protected mergeWhen(condition: boolean | (() => boolean), data: Record<string, any> | (() => Record<string, any>)): MergeValue | MissingValue {
    const shouldInclude = typeof condition === 'function' ? condition() : condition

    if (!shouldInclude) {
      return MissingValue.instance
    }

    const resolvedData = typeof data === 'function' ? data() : data
    return new MergeValue(resolvedData)
  }

  /**
   * Filter out MissingValue and resolve conditional values
   */
  private filterAndResolve(data: Record<string, any>): Record<string, any> {
    const result: Record<string, any> = {}

    for (const [key, value] of Object.entries(data)) {
      // Skip missing values
      if (value instanceof MissingValue) {
        continue
      }

      // Handle merge values
      if (value instanceof MergeValue) {
        Object.assign(result, this.filterAndResolve(value.data))
        continue
      }

      // Handle conditional values
      if (value instanceof ConditionalValue) {
        const resolved = value.resolve()
        if (!(resolved instanceof MissingValue)) {
          result[key] = resolved
        }
        continue
      }

      // Handle nested objects
      if (value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
        result[key] = this.filterAndResolve(value)
        continue
      }

      // Handle arrays
      if (Array.isArray(value)) {
        result[key] = value
          .filter(item => !(item instanceof MissingValue))
          .map(item => {
            if (item instanceof MergeValue) return item.data
            if (item !== null && typeof item === 'object' && !(item instanceof Date)) {
              return this.filterAndResolve(item)
            }
            return item
          })
        continue
      }

      result[key] = value
    }

    return result
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
export class ResourceCollection<T = any, R extends JsonResource<T> = JsonResource<T>> {
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
    const req = request || this.request
    return this.resources.map(resource => {
      const instance = new this.ResourceClass(resource)
      if (req) instance.withRequest(req)
      return instance.resolve(req)
    })
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
export class PaginatedResourceCollection<T = any, R extends JsonResource<T> = JsonResource<T>> extends ResourceCollection<T, R> {
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
    const lastPage = Math.ceil(total / perPage)
    const from = total > 0 ? (currentPage - 1) * perPage + 1 : null
    const to = total > 0 ? Math.min(currentPage * perPage, total) : null

    return new PaginatedResourceCollection(
      {
        data,
        meta: {
          current_page: currentPage,
          from,
          last_page: lastPage,
          per_page: perPage,
          to,
          total,
        },
        links: {
          first: `${baseUrl}?page=1`,
          last: `${baseUrl}?page=${lastPage}`,
          prev: currentPage > 1 ? `${baseUrl}?page=${currentPage - 1}` : null,
          next: currentPage < lastPage ? `${baseUrl}?page=${currentPage + 1}` : null,
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
