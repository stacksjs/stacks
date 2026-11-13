import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { modelSwitchColumns, modelSwitches, modelSwitchFields, modelSwitchOn, planSwitches, requestedSwitches } from '../../storage/framework/defaults/app/Actions/Dashboard/Models/model-switches'
import { modelFieldInputValue, modelFormFieldsFor, modelFormPayload, modelFormValues } from '../../storage/framework/defaults/functions/dashboard-model-record'

/**
 * An account's confirmed email and two-factor are switches on its edit form
 * (stacksjs/stacks#3298).
 *
 * Both sat in the form's read-only panel: the `useAuth` trait owns those
 * columns, so no form asked for them, and support needed a database console
 * to confirm an address or to let someone back in who lost their device.
 */
const account = { name: 'User', table: 'users', traits: { useAuth: true }, attributes: {} }

describe('which models have switches', () => {
  it('the account model has its two, and no other model has any', () => {
    expect(modelSwitches(account).map(entry => `${entry.name}:${entry.column}:${entry.only ?? 'both'}`)).toEqual([
      'emailVerifiedAt:email_verified_at:both',
      'twoFactorEnabled:two_factor_enabled:off',
    ])
    expect(modelSwitchColumns(account)).toEqual(['email_verified_at', 'two_factor_enabled'])
    // The auth package writes `users`: another model that signs in is not it.
    expect(modelSwitches({ ...account, name: 'Admin' })).toEqual([])
    expect(modelSwitches({ name: 'User', table: 'users', traits: {} })).toEqual([])
    expect(modelSwitches({ name: 'Board', attributes: {} })).toEqual([])
    expect(modelSwitchFields({ name: 'Board' })).toEqual([])
  })

  it('each is a yes-or-no field of the form, with what to say under it', () => {
    const [email, twoFactor] = modelSwitchFields(account)
    expect(email).toMatchObject({ name: 'emailVerifiedAt', label: 'Email Verified', type: 'boolean', required: false, switch: {} })
    expect(twoFactor).toMatchObject({ name: 'twoFactorEnabled', label: 'Two Factor Enabled', type: 'boolean', switch: { only: 'off' } })
    expect(twoFactor!.switch!.lockedHelp).toContain('Only the account holder can turn this on')
    expect(twoFactor!.help).toContain('recovery codes stop working')
  })
})

describe('what a save asks of a switch', () => {
  it('reads yes and no however they are spelled, by field or by column', () => {
    const asked = (body: Record<string, unknown>) => requestedSwitches(account, body).asked.map(request => `${request.switch.name}:${request.on}`)
    expect(asked({ emailVerifiedAt: true, two_factor_enabled: 'off' })).toEqual(['emailVerifiedAt:true', 'twoFactorEnabled:false'])
    expect(asked({ email_verified_at: '1' })).toEqual(['emailVerifiedAt:true'])
    expect(asked({ name: 'Ava' })).toEqual([])
    expect(requestedSwitches({ name: 'Board' }, { emailVerifiedAt: true }).asked).toEqual([])
  })

  it('refuses what is neither, instead of reading it as off', () => {
    expect(requestedSwitches(account, { emailVerifiedAt: '2020-01-01', twoFactorEnabled: null })).toEqual({
      asked: [],
      errors: { emailVerifiedAt: ['Email Verified is on or off.'], twoFactorEnabled: ['Two Factor Enabled is on or off.'] },
    })
  })

  it('turns only what would change, and refuses a way a switch does not turn', () => {
    const plan = (body: Record<string, unknown>, stored: Record<string, unknown>) => {
      const { turning, errors } = planSwitches(account, requestedSwitches(account, body).asked, stored)
      return { turning: turning.map(request => `${request.switch.name}:${request.on}`), errors }
    }
    expect(plan({ emailVerifiedAt: true, twoFactorEnabled: false }, { email_verified_at: null, two_factor_enabled: 1 })).toEqual({ turning: ['emailVerifiedAt:true', 'twoFactorEnabled:false'], errors: {} })
    // Already there: nothing to do, and nothing wrong.
    expect(plan({ emailVerifiedAt: true, twoFactorEnabled: false }, { email_verified_at: '2026-11-01 10:00:00', two_factor_enabled: 0 })).toEqual({ turning: [], errors: {} })
    const refused = plan({ twoFactorEnabled: true }, { two_factor_enabled: false })
    expect(refused.turning).toEqual([])
    expect(refused.errors.twoFactorEnabled?.[0]).toContain('Only the account holder')
  })

  it('reads a stored value as yes when it is set, true or one', () => {
    for (const yes of ['2026-11-01 10:00:00', true, 1, '1', new Date()])
      expect(modelSwitchOn(yes)).toBe(true)
    for (const no of [null, undefined, false, 0, '0', '', 'false'])
      expect(modelSwitchOn(no)).toBe(false)
  })
})

