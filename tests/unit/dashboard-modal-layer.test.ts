import { describe, expect, test } from 'bun:test'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

/**
 * Where a dashboard dialog or drawer sits (stacksjs/stacks#3255).
 *
 * The delete confirmation appeared in a different place depending on how the
 * visitor had reached the page: centred on the whole window after a fresh
 * load, and 250px to the right after clicking between pages. Neither was the
 * intended one, over the content beside the sidebar. A drawer in the second
 * case had its edge 250px off the screen.
 *
 * Two things had to be true for that, and each is pinned here. Measured in a
 * browser both ways in; these keep the cause from coming back.
 */
const layout = readFileSync(resolve('storage/framework/defaults/views/dashboard/layouts/default.stx'), 'utf8')
const components = resolve('storage/framework/defaults/resources/components/Dashboard')

function templates(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry)
    return statSync(path).isDirectory() ? templates(path) : path.endsWith('.stx') ? [path] : []
  })
}

/** Every element that carries the shared layer class, with its class list. */
function layers(): Array<{ file: string, classes: string[] }> {
  const found: Array<{ file: string, classes: string[] }> = []
  for (const file of [...templates(components), ...templates(resolve('storage/framework/defaults/views/dashboard'))]) {
    for (const [, classes] of readFileSync(file, 'utf8').matchAll(/\bclass="([^"]*\bdashboard-modal-layer\b[^"]*)"/g))
      found.push({ file: file.slice(file.indexOf('defaults/') + 9), classes: classes!.split(/\s+/) })
  }
  return found
}

describe('the dashboard\'s dialog layer', () => {
  test('its rule outweighs the utilities it shares an element with, whatever order the stylesheets load in', () => {
    // `inset-0` sets `left` too, with the weight of one class. A bare
    // `.dashboard-modal-layer` weighs the same, and the two stylesheets load
    // in a different order on a fresh load and after navigating.
    const rules = [...layout.matchAll(/^\s*([^\n{}]*\.dashboard-modal-layer[^\n{]*)\{/gm)].map(match => match[1]!.trim())
    expect(rules).toEqual(['html .dashboard-modal-layer', 'html .dashboard-modal-layer'])
  })

  test('it spans the content pane: from the sidebar to the window\'s edge', () => {
    const rule = layout.slice(layout.indexOf('html .dashboard-modal-layer {'))
    const body = rule.slice(0, rule.indexOf('}'))
    expect(body).toContain('left: var(--stx-sidebar-width, 250px);')
    expect(body).toContain('right: 0;')
    // A dialog is as wide as its content unless told otherwise.
    expect(body).toContain('width: auto;')
  })

  test('on a narrow window, where the sidebar is a drawer of its own, it takes the whole width', () => {
    const narrow = layout.slice(layout.indexOf('@media (max-width: 1023px)'))
    expect(narrow.slice(0, narrow.indexOf('\n}\n'))).toMatch(/html \.dashboard-modal-layer \{\s*left: 0;\s*\}/)
  })

  test('nothing that uses it sets a width of its own', () => {
    // `w-screen` beside `left: 250px` ran the layer a sidebar's width past the
    // window. The layer's width is the rule's to set, and only the rule's.
    const all = layers()
    expect(all.map(layer => layer.file).sort()).toEqual([
      'resources/components/Dashboard/UI/Drawer.stx',
      'resources/components/Dashboard/UI/Modal.stx',
    ])
    const sized = all.flatMap(layer => layer.classes.filter(name => /^(?:[a-z0-9]+:)*(?:w|min-w)-/.test(name)).map(name => `${layer.file}: ${name}`))
    expect(sized).toEqual([])
    // It is still pinned to the window's other three edges by the utility.
    for (const layer of all)
      expect(layer.classes).toEqual(expect.arrayContaining(['fixed', 'inset-0']))
  })
})
