import { describe, expect, it } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { developmentBrowserCommand, developmentUrl, dispatchInteractiveDevSelection, interactiveDevChoices, resolveDevelopmentEntryPath, resolvePrettyDevDomain, shouldUsePrettyDevUrls } from '../src/commands/dev'

describe('buddy dev interactive selection', () => {
  it('dispatches every visible choice to exactly one runner', async () => {
    const calls: string[] = []
    const runners = Object.fromEntries(
      interactiveDevChoices.map(choice => [choice.value, async () => calls.push(choice.value)]),
    ) as Parameters<typeof dispatchInteractiveDevSelection>[1]

    for (const choice of interactiveDevChoices) {
      calls.length = 0
      expect(await dispatchInteractiveDevSelection(choice.value, runners)).toBe(true)
      expect(calls).toEqual([choice.value])
    }
  })

  it('rejects values that are not displayed', async () => {
    const runners = Object.fromEntries(
      interactiveDevChoices.map(choice => [choice.value, async () => {}]),
    ) as Parameters<typeof dispatchInteractiveDevSelection>[1]

    expect(await dispatchInteractiveDevSelection('email', runners)).toBe(false)
  })
})

describe('buddy dev URL selection', () => {
  it('keeps loopback URLs on the zero-setup localhost path', () => {
    expect(resolvePrettyDevDomain('http://localhost:3000')).toBeNull()
    expect(resolvePrettyDevDomain('localhost')).toBeNull()
    expect(resolvePrettyDevDomain('http://127.0.0.1:3000')).toBeNull()
  })

  it('recognizes explicitly configured pretty domains', () => {
    expect(resolvePrettyDevDomain('stacks.localhost')).toBe('stacks.localhost')
    expect(resolvePrettyDevDomain('https://app.example.com')).toBe('app.example.com')
  })

  it('keeps pretty URLs as the default after one-time system authorization', () => {
    expect(shouldUsePrettyDevUrls({
      domain: 'stacks.localhost',
      localhostOnly: false,
      proxyManagedExternally: false,
      systemAuthorized: true,
    })).toBe(true)
  })

  it('falls back immediately until the explicit setup is authorized', () => {
    expect(shouldUsePrettyDevUrls({
      domain: 'stacks.localhost',
      localhostOnly: false,
      proxyManagedExternally: false,
      systemAuthorized: false,
    })).toBe(false)
  })

  it('honors the explicit localhost override', () => {
    expect(shouldUsePrettyDevUrls({
      domain: 'stacks.localhost',
      localhostOnly: true,
      proxyManagedExternally: false,
      systemAuthorized: true,
    })).toBe(false)
  })

  it('uses an explicitly configured application entry', () => {
    expect(resolveDevelopmentEntryPath({ configuredPath: '/workspace' })).toBe('/workspace')
  })

  it('detects an application view without mistaking the marketing homepage for it', () => {
    const root = mkdtempSync(join(tmpdir(), 'buddy-dev-app-'))
    try {
      mkdirSync(join(root, 'resources/views'), { recursive: true })
      writeFileSync(join(root, 'resources/views/index.stx'), "@extends('layouts/marketing')")
      writeFileSync(join(root, 'resources/views/composer.stx'), "@extends('layouts/product-shell')")

      expect(resolveDevelopmentEntryPath({ root })).toBe('/composer')
    }
    finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('keeps site-only projects at the root', () => {
    const root = mkdtempSync(join(tmpdir(), 'buddy-dev-site-'))
    try {
      mkdirSync(join(root, 'resources/views'), { recursive: true })
      writeFileSync(join(root, 'resources/views/index.stx'), "@extends('layouts/marketing')")

      expect(resolveDevelopmentEntryPath({ root })).toBe('/')
    }
    finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('lets --site override a detected or configured application', () => {
    expect(resolveDevelopmentEntryPath({ site: true, configuredPath: '/dashboard' })).toBe('/')
  })

  it('adds the selected entry path without changing the frontend origin', () => {
    expect(developmentUrl('https://postline.localhost', '/composer')).toBe('https://postline.localhost/composer')
    expect(developmentUrl('http://localhost:3000', '/')).toBe('http://localhost:3000')
  })

  it('uses shell-free browser commands on every supported platform', () => {
    expect(developmentBrowserCommand('https://postline.localhost/composer', 'darwin')).toEqual(['open', 'https://postline.localhost/composer'])
    expect(developmentBrowserCommand('https://postline.localhost/composer', 'linux')).toEqual(['xdg-open', 'https://postline.localhost/composer'])
    expect(developmentBrowserCommand('https://postline.localhost/composer', 'win32')).toEqual(['cmd', '/c', 'start', '', 'https://postline.localhost/composer'])
  })
})
