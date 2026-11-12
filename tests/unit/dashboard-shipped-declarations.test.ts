import { describe, expect, it } from 'bun:test'
import { existsSync } from 'node:fs'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { loadModelRegistry } from '../../storage/framework/core/orm/src/model-registry'
import { modelActionDefinitions } from '../../storage/framework/defaults/app/Actions/Dashboard/Models/model-actions'
import { modelFieldOverrides } from '../../storage/framework/defaults/app/Actions/Dashboard/Models/model-fields'
import { modelCreateFields, modelFieldProblems } from '../../storage/framework/defaults/app/Actions/Dashboard/Models/model-write'

/**
 * What the shipped models say about their own fields and actions
 * (stacksjs/stacks#3286).
 *
 * The dashboard could ask for a file, a long piece of text or a web address,
 * show a picture or a link, and run a model's own action from a button, and
 * only `User` used any of it. The shipped models now say so wherever the
 * answer is certain, so a fresh app gets an avatar chooser, a box with room
 * for a description, and a "Retry" on a failed job without configuring
 * anything.
 *
 * "Certain" is the rule, and these tests hold each kind to it.
 */
const models = await loadModelRegistry({
  defaultsRoot: resolve('storage/framework/defaults/app/Models'),
  userRoot: join(tmpdir(), 'stacks-no-user-models'),
}) as Record<string, any>

/** Every `Model.field` whose declaration matches, sorted. */
function declared(match: (settings: Record<string, any>) => boolean): string[] {
  return Object.entries(models)
    .flatMap(([name, model]) => Object.entries((model?.dashboard?.fields ?? {}) as Record<string, Record<string, any>>)
      .filter(([, settings]) => match(settings))
      .map(([field]) => `${name}.${field}`))
    .sort()
}

function attribute(path: string): any {
  const [name, field] = path.split('.') as [string, string]
  return models[name].attributes[field]
}

