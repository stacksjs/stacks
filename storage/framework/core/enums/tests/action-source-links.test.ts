/**
 * Every `Action` member links to the source that runs when you pass it.
 *
 * "Go to Definition" on `Action.BuildViews` lands on the enum member, which is
 * a string - not the code it names (stacksjs/stacks#591). The value *is* the
 * path (`'build/views'` → `actions/src/build/views.ts`, which is how
 * `runAction` resolves it), so a link in the hover is the second hop a reader
 * needs.
 *
 * Three ways that can go wrong, and all three fail here: a member added without
 * a link, a link that disagrees with the value it sits above, and a value whose
 * file no longer exists. The last one is the useful one beyond editor
 * ergonomics - it is how a renamed or deleted action gets caught, since nothing
 * else resolves these paths until the action is actually run.
 */
import { describe, expect, it } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const enumsSrc = resolve(import.meta.dir, '../src/index.ts')
const actionsSrc = resolve(import.meta.dir, '../../actions/src')

interface Member {
  name: string
  value: string
  link: string | null
}

function actionMembers(): Member[] {
  const source = readFileSync(enumsSrc, 'utf-8')
  const start = source.indexOf('export enum Action {')
  const body = source.slice(start, source.indexOf('\n}', start))
  const members: Member[] = []
  let pendingLink: string | null = null

  for (const line of body.split('\n')) {
    const link = /\/\*\* \[`[^`]+`\]\(([^)]+)\) \*\//.exec(line)
    if (link) {
      pendingLink = link[1]!
      continue
    }
    const member = /^\s+(\w+) = '([^']+)',?$/.exec(line)
    if (member) {
      members.push({ name: member[1]!, value: member[2]!, link: pendingLink })
      pendingLink = null
    }
  }

  return members
}

describe('Action source links', () => {
  const members = actionMembers()

  it('finds the enum, so a parse failure cannot pass as an empty pass', () => {
    expect(members.length).toBeGreaterThan(50)
  })

  it('gives every member a link', () => {
    expect(members.filter(member => !member.link).map(member => member.name)).toEqual([])
  })

  it('links where the value says, not somewhere else', () => {
    const wrong = members
      .filter(member => member.link !== `../../actions/src/${member.value}.ts`)
      .map(member => `${member.name} -> ${member.link}`)

    expect(wrong).toEqual([])
  })

  it('names a file that exists', () => {
    const missing = members
      .filter(member => !existsSync(resolve(actionsSrc, `${member.value}.ts`)))
      .map(member => `${member.name} = '${member.value}'`)

    expect(missing).toEqual([])
  })
})
