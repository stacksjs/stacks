import { expect, test } from 'bun:test'
import { inspectStandaloneWebComponentPackage } from '../src/library/web-components'

const encode = (text: string) => new TextEncoder().encode(text)
const js = (stem: string) => ({ types: `./dist/${stem}.d.ts`, import: `./dist/${stem}.js`, default: `./dist/${stem}.js` })
const options = { name: '@fixture/custom-elements', version: '1.2.3', tags: ['fixture-card'], access: 'public' as const }

function fixture() {
  const manifest = {
    name: options.name, version: options.version, type: 'module', publishConfig: { access: 'public' },
    exports: {
      '.': { ...js('bundle'), types: './dist/index.d.ts' },
      './custom-elements.json': './dist/custom-elements.json',
      './ssr': js('ssr'), './ssr.js': js('ssr'),
      './fixture-card': js('fixture-card'), './fixture-card.js': js('fixture-card'), './fixture-card.css': './dist/fixture-card.css',
    },
  }
  const catalog = { modules: [{ declarations: [{ customElement: true, name: 'FixtureCard', tagName: 'fixture-card' }] }] }
  return new Map(Object.entries({
    'package.json': JSON.stringify(manifest),
    'README.md': '# A standalone fixture',
    'dist/custom-elements.json': JSON.stringify(catalog),
    'dist/index.d.ts': 'export { FixtureCard } from "./fixture-card.js"',
    'dist/bundle.js': 'export { FixtureCard } from "./fixture-card.js"',
    'dist/fixture-card.js': 'export class FixtureCard extends HTMLElement {}',
    'dist/fixture-card.d.ts': 'export declare class FixtureCard extends HTMLElement {}',
    'dist/fixture-card.css': ':host { display: block }',
    'dist/ssr.d.ts': 'export declare function render(): string',
    'dist/ssr.js': 'export function render() { return "<fixture-card></fixture-card>" }',
  }).map(([path, content]) => [path, encode(content)]))
}

test('verifies standalone component output and reports declared classes', () => {
  expect(inspectStandaloneWebComponentPackage(fixture(), options)).toEqual({
    version: '1.2.3', classes: [{ name: 'FixtureCard', tag: 'fixture-card' }],
  })
  expect(() => inspectStandaloneWebComponentPackage(fixture(), { ...options, tags: ['other-card'] })).toThrow()
})

test('requires advertised declarations and rejects a browser dependency outside the archive', () => {
  const incomplete = fixture()
  incomplete.delete('dist/fixture-card.d.ts')
  expect(() => inspectStandaloneWebComponentPackage(incomplete, options)).toThrow('missing')
  const dependent = fixture()
  dependent.set('dist/bundle.js', encode('export { FixtureCard } from "fixture-server"'))
  expect(() => inspectStandaloneWebComponentPackage(dependent, options)).toThrow('Nonstandalone dependency')
  const environment = fixture()
  environment.set('dist/bundle.js', encode('export const configuration = globalThis.process["env"]'))
  expect(() => inspectStandaloneWebComponentPackage(environment, options)).toThrow('Environment access')
})

test('rejects lifecycle scripts and caller-defined private markers', () => {
  const files = fixture()
  const manifest = JSON.parse(new TextDecoder().decode(files.get('package.json')))
  files.set('package.json', encode(JSON.stringify({ ...manifest, scripts: { postinstall: 'fixture-command' } })))
  expect(() => inspectStandaloneWebComponentPackage(files, options)).toThrow('lifecycle scripts')
  files.set('package.json', encode(JSON.stringify(manifest)))
  const markers = /PRIVATE_FIXTURE/g
  files.set('dist/bundle.js', encode('export const marker = "PRIVATE_FIXTURE"'))
  expect(() => inspectStandaloneWebComponentPackage(files, { ...options, blockedMarkers: markers })).toThrow('Server/private marker')
  expect(markers.lastIndex).toBe(0)
})
