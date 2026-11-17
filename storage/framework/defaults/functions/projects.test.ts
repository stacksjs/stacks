import type { SwitcherProject } from './projects'
import { describe, expect, it } from 'bun:test'
import { filterProjects, projectLocation } from './projects'

function project(name: string, path: string): SwitcherProject {
  return { id: name, name, path, current: false, running: false, url: null }
}

const projects = [
  project('shop', '~/Code/clients/acme/shop'),
  project('shop-admin', '~/Code/clients/acme/shop-admin'),
  project('blog', '~/Code/personal/blog'),
]

describe('finding a project in the switcher', () => {
  it('shows everything until something is typed', () => {
    expect(filterProjects(projects, '')).toEqual(projects)
    expect(filterProjects(projects, '   ')).toEqual(projects)
  })

  it('matches the name or the folder, in any case', () => {
    expect(filterProjects(projects, 'BLOG').map(match => match.name)).toEqual(['blog'])
    expect(filterProjects(projects, 'acme').map(match => match.name)).toEqual(['shop', 'shop-admin'])
  })

  it('narrows with every word typed', () => {
    expect(filterProjects(projects, 'acme admin').map(match => match.name)).toEqual(['shop-admin'])
    expect(filterProjects(projects, 'acme blog')).toEqual([])
  })
})

describe('where a project lives', () => {
  it('is the folder that holds it', () => {
    expect(projectLocation('~/Code/clients/acme/shop')).toBe('~/Code/clients/acme')
    expect(projectLocation('/srv/shop')).toBe('/srv')
    expect(projectLocation('shop')).toBe('shop')
  })
})
