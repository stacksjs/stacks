import { expect, test } from 'bun:test'
import { copyFile, cp, mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { projectPath } from '@stacksjs/path'
import { buildStxComponentLibrary } from '../src/build/component-library'

function run(command: string[], cwd: string): string {
  const result = Bun.spawnSync(command, { cwd, stdout: 'pipe', stderr: 'pipe' })
  const output = new TextDecoder().decode(result.stdout) + new TextDecoder().decode(result.stderr)
  expect(result.exitCode, output).toBe(0)
  return output
}

test('the public STX sample builds, packs, installs and exposes valid DOM types', async () => {
  const root = await mkdtemp(join(tmpdir(), 'stacks-component-sample-'))
  try {
    const built = await buildStxComponentLibrary()
    expect(built?.components.length).toBeGreaterThan(0)
    if (!built) throw new Error('The STX sample did not build')
    const group = built.components.find(component => component.name === 'InputGroup')
    const icon = built.components.find(component => component.name === 'DesktopIcon')
    expect(group).toBeDefined()
    expect(icon).toBeDefined()

    const manifestPath = projectPath('storage/framework/libs/components/stx/package.json')
    const manifest = await Bun.file(manifestPath).json() as { name: string }
    // Exercise the release's real normalization without rewriting the source
    // manifest. The component modules remain the native builder's output.
    const candidate = join(root, 'candidate')
    const candidateManifest = join(candidate, 'package.json')
    await mkdir(candidate)
    await copyFile(manifestPath, candidateManifest)
    await copyFile(projectPath('storage/framework/libs/components/stx/README.md'), join(candidate, 'README.md'))
    await cp(projectPath('storage/framework/libs/components/stx/dist'), join(candidate, 'dist'), { recursive: true })
    run(['node', projectPath('storage/framework/scripts/normalize-workspace-deps-for-publish'), candidateManifest, projectPath('storage/framework')], projectPath())
    const archive = join(root, 'sample.tgz')
    run([process.execPath, projectPath('storage/framework/scripts/validate-publish-exports.ts'), candidateManifest, archive], projectPath())
    const members = run(['tar', '-tzf', archive], root).split('\n')
    expect(members).toContain('package/dist/index.js')
    expect(members).toContain('package/dist/index.d.ts')
    expect(members).toContain(`package/dist/${group!.tag}.js`)

    await Bun.write(join(root, 'package.json'), JSON.stringify({
      name: 'stacks-sample-consumer', private: true, type: 'module',
      dependencies: { [manifest.name]: `file:${archive.replaceAll('\\', '/')}` },
    }))
    run([process.execPath, 'install'], root)
    await Bun.write(join(root, 'import.ts'), `import { InputGroup, DesktopIcon, StartMenuItem } from ${JSON.stringify(manifest.name)}
if (![InputGroup, DesktopIcon, StartMenuItem].every(value => typeof value === 'function')) throw new Error('Missing public sample components')
`)
    run([process.execPath, 'run', 'import.ts'], root)

    await Bun.write(join(root, 'consumer.ts'), `import type { InputGroup, DesktopIcon, DesktopIconProps } from ${JSON.stringify(manifest.name)}
const field: InputGroup = document.createElement(${JSON.stringify(group!.tag)})
field.label = field.label.toUpperCase()
field.classList.add('sample-field')
const icon: DesktopIcon = document.createElement(${JSON.stringify(icon!.tag)})
const style: CSSStyleDeclaration = icon.style
style.setProperty('color', 'blue')
icon.onclick = event => event.preventDefault()
export const attributes: DesktopIconProps = { id: 'sample-icon', label: 'Library', style: 'color: blue' }
`)
    const config = join(root, 'tsconfig.json')
    await Bun.write(config, JSON.stringify({ compilerOptions: {
      target: 'ESNext', module: 'ESNext', moduleResolution: 'Bundler', lib: ['ESNext', 'DOM'],
      types: [], strict: true, skipLibCheck: false, noEmit: true,
    }, files: ['consumer.ts'] }))
    run([process.execPath, '--bun', 'tsc', '-p', config, '--pretty', 'false'], projectPath())
  }
  finally { await rm(root, { recursive: true, force: true }) }
}, 30_000)
