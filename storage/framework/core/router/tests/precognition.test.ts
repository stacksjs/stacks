// Asking "would this be accepted?" without doing it (stacksjs/stacks#2226).
//
// An Action's `validations:` block was a server-only artifact — nothing could
// read it from a template or a client script — so every form in every app
// retyped the rules in the browser and the two copies drifted. The framework's
// own defaults proved the failure mode: the browser refused a 7-character
// password that `POST /register` would have accepted.
//
// Rather than serialise a `schema.*` chain (a live object with no faithful JSON
// projection), the client asks the real endpoint to run the real rules and stop
// before the side effect. Header-compatible with Laravel Precognition.
//
// The property that matters most is the negative one: a probe must never reach
// handle(). A validate-only mode that still registers the user is worse than no
// validate-only mode at all. The route tests below assert that no lifecycle
// hook runs for a probe, even when the action has no validation rules.

import { describe, expect, it } from 'bun:test'
import { schema } from '@stacksjs/validation'
import { createStacksRouter, precognitionRequest, precognitionSuccess, validateActionInput } from '../src/stacks-router'

/** Minimal stand-in for the shape `precognitionRequest` reads. */
function request(url: string, headers: Record<string, string> = {}): any {
  return { url, headers: new Headers(headers) }
}

describe('recognising a precognition request (#2226)', () => {
  it('is not one by default', () => {
    expect(precognitionRequest(request('http://localhost/register'))).toBeNull()
  })

  it('the Precognition header opts in', () => {
    expect(precognitionRequest(request('http://localhost/register', { Precognition: 'true' })))
      .toEqual({ only: [] })
  })

  it('the header is case-insensitive in its value', () => {
    expect(precognitionRequest(request('http://localhost/register', { Precognition: 'True' })))
      .toEqual({ only: [] })
  })

  it('a header that is not "true" does not opt in', () => {
    // `Precognition: false` must mean what it says, not merely "present".
    expect(precognitionRequest(request('http://localhost/register', { Precognition: 'false' })))
      .toBeNull()
  })

  it('?_validate=1 opts in too', () => {
    // A header cannot be set on a plain form submission, and requiring one puts
    // this out of reach of the simplest caller.
    expect(precognitionRequest(request('http://localhost/register?_validate=1')))
      .toEqual({ only: [] })
  })

  it('another query value does not', () => {
    expect(precognitionRequest(request('http://localhost/register?_validate=0'))).toBeNull()
  })

  it.each(['/register', '/register?_validate=1'])('survives malformed url %s instead of throwing', (url) => {
    // `new URL` throws on a relative url, and a throw here would take down
    // every request rather than just this check.
    expect(precognitionRequest({ url, headers: new Headers() } as any)).toBeNull()
  })
})

describe('narrowing to the touched fields (#2226)', () => {
  it('parses the field list', () => {
    // Validate-on-blur is unusable without this: blurring the first field would
    // otherwise report every later field as empty.
    const probe = precognitionRequest(request('http://localhost/register', {
      'Precognition': 'true',
      'Precognition-Validate-Only': 'email,password',
    }))

    expect(probe).toEqual({ only: ['email', 'password'] })
  })

  it('tolerates spacing and trailing separators', () => {
    const probe = precognitionRequest(request('http://localhost/register', {
      'Precognition': 'true',
      'Precognition-Validate-Only': ' email , , password, ',
    }))

    expect(probe).toEqual({ only: ['email', 'password'] })
  })
})

describe('the success answer (#2226)', () => {
  const res = precognitionSuccess()

  it('is 204, not an empty 200', () => {
    // A 200 with no body is indistinguishable from the action having run and
    // returned nothing.
    expect(res.status).toBe(204)
  })

  it('says what it was', () => {
    expect(res.headers.get('Precognition-Success')).toBe('true')
  })

  it('varies on the headers that change the answer', () => {
    // Same URL, same method, two different answers — without Vary a shared
    // cache may serve this 204 to a caller that meant to submit.
    expect(res.headers.get('Vary')).toContain('Precognition')
  })
})