function formField(path: string): any {
  const [name, field] = path.split('.') as [string, string]
  const column = field.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`)
  return modelCreateFields(models[name]).find(candidate => candidate.name === column || candidate.name === field)
}

const accepts = (path: string, value: string): boolean => Boolean(attribute(path).validation.rule.validate(value).valid)

describe('the fields the shipped models ask for differently', () => {
  it('none of them is misread: every name is a field and every setting one the dashboard has', () => {
    const wrong = Object.entries(models)
      .filter(([, model]) => model?.dashboard?.fields)
      .flatMap(([name, model]) => [...modelFieldProblems(model, name === 'User' ? ['email_verified_at'] : []), ...modelFieldOverrides(model).problems].map(problem => `${name}: ${problem}`))
    expect(wrong).toEqual([])
  })

  it('a picture a person or a post has is chosen as a file', () => {
    const uploads = declared(settings => settings.input === 'upload')
    expect(uploads).toEqual(['Author.avatar', 'Customer.avatar', 'Post.poster', 'User.avatar'])
    for (const path of uploads) {
      const field = formField(path)
      expect(field, path).toMatchObject({ type: 'upload', accept: 'image/*' })
      // What is saved is the address the file was stored at, and the field's
      // own rule has to take it: three of the four require a URL.
      expect(accepts(path, 'https://app.example/uploads/authors/avatar/3f2a9c.png'), path).toBe(true)
    }
    // Not the fields called `imageUrl`: those are an address by name, typed or
    // pasted, and a chooser would take away pointing at a picture kept
    // elsewhere. They are shown as the picture instead (below).
    expect(uploads.filter(path => /url$/i.test(path))).toEqual([])
  })

  it('an address that leads to a picture is shown as one, and stays an address', () => {
    const pictures = declared(settings => settings.format === 'image')
    expect(pictures).toEqual(['AuctionItem.imageUrl', 'Category.imageUrl', 'LoyaltyReward.imageUrl', 'Product.imageUrl', 'SocialPost.imageUrl', 'User.avatar'])
    for (const path of pictures.filter(path => path !== 'User.avatar'))
      expect(['text', 'url'], path).toContain(formField(path).type)
  })

  it('a web address box is only put on a field that already refuses anything else', () => {
    // The box refuses a path such as /about before the form is sent. On a
    // field that may hold one, a record could no longer be saved as it is.
    const addresses = declared(settings => settings.input === 'url')
    expect(addresses).toEqual(['Post.canonicalUrl', 'SocialPost.imageUrl'])
    for (const path of addresses) {
      expect(formField(path).type, path).toBe('url')
      expect(accepts(path, '/a/path/on/this/site'), path).toBe(false)
      expect(accepts(path, 'https://example.com/post'), path).toBe(true)
    }
    // The control: a menu item's address may be a path, and is left a plain box.
    expect(accepts('MenuItem.url', '/about')).toBe(true)
    expect(models.MenuItem.dashboard?.fields?.url).toBeUndefined()
  })

  it('prose has a box with room for it', () => {
    const prose = declared(settings => settings.input === 'longtext')
    expect(prose).toEqual([
      'Author.bio', 'Board.description', 'Card.description', 'CardComment.body', 'Cart.notes', 'Comment.body', 'Comment.content',
      'DeliveryStop.notes', 'EmailList.description', 'LoyaltyReward.description', 'MailPreference.vacationMessage', 'Manufacturer.description',
      'Page.metaDescription', 'Post.content', 'Post.excerpt', 'Post.metaDescription', 'ProductUnit.description', 'Review.content',
      'ShippingMethod.description', 'SocialPost.content', 'Tag.description', 'Team.description', 'WaitlistProduct.notes',
    ])
    for (const path of prose) {
      expect(formField(path).type, path).toBe('longtext')
      // It was one line before, which is why it is said here: the model's own
      // definition does not make it long.
      const { type, validation } = attribute(path)
      expect(type === 'text' || validation?.rule?.name === 'text', path).toBe(false)
    }
  })

  it('nothing is asked for as Markdown yet', () => {
    // A post's body is the one shipped field written in Markdown, and the
    // page the CMS builds from it renders only part of Markdown (no italics,
    // quotes or numbered lists). The editor's preview would show what the
    // published page does not, so the body is a plain long box until the two
    // agree.
    expect(declared(settings => settings.input === 'markdown')).toEqual([])
    expect(formField('Post.content').type).toBe('longtext')
  })
})

describe('the actions the shipped models name', () => {
  const named = Object.entries(models)
    .filter(([, model]) => Array.isArray(model?.dashboard?.actions))
    .map(([name, model]) => ({ name, model, ...modelActionDefinitions(model) }))

  it('there are five, each an action the framework already had', () => {
    expect(named.flatMap(entry => entry.problems)).toEqual([])
    expect(named.flatMap(entry => entry.actions.map(action => `${entry.name}.${action.name} -> ${action.handler}`)).sort()).toEqual([
      'Campaign.cancel -> Actions/Dashboard/Marketing/CampaignCancelAction',
      'Campaign.send -> Actions/Dashboard/Marketing/CampaignSendAction',
      'FailedJob.retry -> Actions/Dashboard/Jobs/JobRetryAction',
      'NotificationDelivery.retry -> Actions/Dashboard/Notifications/NotificationDeliveryRetryAction',
      'User.send-password-reset -> Actions/Dashboard/Users/UserPasswordResetAction',
    ])
    for (const entry of named) {
      for (const action of entry.actions)
        expect(existsSync(`storage/framework/defaults/app/${action.handler}.ts`), action.handler).toBe(true)
    }
  })

  it('each condition names a real field and values that field can hold', () => {
    let checked = 0
    for (const { name, model, actions } of named) {
      for (const action of actions) {
        for (const { column, values } of action.when) {
          // Read as a column; these are all one word, so the attribute's name too.
          const definition = model.attributes[column]
          expect(definition, `${name}.${action.name} when ${column}`).toBeDefined()
          const allowed: unknown[] = definition.validation.rule.allowedValues
          expect(Array.isArray(allowed), `${name}.${column} is one of a few values`).toBe(true)
          for (const value of values) {
            expect(allowed, `${name}.${action.name} when ${column} is ${String(value)}`).toContain(value)
            checked++
          }
        }
      }
    }
    // Campaign's two and NotificationDelivery's one carry conditions.
    expect(checked).toBe(11)
  })

  it('what reaches many people, or cannot be undone, asks first and is kept off the table row', () => {
    const campaign = named.find(entry => entry.name === 'Campaign')!.actions
    for (const action of campaign) {
      expect(action.places, action.name).toEqual(['record'])
      expect(action.confirm, action.name).toBeTruthy()
    }
    expect(campaign.find(action => action.name === 'cancel')!.destructive).toBe(true)
    // Every shipped action asks first: none of them is undone by pressing again.
    for (const entry of named) {
      for (const action of entry.actions)
        expect(action.confirm, `${entry.name}.${action.name}`).toBeTruthy()
    }
  })

  it('each is offered to the records it is for and does what it says, through a real server', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'stacks-shipped-actions-'))
    try {
      const config = join(directory, 'bunfig.toml')
      await writeFile(config, 'preload = []\n')
      const child = Bun.spawn([process.execPath, `--config=${config}`, '--no-env-file', `${import.meta.dir}/fixtures/shipped-model-actions.ts`], {
        env: { ...process.env, APP_ENV: 'test', MAIL_MAILER: 'log', DB_CONNECTION: 'sqlite', DB_DATABASE_PATH: join(directory, 'app.sqlite'), DB_QUERY_LOGGING_ENABLED: 'false' },
        stdout: 'pipe',
        stderr: 'pipe',
      })
      const watchdog = setTimeout(() => child.kill(), 50_000)
      try {
        const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
        expect(code, `${stdout}\n${stderr}`).toBe(0)
        expect(stdout).toContain('shipped model actions OK')
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
