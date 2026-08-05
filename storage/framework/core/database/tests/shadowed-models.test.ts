import type { ShadowedModel } from '../src/model-sources'
import { describe, expect, it } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { resolveModelSources } from '../src/model-sources'
import {
  ALLOW_SHADOW_DROPS_ENV,
  declaredTable,
  findShadowedColumnDrops,
  shadowedDropMessage,
} from '../src/shadowed-models'

// A userland model REPLACES a framework default rather than extending it, and
// the differ treats the surviving model as the truth - so writing an
// `app/Models/Release.ts` without knowing the framework ships one generates
// `ALTER TABLE releases DROP COLUMN version` while the framework's own
// dashboard actions go on selecting it. The migration applies cleanly and
// nothing fails until a page that has always worked stops finding a column.
//
// These cover the guard that refuses that migration, and - as importantly -
// the cases it must NOT refuse, since overriding a default is a supported
// thing to do.

function modelSource(name: string, table: string): string {
  return `import { defineModel } from '@stacksjs/orm'\n\nexport default defineModel({\n  name: '${name}',\n  table: '${table}',\n  attributes: {},\n})\n`
}

function withModels(run: (dirs: { user: string, framework: string }) => void): void {
  const root = mkdtempSync(join(tmpdir(), 'stacks-shadow-'))

  try {
    const user = join(root, 'user')
    const framework = join(root, 'framework')
    require('node:fs').mkdirSync(user, { recursive: true })
    require('node:fs').mkdirSync(framework, { recursive: true })
    run({ user, framework })
  }
  finally {
    rmSync(root, { recursive: true, force: true })
  }
}

describe('declaredTable', () => {
  it('reads the table a model declares', () => {
    withModels(({ user }) => {
      const file = join(user, 'Release.ts')
      writeFileSync(file, modelSource('Release', 'releases'))

      expect(declaredTable(file)).toBe('releases')
    })
  })

  it('is null for a file it cannot read, rather than throwing mid-generate', () => {
    expect(declaredTable('/no/such/model.ts')).toBeNull()
  })
})

describe('resolveModelSources reports shadowing', () => {
  it('names the framework defaults a userland model replaced', () => {
    withModels(({ user, framework }) => {
      writeFileSync(join(framework, 'Release.ts'), modelSource('Release', 'releases'))
      writeFileSync(join(framework, 'User.ts'), modelSource('User', 'users'))
      writeFileSync(join(user, 'Release.ts'), modelSource('Release', 'releases'))
      writeFileSync(join(user, 'Widget.ts'), modelSource('Widget', 'widgets'))

      const sources = resolveModelSources({ userRoot: user, frameworkRoot: framework })

      expect(sources!.shadowed.map(model => model.name)).toEqual(['Release'])
    })
  })

  it('a model only the app defines shadows nothing', () => {
    withModels(({ user, framework }) => {
      writeFileSync(join(framework, 'User.ts'), modelSource('User', 'users'))
      writeFileSync(join(user, 'Widget.ts'), modelSource('Widget', 'widgets'))

      expect(resolveModelSources({ userRoot: user, frameworkRoot: framework })!.shadowed).toEqual([])
    })
  })
})

