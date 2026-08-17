import { describe, expect, it } from 'bun:test'
import ConsentEvent from '../../../defaults/app/Models/ConsentEvent'

describe('consent ledger', () => {
  it('scopes generated reads to an authenticated team', () => {
    expect(ConsentEvent.traits.useApi).toMatchObject({
      middleware: ['auth', 'team'],
    })
  })

  it('deduplicates provider decisions within a team', () => {
    expect(ConsentEvent.attributes.idempotencyKey).toMatchObject({
      required: false,
      fillable: true,
    })
    expect(ConsentEvent.indexes).toContainEqual({
      name: 'consent_events_idempotency_unique',
      columns: ['team_id', 'idempotency_key'],
      unique: true,
    })
  })
})
