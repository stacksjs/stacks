import type { MakeOptions } from '@stacksjs/types'
import { log } from '@stacksjs/logging'
import * as p from '@stacksjs/path'
import { doesExist, writeFile } from '@stacksjs/storage'

export interface MakeResourceOptions extends MakeOptions {
  /** The model this resource is for */
  model?: string
  /** Create a collection resource */
  collection?: boolean
}

/**
 * Create a new API resource file in app/Resources
 */
export async function makeResource(options: MakeResourceOptions): Promise<boolean> {
  const name = options.name

  if (!name) {
    log.error('Resource name is required')
    return false
  }

  // Ensure name ends with Resource
  const resourceName = name.endsWith('Resource') ? name : `${name}Resource`
  const modelName = options.model || resourceName.replace('Resource', '')

  // Generate resource content
  const content = options.collection
    ? generateCollectionResourceContent(resourceName, modelName)
    : generateResourceContent(resourceName, modelName)

  // Create Resources directory if it doesn't exist
  const resourcesDir = p.appPath('Resources')
  if (!doesExist(resourcesDir)) {
    const { mkdirSync } = await import('@stacksjs/storage')
    mkdirSync(resourcesDir, { recursive: true })
  }

  // Write the file
  const filePath = p.appPath(`Resources/${resourceName}.ts`)

  try {
    await writeFile(filePath, content)
    log.success(`Created resource: ${filePath}`)
    return true
  }
  catch (error) {
    log.error(`Failed to create resource: ${(error as Error).message}`)
    return false
  }
}

/**
 * Generate resource file content
 */
function generateResourceContent(resourceName: string, modelName: string): string {
  return `import type { Request } from '@stacksjs/router'
import { JsonResource } from '@stacksjs/api'

/**
 * ${resourceName}
 *
 * Transforms ${modelName} model data for API responses.
 *
 * @example
 * // Single resource
 * return new ${resourceName}(${modelName.toLowerCase()}).toResponse()
 *
 * // Collection
 * return ${resourceName}.collection(${modelName.toLowerCase()}s).toResponse()
 *
 * // With additional data
 * return new ${resourceName}(${modelName.toLowerCase()})
 *   .withAdditional({ message: 'Success' })
 *   .toResponse()
 */

// TODO: Import or define your ${modelName} type
interface ${modelName} {
  id: number
  name: string
  created_at: Date
  updated_at: Date
  // Add your model properties here
}

export default class ${resourceName} extends JsonResource<${modelName}> {
  /**
   * Transform the resource into an array.
   */
  toArray(request?: Request): Record<string, any> {
    return {
      id: this.resource.id,
      name: this.resource.name,

      // Conditional fields
      // secret: this.when(request?.user?.isAdmin, this.resource.secret),

      // Loaded relationships
      // posts: this.whenLoaded('posts', () =>
      //   PostResource.collection(this.resource.posts)
      // ),

      // Relationship counts
      // posts_count: this.whenCounted('posts'),

      // Timestamps
      created_at: this.resource.created_at,
      updated_at: this.resource.updated_at,
    }
  }
}
`
}

/**
 * Generate collection resource file content
 */
function generateCollectionResourceContent(resourceName: string, modelName: string): string {
  const baseResourceName = resourceName.replace('Collection', '')

  return `import type { Request } from '@stacksjs/router'
import { JsonResource, ResourceCollection } from '@stacksjs/api'

/**
 * ${resourceName}
 *
 * Collection resource for ${modelName} with custom collection behavior.
 *
 * @example
 * return new ${resourceName}(${modelName.toLowerCase()}s).toResponse()
 */

// TODO: Import or define your ${modelName} type
interface ${modelName} {
  id: number
  name: string
  created_at: Date
  updated_at: Date
}

/**
 * Individual resource for the collection
 */
class ${baseResourceName} extends JsonResource<${modelName}> {
  toArray(request?: Request): Record<string, any> {
    return {
      id: this.resource.id,
      name: this.resource.name,
      created_at: this.resource.created_at,
      updated_at: this.resource.updated_at,
    }
  }
}

/**
 * Collection resource with custom behavior
 */
export default class ${resourceName} extends ResourceCollection<${modelName}, ${baseResourceName}> {
  constructor(resources: ${modelName}[]) {
    super(resources, ${baseResourceName})
  }

  /**
   * Add collection-level data to the response
   */
  toResponse(request?: Request): Record<string, any> {
    return {
      ...super.toResponse(request),
      meta: {
        total: this.count(),
        // Add any collection-level metadata here
      },
    }
  }
}
`
}
