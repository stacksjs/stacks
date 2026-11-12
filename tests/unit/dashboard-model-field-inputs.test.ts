import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { schema } from '@stacksjs/validation'
import { modelActionDefinitions } from '../../storage/framework/defaults/app/Actions/Dashboard/Models/model-actions'
import { acceptsOnlyImages, modelFieldOverrides } from '../../storage/framework/defaults/app/Actions/Dashboard/Models/model-fields'
import { describeAccept, uploadAccepts, uploadDirectory, uploadedType } from '../../storage/framework/defaults/app/Actions/Dashboard/Models/model-upload'
import { modelCreateFields } from '../../storage/framework/defaults/app/Actions/Dashboard/Models/model-write'
import { applyMarkdown, MARKDOWN_MARKS, MARKDOWN_PREVIEW_POLICY, markdownPreviewDocument } from '../../storage/framework/defaults/functions/dashboard-markdown'
import { modelFileName, modelFileIsImage } from '../../storage/framework/defaults/functions/dashboard-model-record'

/**
 * A field asked for as an uploaded file, and one asked for as Markdown
 * (stacksjs/stacks#3275).
 *
 * A field that holds a file's address was asked for as text, so the file had
 * to be put somewhere first and its address pasted. A field of formatted
 * prose was a plain box. Both are inputs a model can now ask for.
 */
const PNG = Uint8Array.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0])
const JPEG = Uint8Array.from([0xFF, 0xD8, 0xFF, 0xE0, 0, 0, 0, 0])
const PDF = new TextEncoder().encode('%PDF-1.7\n....')
const TEXT = new TextEncoder().encode('name,email\nAva,ava@example.com')

