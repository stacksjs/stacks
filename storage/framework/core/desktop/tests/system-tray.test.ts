import { describe, expect, test } from 'bun:test'
import { buildTrayMenu } from '../../../defaults/resources/functions/system-tray'
import { craftDevCommand } from '../src'

describe('system tray menu', () => {
  test('opens an explicitly addressed native Craft popover', () => {
    const url = 'http://127.0.0.1:8081/#tray-session'
    expect(craftDevCommand(8081, {
      craftBin: '/usr/bin/true',
      url,
      title: 'Buddy',
      width: 376,
      height: 488,
      trayPopover: true,
      hotReload: false,
      devTools: false,
    })).toEqual(['/usr/bin/true', url, '--title', 'Buddy', '--width', '376', '--height', '488', '--no-devtools', '--tray-popover'])
  })

  test('includes every global shortcut', () => {
    const menu = buildTrayMenu(['/tmp/example'])
    const actions = menu.flatMap(item => item.action || [])
    expect(actions).toContain('refresh')
    expect(actions).toContain('open-terminal')
    expect(actions).toContain('env-check')
    expect(actions).toContain('settings')
    expect(actions).toContain('check-updates')
  })

  test('builds the complete project submenu', () => {
    const projects = buildTrayMenu(['/Users/example/Code/shop'])
    const projectMenu = projects.find(item => item.label === 'Projects')
    const shop = projectMenu?.submenu?.[0]
    expect(shop?.label).toBe('shop')
    const actions = shop?.submenu?.map(item => item.action).filter(Boolean)
    expect(actions).toContain('open-dashboard::/Users/example/Code/shop')
    expect(actions).toContain('deploy::/Users/example/Code/shop')
    expect(actions).toContain('ask-buddy::/Users/example/Code/shop')
  })
})
