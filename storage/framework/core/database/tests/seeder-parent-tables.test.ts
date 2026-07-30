// Resolving the table a `belongsTo` parent lives in.
//
// The seeder used to guess it as `snake_case(name) + 's'`. That is right for
// `User` and wrong for every irregular plural: a child of `Repository` looked
// in `repositorys`, found nothing, and left its foreign key to whatever the
// factory invented. Against a database with foreign keys that is not a subtly
// wrong graph — the insert is rejected and the model fails to seed outright.

import { describe, expect, test } from 'bun:test'
import { parentTable, registerModelTables } from '../src/seeder'

describe('parentTable', () => {
  test('reads the table a model declares', () => {
    registerModelTables([{ name: 'Repository', table: 'repositories' }])

    expect(parentTable('Repository')).toBe('repositories')
  })

  test('handles the irregular plurals that broke the guess', () => {
    registerModelTables([
      { name: 'Repository', table: 'repositories' },
      { name: 'Category', table: 'categories' },
      { name: 'Person', table: 'people' },
      { name: 'Company', table: 'companies' },
    ])

    expect(parentTable('Repository')).toBe('repositories')
    expect(parentTable('Category')).toBe('categories')
    expect(parentTable('Person')).toBe('people')
    expect(parentTable('Company')).toBe('companies')
  })

  test('honours a table name that is not a plural at all', () => {
    // Nothing stops a model from naming its own table.
    registerModelTables([{ name: 'Setting', table: 'app_config' }])

    expect(parentTable('Setting')).toBe('app_config')
  })

  test('splits a multi-word model name into snake case', () => {
    registerModelTables([{ name: 'PullRequest', table: 'pull_requests' }])

    expect(parentTable('PullRequest')).toBe('pull_requests')
  })

  test('falls back to the old guess for a model that is not being seeded', () => {
    // A framework model with no `useSeeder` never reaches the registry, and
    // the guess is still right for a regular plural.
    registerModelTables([{ name: 'Issue', table: 'issues' }])

    expect(parentTable('Team')).toBe('teams')
    expect(parentTable('PullRequest')).toBe('pull_requests')
  })

  test('a later registration replaces an earlier one', () => {
    // One process may seed more than once; a stale table name would send the
    // second run looking in the first run's tables.
    registerModelTables([{ name: 'Repository', table: 'repositories' }])
    registerModelTables([{ name: 'Repository', table: 'repos' }])

    expect(parentTable('Repository')).toBe('repos')
  })

  test('an empty registration falls back rather than throwing', () => {
    registerModelTables([])

    expect(parentTable('Issue')).toBe('issues')
  })
})
