/**
 * Compiles a native screen through the given stx components plugin and prints
 * which file `<Button>` and `<Avatar>` resolved to, with the diagnostics that
 * would block a native build. Used by stx-components-plugin.test.ts.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const pluginFile = process.argv[2]!
const root = mkdtempSync(join(tmpdir(), 'stacks-native-button-'))
try {
  mkdirSync(join(root, 'resources/components'), { recursive: true })
  writeFileSync(join(root, 'stx.config.ts'), `export default { plugins: [${JSON.stringify(pluginFile)}] }\n`)
  const { compileScreenSource } = await import('@stacksjs/stx/native/compiler/render-screen' as string)
  const compile = (source: string) => compileScreenSource(`${source}\n`, join(root, 'resources/views/screen.stx'), { root, componentsDir: join(root, 'resources/components') })
  const unrenderable = (screen: any) => screen.diagnostics.filter((entry: any) => entry.kind !== 'dropped-subtree').map((entry: any) => entry.kind)
  const button = await compile('<Button label="Share Report" />')
  const avatar = await compile('<Avatar initials="AL" />')
  console.log(JSON.stringify({
    button: button.dependencies.find((file: string) => /Button\.stx$/.test(file)) ?? null,
    unrenderable: unrenderable(button),
    avatar: avatar.dependencies.find((file: string) => /Avatar\.stx$/.test(file)) ?? null,
    avatarUnrenderable: unrenderable(avatar).length,
  }))
}
finally {
  rmSync(root, { recursive: true, force: true })
}
process.exit(0)
