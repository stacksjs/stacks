import type { MakeOptions } from '@stacksjs/types'
import { log } from '@stacksjs/logging'
import * as p from '@stacksjs/path'
import { doesExist, get, writeFile } from '@stacksjs/storage'

export interface MakePolicyOptions extends MakeOptions {
  /** The model this policy is for */
  model?: string
  /** Whether to register the policy in Gates.ts */
  register?: boolean
}

/**
 * Create a new policy file in app/Policies
 */
export async function makePolicy(options: MakePolicyOptions): Promise<boolean> {
  const name = options.name

  if (!name) {
    log.error('Policy name is required')
    return false
  }

  // Ensure name ends with Policy
  const policyName = name.endsWith('Policy') ? name : `${name}Policy`
  const modelName = options.model || policyName.replace('Policy', '')

  // Generate policy content
  const content = generatePolicyContent(policyName, modelName)

  // Write the file
  const filePath = p.appPath(`Policies/${policyName}.ts`)

  try {
    // Create Policies directory if it doesn't exist
    const policiesDir = p.appPath('Policies')
    if (!doesExist(policiesDir)) {
      const { mkdirSync } = await import('@stacksjs/storage')
      mkdirSync(policiesDir, { recursive: true })
    }

    await writeFile(filePath, content)
    log.success(`Created policy: ${filePath}`)

    // Register in Gates.ts if requested
    if (options.register !== false) {
      await registerPolicy(modelName, policyName)
    }

    return true
  }
  catch (error) {
    log.error(`Failed to create policy: ${(error as Error).message}`)
    return false
  }
}

/**
 * Generate policy file content
 */
function generatePolicyContent(policyName: string, modelName: string): string {
  return `import type { UserModel } from '@stacksjs/orm'
import { BasePolicy } from '@stacksjs/auth'

/**
 * ${policyName}
 *
 * This policy controls authorization for ${modelName} model actions.
 *
 * Usage:
 * 1. Register in app/Gates.ts:
 *    policies: { '${modelName}': '${policyName}' }
 *
 * 2. Use in your code:
 *    import { Gate } from '@stacksjs/auth'
 *    await Gate.authorize('view', user, ${modelName.toLowerCase()})
 *
 * 3. Or use the middleware:
 *    route.put('/${modelName.toLowerCase()}s/:${modelName.toLowerCase()}', 'Update${modelName}')
 *      .middleware('can:update,${modelName.toLowerCase()}')
 */

// TODO: Import or define your ${modelName} type
interface ${modelName} {
  id: number
  user_id: number
  // Add your model properties here
}

export default class ${policyName} extends BasePolicy<${modelName}> {
  /**
   * Run before any other checks.
   * Return true to allow, false to deny, null to continue.
   */
  before(user: UserModel | null, ability: string): boolean | null {
    // Example: Admins can do anything
    // if (user?.role === 'admin') return true
    return null
  }

  /**
   * Determine if the user can view any ${modelName.toLowerCase()}s.
   */
  viewAny(user: UserModel | null): boolean {
    return true
  }

  /**
   * Determine if the user can view the ${modelName.toLowerCase()}.
   */
  view(user: UserModel | null, model: ${modelName}): boolean {
    return true
  }

  /**
   * Determine if the user can create ${modelName.toLowerCase()}s.
   */
  create(user: UserModel | null): boolean {
    return user !== null
  }

  /**
   * Determine if the user can update the ${modelName.toLowerCase()}.
   */
  update(user: UserModel | null, model: ${modelName}): boolean {
    return user?.id === model.user_id
  }

  /**
   * Determine if the user can delete the ${modelName.toLowerCase()}.
   */
  delete(user: UserModel | null, model: ${modelName}): boolean {
    return user?.id === model.user_id
  }

  /**
   * Determine if the user can restore the ${modelName.toLowerCase()}.
   */
  restore(user: UserModel | null, model: ${modelName}): boolean {
    return user?.id === model.user_id
  }

  /**
   * Determine if the user can permanently delete the ${modelName.toLowerCase()}.
   */
  forceDelete(user: UserModel | null, model: ${modelName}): boolean {
    return user?.id === model.user_id
  }
}
`
}

/**
 * Register the policy in app/Gates.ts
 */
async function registerPolicy(modelName: string, policyName: string): Promise<void> {
  const gatesPath = p.appPath('Gates.ts')

  try {
    let content = await get(gatesPath)

    // Find the policies object and add the new policy
    const policiesMatch = content.match(/export const policies[^{]*\{([^}]*)\}/)

    if (policiesMatch) {
      const existingPolicies = policiesMatch[1]

      // Check if policy already exists
      if (existingPolicies.includes(`'${modelName}'`)) {
        log.info(`Policy for '${modelName}' already registered in Gates.ts`)
        return
      }

      // Add the new policy
      const newPolicy = `  '${modelName}': '${policyName}',\n`
      const updatedPolicies = existingPolicies.trimEnd() + '\n' + newPolicy

      content = content.replace(
        /export const policies[^{]*\{([^}]*)\}/,
        `export const policies: Record<string, string | { policy: string, model?: string }> = {${updatedPolicies}}`,
      )

      await writeFile(gatesPath, content)
      log.success(`Registered policy '${policyName}' for '${modelName}' in Gates.ts`)
    }
  }
  catch (error) {
    log.warn(`Could not register policy in Gates.ts: ${(error as Error).message}`)
    log.info('You may need to manually add it to app/Gates.ts')
  }
}
