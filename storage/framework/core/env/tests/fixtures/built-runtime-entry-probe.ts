const [rootEntry, runtimeEntry, pluginEntry] = process.argv.slice(2)
if (!rootEntry || !runtimeEntry || !pluginEntry)
  throw new Error('root, runtime, and plugin entries are required')

const root = await import(rootEntry)
const runtime = await import(runtimeEntry)
const plugin = await import(pluginEntry)

console.log(JSON.stringify({
  sameEnv: runtime.env === root.env,
  sameProcess: runtime.process === root.process,
  sameWriteEnv: runtime.writeEnv === root.writeEnv,
  sameValidateEnv: runtime.validateEnv === root.validateEnv,
  sameRequireEnv: runtime.requireEnv === root.requireEnv,
  sameActiveEnvName: root.activeEnvName === plugin.activeEnvName,
}))