describe('uploads and Markdown, through a real server and a real disk', () => {
  it('store a chosen file, answer its address, and render a sanitized preview', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'stacks-field-inputs-'))
    try {
      const config = join(directory, 'bunfig.toml')
      await writeFile(config, 'preload = []\n')
      const child = Bun.spawn([process.execPath, `--config=${config}`, '--no-env-file', `${import.meta.dir}/fixtures/model-field-inputs.ts`], {
        // Every file lands under the temporary directory, never in the checkout.
        env: { ...process.env, APP_ENV: 'test', MAIL_MAILER: 'log', DB_CONNECTION: 'sqlite', DB_DATABASE_PATH: join(directory, 'users.sqlite'), DB_QUERY_LOGGING_ENABLED: 'false', STORAGE_ROOT: join(directory, 'disk'), STORAGE_DRIVER: 'local' },
        stdout: 'pipe',
        stderr: 'pipe',
      })
      const watchdog = setTimeout(() => child.kill(), 50_000)
      try {
        const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
        expect(code, `${stdout}\n${stderr}`).toBe(0)
        expect(stdout).toContain('field inputs OK')
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

describe('asking for a field as a file or as Markdown', () => {
  const Member = (fields: Record<string, unknown>) => ({
    name: 'Member',
    attributes: {
      avatar: { fillable: true, validation: { rule: schema.string() } },
      contract: { fillable: true, validation: { rule: schema.string() } },
      bio: { fillable: true, validation: { rule: schema.string() } },
      age: { fillable: true, validation: { rule: schema.number() } },
    },
    dashboard: { fields },
  })

  it('the form is told the input, and what an upload accepts', () => {
    const fields = Object.fromEntries(modelCreateFields(Member({
      avatar: { input: 'upload', accept: ' image/* ' },
      contract: { input: 'upload', accept: 'application/pdf, .docx' },
      bio: { input: 'markdown' },
    })).map(field => [field.name, field]))
    expect(fields.avatar).toMatchObject({ type: 'upload', accept: 'image/*' })
    expect(fields.contract).toMatchObject({ type: 'upload', accept: 'application/pdf,.docx' })
    expect(fields.bio).toMatchObject({ type: 'markdown' })
    expect('accept' in fields.bio!).toBe(false)
  })

  it('an upload is shown as what it is without being told: a picture, or a link', () => {
    const { fields } = modelFieldOverrides(Member({
      avatar: { input: 'upload', accept: 'image/*' },
      contract: { input: 'upload', accept: 'application/pdf' },
      bio: { input: 'upload' },
      age: { input: 'upload', accept: '.png,.jpg', format: 'text' },
    }))
    expect(fields.avatar?.display).toEqual({ format: 'image' })
    expect(fields.contract?.display).toEqual({ format: 'link' })
    // Any file at all: somewhere to go, not something to draw.
    expect(fields.bio?.display).toEqual({ format: 'link' })
    // What the model says comes first.
    expect(fields.age?.display).toEqual({ format: 'text' })
    expect(acceptsOnlyImages('image/png, .webp')).toBe(true)
    expect(acceptsOnlyImages('image/*,application/pdf')).toBe(false)
    expect(acceptsOnlyImages(undefined)).toBe(false)
  })

  it('only a field of text can be asked for either way', () => {
    const fields = Object.fromEntries(modelCreateFields(Member({ age: { input: 'upload' } })).map(field => [field.name, field.type]))
    expect(fields.age).toBe('number')
  })

  it('an `accept` that cannot be read, or has no upload to belong to, is said', () => {
    const { fields, problems } = modelFieldOverrides(Member({
      avatar: { input: 'upload', accept: 'pictures' },
      contract: { input: 'upload', accept: 7 },
      bio: { input: 'markdown', accept: 'image/*' },
    }))
    expect(fields.avatar).toMatchObject({ input: 'upload' })
    expect(fields.avatar?.accept).toBeUndefined()
    expect(problems).toEqual([
      '\'avatar\' names the files it accepts in a way that cannot be read: a list such as \'image/*\' or \'application/pdf,.csv\'',
      '\'contract\' names the files it accepts in a way that cannot be read: a list such as \'image/*\' or \'application/pdf,.csv\'',
      '\'bio\' names the files it accepts, which only `input: \'upload\'` reads',
    ])
  })

  it('an action\'s input can be Markdown, and never a file', () => {
    const declared = modelActionDefinitions({ dashboard: { actions: [{ name: 'note', action: 'Actions/Notes/AddNoteAction', fields: { body: { input: 'markdown' }, file: { input: 'upload' } } }] } })
    expect(declared.actions[0]?.asking).toEqual({ body: { input: 'markdown' }, file: {} })
    expect(declared.problems).toEqual(['\'note\' field \'file\' asks for an input the dashboard does not have: \'upload\' (it has email, longtext, markdown, text, url)'])
  })
})

describe('what a chosen file has to be', () => {
  it('a file is what its bytes say, whatever it was sent as', () => {
    expect(uploadedType({ type: 'application/octet-stream', bytes: PNG })).toBe('image/png')
    expect(uploadedType({ type: 'image/png', bytes: JPEG })).toBe('image/jpeg')
    expect(uploadedType({ type: 'text/plain', bytes: PDF })).toBe('application/pdf')
    // Sent as an image, with no image's bytes: not taken to be one.
    expect(uploadedType({ type: 'image/png', bytes: TEXT })).toBe('')
    // Text has no signature: its type is the sender's word, which is all there is.
    expect(uploadedType({ type: 'text/csv; charset=utf-8', bytes: TEXT })).toBe('text/csv')
    expect(uploadedType({ type: 'image/svg+xml', bytes: TEXT })).toBe('image/svg+xml')
  })

  it('a family takes what is of it, by its bytes', () => {
    expect(uploadAccepts('image/*', { type: 'image/png', name: 'a.png', bytes: PNG })).toBe(true)
    expect(uploadAccepts('image/*', { type: 'application/octet-stream', name: 'scan', bytes: JPEG })).toBe(true)
    // An image by name and by label only.
    expect(uploadAccepts('image/*', { type: 'image/png', name: 'photo.png', bytes: TEXT })).toBe(false)
    expect(uploadAccepts('image/*', { type: 'application/pdf', name: 'a.pdf', bytes: PDF })).toBe(false)
    // An SVG can carry script: taken only where it is named.
    expect(uploadAccepts('image/*', { type: 'image/svg+xml', name: 'logo.svg', bytes: TEXT })).toBe(false)
    expect(uploadAccepts('image/svg+xml', { type: 'image/svg+xml', name: 'logo.svg', bytes: TEXT })).toBe(true)
  })

  it('a type is that type, and an image\'s extension is its type', () => {
    expect(uploadAccepts('application/pdf', { type: 'application/pdf', name: 'a.pdf', bytes: PDF })).toBe(true)
    expect(uploadAccepts('application/pdf', { type: 'application/pdf', name: 'a.pdf', bytes: PNG })).toBe(false)
    expect(uploadAccepts('.png,.jpg', { type: 'image/png', name: 'a.png', bytes: PNG })).toBe(true)
    expect(uploadAccepts('.png', { type: 'image/png', name: 'a.png', bytes: JPEG })).toBe(false)
    expect(uploadAccepts('.png', { type: 'image/png', name: 'a.png', bytes: TEXT })).toBe(false)
  })

  it('any other extension is the name\'s to say, unless the bytes are an image after all', () => {
    expect(uploadAccepts('.csv', { type: 'text/csv', name: 'People.CSV', bytes: TEXT })).toBe(true)
    expect(uploadAccepts('.csv', { type: 'text/csv', name: 'people.txt', bytes: TEXT })).toBe(false)
    expect(uploadAccepts('.csv', { type: 'text/csv', name: 'people.csv', bytes: PNG })).toBe(false)
    expect(uploadAccepts('application/pdf,.csv', { type: 'text/csv', name: 'people.csv', bytes: TEXT })).toBe(true)
  })

  it('with nothing named, any file is one', () => {
    for (const accept of [undefined, '', ' , '])
      expect(uploadAccepts(accept, { type: 'text/html', name: 'x.html', bytes: TEXT })).toBe(true)
  })

  it('a refusal names what the field takes, and files are kept by table and column', () => {
    expect(describeAccept('image/*')).toBe('an image')
    expect(describeAccept('application/pdf, .csv')).toBe('one of: application/pdf, .csv')
    expect(uploadDirectory('users', 'avatar')).toBe('uploads/users/avatar')
    expect(uploadDirectory('Order Lines', 'image_url')).toBe('uploads/order-lines/image_url')
    // Never out of its own folder.
    expect(uploadDirectory('../../etc', '..')).toBe('uploads/etc/file')
  })
})

describe('what a Markdown toolbar button does', () => {
  const press = (mark: Parameters<typeof applyMarkdown>[0], text: string, start: number, end = start) => {
    const edit = applyMarkdown(mark, text, start, end)
    return [edit.text, edit.text.slice(edit.start, edit.end)]
  }

  it('wraps what is selected, and keeps it selected', () => {
    expect(press('bold', 'Hello world', 6, 11)).toEqual(['Hello **world**', 'world'])
    expect(press('italic', 'Hello world', 0, 5)).toEqual(['*Hello* world', 'Hello'])
    expect(press('code', 'run buddy dev now', 4, 13)).toEqual(['run `buddy dev` now', 'buddy dev'])
  })

  it('with nothing selected, puts in words to type over', () => {
    expect(press('bold', 'Hello ', 6)).toEqual(['Hello **bold text**', 'bold text'])
    expect(press('italic', '', 0)).toEqual(['*italic text*', 'italic text'])
  })

  it('pressed again, takes the mark off', () => {
    // The marks inside the selection, and just outside it.
    expect(press('bold', 'Hello **world**', 6, 15)).toEqual(['Hello world', 'world'])
    expect(press('bold', 'Hello **world**', 8, 13)).toEqual(['Hello world', 'world'])
    expect(press('code', '`x`', 0, 3)).toEqual(['x', 'x'])
  })

  it('a link takes the selection as its words and selects the address to replace', () => {
    expect(press('link', 'See the docs here', 8, 12)).toEqual(['See the [docs](https://) here', 'https://'])
    expect(press('link', '', 0)).toEqual(['[link text](https://)', 'https://'])
  })

  it('a line mark goes in front of every line the selection touches', () => {
    expect(press('bullets', 'intro\nfirst\nsecond\noutro', 8, 15)).toEqual(['intro\n- first\n- second\noutro', '- first\n- second'])
    expect(press('numbers', 'first\nsecond\nthird', 0, 18)).toEqual(['1. first\n2. second\n3. third', '1. first\n2. second\n3. third'])
    expect(press('quote', 'said so', 3)).toEqual(['> said so', '> said so'])
    expect(press('heading', 'intro\nTitle', 8)).toEqual(['intro\n## Title', '## Title'])
  })

  it('pressed again takes it off, and another line mark replaces it', () => {
    expect(press('bullets', '- first\n- second', 0, 16)).toEqual(['first\nsecond', 'first\nsecond'])
    expect(press('numbers', '- first\n- second', 0, 16)).toEqual(['1. first\n2. second', '1. first\n2. second'])
    expect(press('heading', '> Title', 0)).toEqual(['## Title', '## Title'])
  })

  it('a selection out of range is brought back into the text', () => {
    expect(press('bold', 'Hi', 10, 20)).toEqual(['Hi**bold text**', 'bold text'])
    expect(press('bold', 'Hello world', 11, 6)).toEqual(['Hello **world**', 'world'])
  })

  it('every button has a name and an icon', () => {
    expect(MARKDOWN_MARKS.map(item => item.label)).toEqual(['Bold', 'Italic', 'Heading', 'Link', 'Bulleted list', 'Numbered list', 'Quote', 'Code'])
    expect(MARKDOWN_MARKS.every(item => /^i-hugeicons-[\w-]+$/.test(item.icon))).toBe(true)
  })
})

describe('the preview', () => {
  it('is a document that can run nothing, in the dashboard\'s light or dark', () => {
    const light = markdownPreviewDocument('<p>Hello</p>', false)
    const dark = markdownPreviewDocument('<p>Hello</p>', true)
    expect(light).toContain(`<meta http-equiv="Content-Security-Policy" content="${MARKDOWN_PREVIEW_POLICY}">`)
    expect(MARKDOWN_PREVIEW_POLICY).toContain('default-src \'none\'')
    expect(MARKDOWN_PREVIEW_POLICY).not.toContain('script-src')
    expect(light).toContain('<body><p>Hello</p></body>')
    expect(light).toContain('color-scheme:light')
    expect(dark).toContain('color-scheme:dark')
    expect(light).not.toBe(dark)
  })
})

describe('what an upload field shows', () => {
  it('a picture when the address is one, and the file\'s name', () => {
    for (const address of ['/uploads/users/avatar/a1b2.png', 'https://cdn.example.com/x/Photo.JPEG?v=2', '/a/b.webp#top'])
      expect(modelFileIsImage(address)).toBe(true)
    for (const address of ['/uploads/contracts/a1b2.pdf', '/uploads/png/readme', ''])
      expect(modelFileIsImage(address)).toBe(false)
    expect(modelFileName('https://cdn.example.com/uploads/users/avatar/a1b2.png?v=2')).toBe('a1b2.png')
    expect(modelFileName('/uploads/My%20File.pdf')).toBe('My File.pdf')
    // Not percent-encoding after all: the name as written.
    expect(modelFileName('/uploads/100%.pdf')).toBe('100%.pdf')
  })
})

// Driven in a browser against the running dashboard; these pin what that run
// relied on.
describe('the form', () => {
  const components = 'storage/framework/defaults/resources/components/Dashboard/Models'
  const read = (file: string) => readFileSync(`${components}/${file}`, 'utf8')

  it('draws each field in the input it is asked for, and tells an upload which model it is for', () => {
    const inputs = read('ModelFieldInputs.stx')
    expect(inputs).toContain(':if="field.type === \'upload\'"')
    expect(inputs).toContain(':if="field.type === \'markdown\'"')
    expect(inputs).toContain(':slug="slug()"')
    expect(inputs).toContain(':accept="field.accept || \'\'"')
    // Neither is also drawn as a plain line.
    expect(inputs).toContain('return ![\'boolean\', \'enum\', \'json\', \'longtext\', \'markdown\', \'relation\', \'upload\'].includes(field.type)')
    for (const page of ['ModelRecordCreate.stx', 'ModelRecordEdit.stx'])
      expect(read(page)).toContain(':slug="slug()"')
    const binding = read('ModelRelatedPanels.stx').match(/<ModelFieldInputs\b[^>]*\s:slug="([^"]+)"/)?.[1]
    if (!binding)
      throw new Error('The related form must tell its field inputs which model uploads belong to')
    const uploadSlug = new Function('editor', `return (${binding})`)
    expect(uploadSlug(() => null)).toBe('')
    expect(uploadSlug(() => ({ id: null, panel: { slug: 'member' } }))).toBe('member')
    expect(uploadSlug(() => ({ id: 7, panel: { slug: 'invitation' } }))).toBe('invitation')
    // A binding reads one editor snapshot, including while the editor closes.
    let current: { panel: { slug: string } } | null = { panel: { slug: 'member' } }
    expect(uploadSlug(() => {
      const snapshot = current
      current = null
      return snapshot
    })).toBe('member')
  })

  it('an upload stores the file at once and holds its address', () => {
    const upload = read('ModelUploadInput.stx')
    expect(upload).toContain('const stored = await uploadModelFile(slug(), name(), file)')
    expect(upload).toContain('emit(\'update:value\', stored.url)')
    expect(upload).toContain(':accept="accept() || null"')
    const client = readFileSync('storage/framework/defaults/functions/dashboard-model-record.ts', 'utf8')
    expect(client).toContain('dashboardApi<{ url?: string }>(`${modelPath(slug)}/uploads`, { method: \'POST\', formData })')
  })

  it('the Markdown preview is shown in a frame that runs no script', () => {
    const editor = read('ModelMarkdownInput.stx')
    expect(editor).toContain('const edit = applyMarkdown(mark, box.value, box.selectionStart, box.selectionEnd)')
    expect(editor).toContain(':srcdoc="frame()"')
    expect(editor).toContain('sandbox=""')
    expect(editor).toContain(':csp="MARKDOWN_PREVIEW_POLICY"')
    // Never bound into the page itself.
    expect(editor).not.toMatch(/x-html|v-html|innerHTML/)
  })

  it('both endpoints are guarded like every other dashboard write', () => {
    const routes = readFileSync('storage/framework/defaults/routes/dashboard-api.ts', 'utf8')
    expect(routes).toContain('guard(route.post(\'/models/{slug}/uploads\', \'Actions/Dashboard/Models/ModelUploadAction\'))')
    expect(routes).toContain('guard(route.post(\'/markdown\', \'Actions/Dashboard/Models/ModelMarkdownAction\'))')
  })
})