describe('the form', () => {
  const fields = modelSwitchFields(account) as any[]

  it('starts a switch from whether its column is set, and sends only what was turned', () => {
    const start = modelFormValues(fields, { email_verified_at: '2026-11-01 10:00:00', two_factor_enabled: 0 })
    expect(start).toEqual({ emailVerifiedAt: true, twoFactorEnabled: false })
    expect(modelFieldInputValue(fields[0], null)).toBe(false)
    expect(modelFormPayload(fields, { ...start, emailVerifiedAt: false }, start)).toEqual({ emailVerifiedAt: false })
    expect(modelFormPayload(fields, start, start)).toEqual({})
  })

  it('shows, and does not offer, a switch that cannot be turned from where it is', () => {
    const off = modelFormFieldsFor(fields, { emailVerifiedAt: false, twoFactorEnabled: false })
    expect(off[0]).toBe(fields[0])
    expect(off[1]).toMatchObject({ disabled: true, help: fields[1].switch.lockedHelp })
    // On, it can be turned off, and says what that does.
    const on = modelFormFieldsFor(fields, { emailVerifiedAt: false, twoFactorEnabled: true })
    expect(on[1]).toBe(fields[1])
    expect(on[1].disabled).toBeUndefined()
  })

  it('the edit page locks from what is stored, and the inputs honor it', () => {
    const components = 'storage/framework/defaults/resources/components/Dashboard'
    const edit = readFileSync(`${components}/Models/ModelRecordEdit.stx`, 'utf8')
    // From `initial()`, not `values()`: a switch turned off in the form can be turned back before saving.
    expect(edit).toContain('const writable = derived(() => modelFormFieldsFor(record()?.fields ?? [], initial()))')
    expect(readFileSync(`${components}/Models/ModelFieldInputs.stx`, 'utf8')).toContain(':disabled="disabled() || field.disabled === true"')
    // Under a switch that cannot be turned, the reason is still readable.
    const toggle = readFileSync(`${components}/UI/Toggle.stx`, 'utf8')
    expect(toggle).toContain('liveDisabled() ? \'cursor-not-allowed\' : \'cursor-pointer\'')
    expect(toggle).not.toContain('cursor-not-allowed opacity-60')
  })
})

describe('through a real server and a real database', () => {
  it('a save turns the switches through the auth package, and refuses what cannot be turned', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'stacks-model-switches-'))
    try {
      const config = join(directory, 'bunfig.toml')
      await writeFile(config, 'preload = []\n')
      const child = Bun.spawn([process.execPath, `--config=${config}`, '--no-env-file', `${import.meta.dir}/fixtures/model-switches.ts`], {
        env: { ...process.env, APP_ENV: 'test', MAIL_MAILER: 'log', DB_CONNECTION: 'sqlite', DB_DATABASE_PATH: join(directory, 'users.sqlite'), DB_QUERY_LOGGING_ENABLED: 'false' },
        stdout: 'pipe',
        stderr: 'pipe',
      })
      const watchdog = setTimeout(() => child.kill(), 50_000)
      try {
        const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
        expect(code, `${stdout}\n${stderr}`).toBe(0)
        expect(stdout).toContain('model switches OK')
      }
      finally {
        clearTimeout(watchdog)
        child.kill()
      }
    }
    finally {
      await rm(directory, { recursive: true, force: true })
    }
  }, 60_000)
})
