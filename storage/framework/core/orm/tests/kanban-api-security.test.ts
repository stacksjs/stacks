import { describe, expect, it } from 'bun:test'
import Board from '../../../defaults/app/Models/Board'
import BoardColumn from '../../../defaults/app/Models/BoardColumn'
import Card from '../../../defaults/app/Models/Card'
import CardComment from '../../../defaults/app/Models/CardComment'
import Label from '../../../defaults/app/Models/Label'

describe('kanban model API security', () => {
  it.each([
    ['board', Board],
    ['board column', BoardColumn],
    ['card', Card],
    ['card comment', CardComment],
    ['label', Label],
  ])('protects every %s API route', (_kind, model) => {
    /*
     * A floor, not an exact list. This pinned `['auth']` exactly, so `Board`
     * gaining the active-team guard - which is MORE protection, required by
     * tests/unit/default-team-api-scope-contract.test.ts once it became
     * team-owned in stacksjs/stacks#2412 - read as a failure.
     */
    expect(model.traits.useApi.middleware).toContain('auth')
  })

  it('guards the board itself with the active-team middleware', () => {
    // `Board` carries `team_id` since #2412, and a team-owned generated API has
    // to be scoped to the caller's active team as well as authenticated.
    expect(Board.traits.useApi.middleware).toContain('team')
  })
})