describe('findShadowedColumnDrops', () => {
  function shadow(user: string, framework: string): ShadowedModel[] {
    return [{ name: 'Release', userFile: user, frameworkFile: framework }]
  }

  it('finds a drop on a table an override took over', () => {
    withModels(({ user, framework }) => {
      const userFile = join(user, 'Release.ts')
      const frameworkFile = join(framework, 'Release.ts')
      writeFileSync(userFile, modelSource('Release', 'releases'))
      writeFileSync(frameworkFile, modelSource('Release', 'releases'))

      const drops = findShadowedColumnDrops([
        'ALTER TABLE "releases" DROP COLUMN "version";',
        'ALTER TABLE "releases" DROP COLUMN "status";',
        'ALTER TABLE "releases" ADD COLUMN "tag_name" varchar(255);',
      ], shadow(userFile, frameworkFile))

      expect(drops).toEqual([{ model: 'Release', table: 'releases', columns: ['version', 'status'] }])
    })
  })

  /**
   * The recommended way out, so it must not be refused: a model of the same
   * name on its own table shares nothing with the framework's.
   */
  it('allows an override that moved to its own table', () => {
    withModels(({ user, framework }) => {
      const userFile = join(user, 'Release.ts')
      const frameworkFile = join(framework, 'Release.ts')
      writeFileSync(userFile, modelSource('Release', 'repo_releases'))
      writeFileSync(frameworkFile, modelSource('Release', 'releases'))

      expect(findShadowedColumnDrops([
        'ALTER TABLE "releases" DROP COLUMN "version";',
      ], shadow(userFile, frameworkFile))).toEqual([])
    })
  })

  /** Adding to an overridden model is the case the mechanism exists for. */
  it('allows an override that only adds columns', () => {
    withModels(({ user, framework }) => {
      const userFile = join(user, 'Release.ts')
      const frameworkFile = join(framework, 'Release.ts')
      writeFileSync(userFile, modelSource('Release', 'releases'))
      writeFileSync(frameworkFile, modelSource('Release', 'releases'))

      expect(findShadowedColumnDrops([
        'ALTER TABLE "releases" ADD COLUMN "tag_name" varchar(255);',
        'CREATE INDEX "releases_tag_index" ON "releases" ("tag_name");',
      ], shadow(userFile, frameworkFile))).toEqual([])
    })
  })

  it('ignores drops on tables nobody shadowed', () => {
    withModels(({ user, framework }) => {
      const userFile = join(user, 'Release.ts')
      const frameworkFile = join(framework, 'Release.ts')
      writeFileSync(userFile, modelSource('Release', 'releases'))
      writeFileSync(frameworkFile, modelSource('Release', 'releases'))

      expect(findShadowedColumnDrops([
        'ALTER TABLE "widgets" DROP COLUMN "colour";',
      ], shadow(userFile, frameworkFile))).toEqual([])
    })
  })

  it('reads the drop however the dialect quotes it', () => {
    withModels(({ user, framework }) => {
      const userFile = join(user, 'Release.ts')
      const frameworkFile = join(framework, 'Release.ts')
      writeFileSync(userFile, modelSource('Release', 'releases'))
      writeFileSync(frameworkFile, modelSource('Release', 'releases'))

      for (const statement of [
        'ALTER TABLE `releases` DROP COLUMN `version`;',
        'ALTER TABLE releases DROP COLUMN version;',
        'alter table "releases" drop column "version";',
        'ALTER TABLE "releases" DROP "version";',
      ]) {
        expect(findShadowedColumnDrops([statement], shadow(userFile, frameworkFile)), statement)
          .toHaveLength(1)
      }
    })
  })

  it('nothing shadowed means nothing to check', () => {
    expect(findShadowedColumnDrops(['ALTER TABLE "releases" DROP COLUMN "version";'], [])).toEqual([])
  })
})

describe('shadowedDropMessage', () => {
  const drops = [{ model: 'Release', table: 'releases', columns: ['version', 'status'] }]

  it('names the columns, so nobody has to go and read generated SQL', () => {
    const message = shadowedDropMessage(drops)

    expect(message).toContain('`version`')
    expect(message).toContain('`status`')
    expect(message).toContain('releases')
  })

  it('names both ways out, because only the author knows which they meant', () => {
    const message = shadowedDropMessage(drops)

    expect(message).toContain('buddy publish:model Release')
    expect(message).toContain('its own table')
  })

  it('names the escape hatch for somebody who means it', () => {
    expect(shadowedDropMessage(drops)).toContain(ALLOW_SHADOW_DROPS_ENV)
  })
})
