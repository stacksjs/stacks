import { describe, expect, test } from 'bun:test'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

/**
 * A component binding is first evaluated on the server, against the names in
 * scope there: the render context's `query` (the request's query-string
 * object), and inside a Modal the Modal's own props, `title` among them (the
 * neighbouring "Modal has for itself" test covers the rest of those). When a
 * client script names a signal the same and binds it bare into a child
 * component (`<Input v-model:value="query" />`), the field starts as that
 * value instead.
 *
 * That is how every dashboard search box came up holding "[object Object]"
 * (`SearchFilter` named its signal `query`), and how the discount dialog
 * opened an existing discount with an empty title. Native elements and
 * Alpine `x-model` are not affected; component bindings are.
 */
const SHADOWED = ['query', 'title'] as const
const root = resolve('storage/framework/defaults/resources/components')

function stxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry)
    if (statSync(path).isDirectory())
      return stxFiles(path)
    return path.endsWith('.stx') ? [path] : []
  })
}

describe('dashboard components and the render context', () => {
  test('no component binding is fed a client signal named like a render-context value', () => {
    const offenders: string[] = []
    for (const file of stxFiles(root)) {
      const source = readFileSync(file, 'utf8')
      const template = source.split('</script>').slice(1).join('</script>')
      for (const name of SHADOWED) {
        // Only a client signal is affected: a prop the component received
        // (`:title="title"` forwarding its own prop) resolves as it should.
        if (!new RegExp(`const ${name} = (?:state|derived)\\(`).test(source))
          continue
        // `<SomeComponent ... v-model:prop="query"` or `:prop="query"`, on a tag
        // that starts with a capital letter (a component, not an element). The
        // call form, `:title="title()"`, fails on the server's string and falls
        // back to the client, so only the bare name picks up the wrong value.
        const pattern = new RegExp(`<[A-Z][\\w]*\\b[^>]*?(?:v-model(?::[\\w-]+)?|:[\\w-]+)="${name}"`, 'g')
        if (pattern.test(template))
          offenders.push(`${relative(root, file)}: ${name}`)
      }
    }
    expect(offenders).toEqual([])
  })
})
