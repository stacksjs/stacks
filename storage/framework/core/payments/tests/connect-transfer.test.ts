import { afterEach, describe, expect, it, mock, spyOn } from 'bun:test'
import { stripe } from '../src/drivers/stripe'
import { manageTransfer } from '../src/connect/transfer'

afterEach(() => mock.restore())

describe('Connect payout retry identity', () => {
  it('reuses the ledger key after an uncertain transfer response', async () => {
    const create = spyOn(stripe.transfers, 'create').mockResolvedValue({ id: 'tr_paid' } as never)
    const payout = { destination: 'acct_coach', amount: 499, currency: 'EUR', idempotencyKey: 'ledger:42' }
    await manageTransfer.createTransfer(payout)
    await manageTransfer.createTransfer(payout)
    expect(create.mock.calls.map(call => call[1]?.idempotencyKey)).toEqual(['ledger:42', 'ledger:42'])
    expect(create.mock.calls[0]![0]).toEqual({ destination: 'acct_coach', amount: 499, currency: 'eur' })
  })

  it('allows two separate equal partial refunds without merging their reversals', async () => {
    const reverse = spyOn(stripe.transfers, 'createReversal').mockResolvedValue({ id: 'trr_paid' } as never)
    await manageTransfer.reverseTransfer('tr_paid', 100, { idempotencyKey: 'refund:1' })
    await manageTransfer.reverseTransfer('tr_paid', 100, { idempotencyKey: 'refund:1' })
    await manageTransfer.reverseTransfer('tr_paid', 100, { idempotencyKey: 'refund:2' })
    expect(reverse.mock.calls.map(call => call[2]?.idempotencyKey)).toEqual(['refund:1', 'refund:1', 'refund:2'])
  })
})
