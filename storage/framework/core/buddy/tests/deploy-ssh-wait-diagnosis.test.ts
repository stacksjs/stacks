import { describe, expect, it } from 'bun:test'
import {
  bunRuntimeMissingMessage,
  pollFailureDetail,
  pollUntil,
  sshUnreachableMessage,
} from '../src/commands/deploy'

describe('pollFailureDetail', () => {
  it("carries the remote stderr out of sshExecOrThrow's message", () => {
    const err = new Error('ssh `true` on 203.0.113.51 failed (255): Permission denied (publickey).')

    expect(pollFailureDetail(err)).toContain('Permission denied (publickey)')
  })

  it('collapses the several lines ssh spreads one refusal over', () => {
    const err = new Error('ssh failed (255):\nkex_exchange_identification: read: Connection reset by peer\n\nConnection reset')

    const detail = pollFailureDetail(err)!

    expect(detail).not.toContain('\n')
    expect(detail).toContain('Connection reset by peer')
  })

  it('caps a chatty banner so it cannot bury the summary', () => {
    const detail = pollFailureDetail(new Error('x'.repeat(900)))!

    expect(detail).toHaveLength(300)
    expect(detail.endsWith('...')).toBe(true)
  })

  it('accepts a thrown string as well as an Error', () => {
    expect(pollFailureDetail('Connection timed out')).toBe('Connection timed out')
  })

  it('reports nothing rather than an empty line when there is nothing to say', () => {
    expect(pollFailureDetail(undefined)).toBeUndefined()
    expect(pollFailureDetail(new Error(''))).toBeUndefined()
    expect(pollFailureDetail(new Error('   \n  '))).toBeUndefined()
    expect(pollFailureDetail({ nope: true })).toBeUndefined()
  })
})

describe('sshUnreachableMessage', () => {
  const base = { ip: '203.0.113.51', waitSecs: 480, elapsedSecs: 485 }

  it('still states the host and how long it waited', () => {
    const message = sshUnreachableMessage(base)

    expect(message).toContain('203.0.113.51')
    expect(message).toContain('within 8m')
    expect(message).toContain('waited 485s')
  })

  it('leads with what the last attempt actually said', () => {
    const message = sshUnreachableMessage({
      ...base,
      lastError: new Error('ssh `true` on 203.0.113.51 failed (255): Permission denied (publickey).'),
    })

    expect(message).toContain('Last attempt: ')
    expect(message).toContain('Permission denied (publickey)')
  })

  it('distinguishes the three causes that look identical from here', () => {
    // The whole point of #2342: a rejected key and a fail2ban ban used to
    // produce the same "the box may still be booting" line.
    const message = sshUnreachableMessage(base)

    expect(message).toContain('TS_CLOUD_SSH_WAIT_SECS')
    expect(message).toContain('Permission denied')
    expect(message).toContain('fail2ban')
    expect(message).toContain('Waiting longer fixes neither')
  })

  it('no longer asserts booting as the cause', () => {
    expect(sshUnreachableMessage(base)).not.toContain('The box may still be booting')
  })

  it('omits the detail line entirely when there is no error to show', () => {
    expect(sshUnreachableMessage(base)).not.toContain('Last attempt:')
  })

  it('keeps the fail2ban hint reachable when a ban is what happened', () => {
    const message = sshUnreachableMessage({
      ...base,
      lastError: new Error('ssh failed (255): kex_exchange_identification: read: Connection reset by peer'),
    })

    expect(message).toContain('Connection reset by peer')
    expect(message).toContain('fail2ban')
  })
})

describe('bunRuntimeMissingMessage', () => {
  it('points at the cloud-init log and includes the last failure', () => {
    const message = bunRuntimeMissingMessage({
      waitSecs: 720,
      elapsedSecs: 725,
      lastError: new Error('ssh `test -x /usr/local/bin/bun` on 203.0.113.51 failed (1): '),
    })

    expect(message).toContain('within 12m')
    expect(message).toContain('/var/log/cloud-init-output.log')
    expect(message).toContain('TS_CLOUD_BOOT_WAIT_SECS')
    expect(message).toContain('Last attempt: ')
  })
})

describe('pollUntil', () => {
  it('hands the last failure to timeoutMessage, which is the whole fix', async () => {
    // Without `lastError = err` in the loop, timeoutMessage can only ever see
    // elapsed time, and every cause reads the same. This is what pins it.
    let seen: unknown
    const attempt = new Error('ssh `true` on 203.0.113.51 failed (255): Permission denied (publickey).')

    await expect(pollUntil({
      label: 'Waiting for SSH to come up',
      timeoutSecs: 0,
      intervalMs: 1,
      check: () => {
        throw attempt
      },
      timeoutMessage: (elapsed, lastError) => {
        seen = lastError
        return `gave up after ${elapsed}s: ${pollFailureDetail(lastError) ?? 'no detail'}`
      },
    })).rejects.toThrow('Permission denied (publickey)')

    expect(seen).toBe(attempt)
  })

  it('returns as soon as the check stops throwing', async () => {
    let calls = 0

    await pollUntil({
      label: 'Waiting',
      timeoutSecs: 30,
      intervalMs: 1,
      check: () => {
        calls++
        if (calls < 3)
          throw new Error('not yet')
      },
      timeoutMessage: () => 'should not be reached',
    })

    expect(calls).toBe(3)
  })
})
