import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const layoutSource = readFileSync(
  resolve('storage/framework/defaults/views/dashboard/layouts/default.stx'),
  'utf8',
)

describe('dashboard layout client architecture', () => {
  test('uses STX lifecycle and component events for sidebar navigation', () => {
    expect(layoutSource).toContain('useRef(\'dashboardSidebarHost\')')
    expect(layoutSource).toContain('useEventListener(\'stx:navigate\'')
    expect(layoutSource).toContain('onMount(() =>')
    expect(layoutSource).toContain('@itemClick="handleSidebarItemClick($event)"')
  })

  test('does not carry the legacy raw browser wiring', () => {
    expect(layoutSource.match(/^<script\b[^>]*>$/gm)).toEqual([
      '<script server>',
      '<script client>',
    ])
    expect(layoutSource).not.toContain('document.')
    expect(layoutSource).not.toContain('window.')
    expect(layoutSource).not.toMatch(/\bvar\s+/)
    expect(layoutSource).not.toContain('__sidebarWired')
  })
})
