/**
 * stacksjs/stacks#3311 - a page's form that its action's rules refuse
 * however it is filled in. The rule and the page are two files and each
 * looks right alone, so nothing said so until a person was refused.
 */
import process from 'node:process'
import { describe, expect, it } from 'bun:test'
import { schema } from '@stacksjs/validation/runtime'
import { collectFormRuleReport, describeFormRules, parseViewForms, unmetFormRules } from '../src/form-rules'

const page = `
<form action="/api/settings" method="POST">
  <input type="hidden" name="_token" value="{{ csrf }}">
  <input type="text" name="display_name" value="{{ user.name }}">
  <input type="checkbox" name="notify">
  <input type="checkbox" name="terms" value="yes">
  <select name="plan"><option value="free">Free</option><option value="pro">Pro</option><option value="team">Team</option></select>
  <input type="radio" name="tier" value="gold"><input type="radio" name="tier" value="{{ other }}">
  <input type="checkbox" name="tags[]" value="a">
</form>
<form action="/search" method="get"><input name="q"></form>
<form :action="target" method="post"><input name="x"></form>
`

describe('reading a page\'s forms', () => {
  it('reads plain POST forms and what each control can send', () => {
    const forms = parseViewForms(page, 'resources/views/settings.stx')
    expect(forms.map(form => [form.action, form.method, form.line])).toEqual([['/api/settings', 'POST', 2]])
    const fields = forms[0]!.fields
    expect([...fields.keys()]).toEqual(['_token', 'display_name', 'notify', 'terms', 'plan', 'tier', 'tags'])
    expect(fields.get('notify')).toMatchObject({ values: ['on'], computed: false })
    expect(fields.get('plan')!.values).toEqual(['free', 'pro', 'team'])
    expect(fields.get('tier')!.computed).toBe(true)
    expect(fields.get('_token')!.computed).toBe(true)
  })
})

describe('what a form cannot meet', () => {
  const form = parseViewForms(page, 'resources/views/settings.stx')[0]!

  it('says nothing for rules the form can meet', () => {
    expect(unmetFormRules(form, {
      display_name: { rule: schema.string().required() },
      notify: { rule: schema.boolean() },
      plan: { rule: schema.enum(['free', 'pro', 'team']) },
      tags: { rule: schema.array() },
      // Sent by a control whose value is drawn on the page: not read here.
      tier: { rule: schema.enum(['gold', 'silver']) },
    } as any)).toEqual([])
  })

  it('names each rule the form cannot meet', () => {
    expect(unmetFormRules(form, {
      address: { rule: (schema as any).object({ city: schema.string() }) },
      email: { rule: schema.string().email().required() },
      notify: { rule: schema.boolean().required() },
      terms: { rule: schema.boolean() },
      plan: { rule: schema.enum(['free', 'pro']) },
    } as any)).toEqual([
      '`address` must be an object, and a form sends only text, files and lists of them',
      '`email` is required, and this form has no control named `email`',
      '`notify` is a required yes or no sent only by a checkbox, which sends nothing when it is not ticked',
      '`terms` must be a yes or no, and the page sends "yes" for it',
      '`plan` must be one of "free", "pro", and the page offers "team"',
    ])
  })

  it('does not ask a form for what the address supplies', () => {
    expect(unmetFormRules(form, { id: { rule: schema.number().required() } } as any, new Set(['id']))).toEqual([])
  })
})

describe('pairing forms with their routes', () => {
  const forms = parseViewForms(page, 'resources/views/settings.stx')

  it('warns with the page, the line and the address', () => {
    const report = describeFormRules(forms, [
      { method: 'GET', path: '/api/settings', validations: { email: { rule: schema.string().required() } } as any },
      { method: 'POST', path: '/api/settings', validations: { email: { rule: schema.string().required() } } as any },
    ])
    expect(report.status).toBe('warn')
    expect(report.message).toContain('resources/views/settings.stx:2 posts to /api/settings: `email` is required, and this form has no control named `email`')
  })

  it('matches a route with parameters, and leaves a route with no rules alone', () => {
    const posted = parseViewForms('<form action="/api/posts/7/comments?draft=1" method="post"><textarea name="body"></textarea></form>', 'post.stx')
    expect(describeFormRules(posted, [{ method: 'POST', path: '/api/posts/{post}/comments', validations: { post: { rule: schema.number().required() }, draft: { rule: schema.string().required() }, body: { rule: schema.string().required() } } as any }]))
      .toEqual({ status: 'pass', message: '1 form can meet the rules of the action it posts to' })
    expect(describeFormRules(posted, [{ method: 'POST', path: '/api/posts/{post}/comments', validations: undefined }]).status).toBe('pass')
  })
})

describe('this repository\'s own pages', () => {
  it('can all meet the rules of the actions they post to', async () => {
    // The storefront is what posts plain forms; mounted the way the server
    // mounts it, so the checkout's forms are paired with their real actions.
    const before = process.env.STACKS_DEFAULT_ROUTES
    process.env.STACKS_DEFAULT_ROUTES = 'storefront'
    try {
      const report = await collectFormRuleReport(new URL('../../../../..', import.meta.url).pathname)
      expect(report.status, report.message).toBe('pass')
      // The contact and shipping steps at least: a count of none would pass
      // without having checked anything.
      expect(Number(/^(\d+) forms? can meet/.exec(report.message)?.[1])).toBeGreaterThanOrEqual(2)
    }
    finally {
      if (before === undefined)
        delete process.env.STACKS_DEFAULT_ROUTES
      else
        process.env.STACKS_DEFAULT_ROUTES = before
    }
  }, 120_000)
})
