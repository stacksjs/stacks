import { describe, expect, test } from 'bun:test'
import { KANBAN_TABLES, kanbanActionError, kanbanNotMigratedMessage, missingKanbanTables } from './kanban-response'

/**
 * A Kanban action that fails on a database without its tables says which
 * tables and the command that creates them, instead of a generic 500
 * (stacksjs/stacks#3217). Anything else keeps the generic answer, with no
 * database error text in it.
 */
describe('kanbanActionError', () => {
  test('missing tables answer 503 naming them and ./buddy migrate', async () => {
    const reply = await kanbanActionError(new Error('relation "card_assignees" does not exist'), 'BoardShowAction', async () => ['card_labels', 'card_assignees'])
    expect(reply.status).toBe(503)
    const body = await reply.json() as { error: string, missingTables: string[] }
    expect(body.missingTables).toEqual(['card_labels', 'card_assignees'])
    expect(body.error).toBe('Kanban is not set up yet: the card_labels and card_assignees tables do not exist. Run ./buddy migrate to create them.')
  })

  test('with every table present it is the generic 500, and the error text stays out', async () => {
    const reply = await kanbanActionError(new Error('deadlock detected on cards'), 'CardUpdateAction', async () => [])
    expect(reply.status).toBe(500)
    const body = await reply.json() as { error: string }
    expect(body.error).toBe('The Kanban request could not be completed.')
    expect(JSON.stringify(body)).not.toContain('deadlock')
  })
})

describe('missingKanbanTables', () => {
  test('asks about every Kanban table and keeps their order', async () => {
    const asked: string[] = []
    const missing = await missingKanbanTables(async (table) => { asked.push(table); return table.startsWith('card_') })
    expect(asked).toEqual([...KANBAN_TABLES])
    expect(missing).toEqual(['card_labels', 'card_assignees', 'card_comments', 'card_attachments'])
  })
})

test('the message reads naturally for one table and for several', () => {
  expect(kanbanNotMigratedMessage(['boards'])).toBe('Kanban is not set up yet: the boards table does not exist. Run ./buddy migrate to create them.')
  expect(kanbanNotMigratedMessage(['a', 'b', 'c'])).toBe('Kanban is not set up yet: the a, b and c tables do not exist. Run ./buddy migrate to create them.')
})