describe('narrowed validation runs the real rules (#2226)', () => {
  // The point of the whole mechanism: the browser gets the server's answer, not
  // a retyped approximation of it.
  const rules = {
    email: { rule: schema.string().email(), message: 'Email must be a valid email address.' },
    password: { rule: schema.string().min(8).max(255), message: 'Password must be between 8 and 255 characters.' },
  }

  // `getRequestInput` reads `req.jsonBody`, which `parseRequestBody` has
  // already populated by the time any action handler runs — the raw stream is
  // long consumed. The precognition branch sits in the same handler as the
  // ordinary validation pass, so it sees exactly this input.
  function payload(body: Record<string, unknown>): any {
    const req = new Request('http://localhost/register', { method: 'POST' }) as any
    req.jsonBody = body
    return req
  }

  it('rejects the password the browser used to accept', async () => {
    // Seven characters: refused by the app's hand-written copy, accepted by
    // RegisterAction's own min(6). This is the drift the issue reported.
    const result = await validateActionInput(payload({ email: 'a@b.com', password: '1234567' }), rules as any)
    expect(result.valid).toBeFalse()
    expect(result.errors.password).toBeDefined()
  })

  it('accepts one that satisfies the policy', async () => {
    const result = await validateActionInput(payload({ email: 'a@b.com', password: '12345678' }), rules as any)
    expect(result.valid).toBeTrue()
  })

  it('a narrowed run only reports the named field', async () => {
    // Only `password` is submitted; validating just that field must not report
    // the absent email — which is what makes validate-on-blur usable.
    const narrowed = { password: rules.password }
    const result = await validateActionInput(payload({ password: 'short' }), narrowed as any)
    expect(result.valid).toBeFalse()
    expect(Object.keys(result.errors)).toEqual(['password'])
  })

  it('the full rule set reports the other field too', async () => {
    // The control for the narrowing above: same request, unnarrowed rules.
    // Without it, the previous test passes even if narrowing does nothing.
    //
    // `email` must be spelled `.required()` here, because a bare
    // `schema.string().email()` PASSES on an absent value — which is worth
    // knowing on its own: RegisterAction and LoginAction both declare email
    // that way, so a POST with no email at all clears validation today.
    const strict = {
      email: { rule: schema.string().required().email(), message: 'Email must be a valid email address.' },
      password: rules.password,
    }

    const result = await validateActionInput(payload({ password: 'short' }), strict as any)
    expect(Object.keys(result.errors).sort()).toEqual(['email', 'password'])
  })

  it('an absent value clears a rule that is not required', async () => {
    // Pinning the surprise above so it is a documented property rather than
    // something the next person rediscovers through a test they think is broken.
    const result = await validateActionInput(payload({}), rules as any)
    expect(result.valid).toBeTrue()
  })
})

describe('a precognition request never reaches the handler (#2226)', () => {
  it.each([
    { query: '', headers: { Precognition: 'true' }, probe: true },
    { query: '?_validate=1', headers: {}, probe: true },
    { query: '?%5Fvalidate=%31', headers: {}, probe: true },
    { query: '?_validate=0&_validate=1', headers: {}, probe: false },
    { query: '?_validate=0', headers: { Precognition: 'true' }, probe: true },
    { query: '#?_validate=1', headers: {}, probe: false },
    { query: '', headers: {}, probe: false },
  ])('dispatches the expected lifecycle for %j', async ({ query, headers, probe }) => {
    for (const withRules of [true, false]) {
      const calls: string[] = []
      const router = createStacksRouter()
      router.post('/precognition-dispatch', {
        skipCsrf: true,
        validations: withRules ? { name: { rule: schema.string().required() } } : undefined,
        authorize() { calls.push('authorize'); return true },
        before() { calls.push('before') },
        handle() { calls.push('handle'); return { ok: true } },
      })

      const response = await router.handleRequest(new Request(`http://localhost/precognition-dispatch${query}`, {
        method: 'POST',
        headers: { ...headers, 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'test' }),
      }))

      expect(response.status).toBe(probe ? 204 : 200)
      expect(calls).toEqual(probe ? [] : ['authorize', 'before', 'handle'])
      if (probe)
        expect(response.headers.get('Precognition-Success')).toBe('true')
      else
        expect(await response.json()).toEqual({ ok: true })
    }
  })
})
