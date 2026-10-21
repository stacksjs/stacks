import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

/** Missing hooks are optional; present hooks and their imports must succeed. */
export async function runBeforeDeployHook(cwd: string, context: { environment: string, region: string }): Promise<boolean> {
  const file = ['.ts', '.js', '.mts', '.mjs', '.cts', '.cjs'].map(extension => join(cwd, `cloud/deploy-script${extension}`)).find(existsSync)
  if (!file) return false
  const module = await import(pathToFileURL(file).href) as { beforeDeploy?: unknown, default?: { beforeDeploy?: unknown } }
  const owner = Object.hasOwn(module, 'beforeDeploy') ? module : module.default
  if (!owner || !Object.hasOwn(owner, 'beforeDeploy')) return false
  const hook = owner.beforeDeploy
  if (typeof hook !== 'function') throw new Error('cloud/deploy-script beforeDeploy must be a function')
  await hook(context)
  return true
}
