import { describe, expect, it } from 'bun:test'
import { join } from 'node:path'
import { renderTemplate } from '@stacksjs/stx'

const VIEW = join(import.meta.dir, '../../../defaults/resources/views/auth/oauth/consent.stx')

async function render(overrides: Record<string, unknown> = {}): Promise<string> {
  return String(await renderTemplate(VIEW, {
    context: {
      consent: {
        requestId: 'r'.repeat(43),
        client: { id: '17', name: 'BugHQ Browser', type: 'public' },
        permissions: [
          { name: 'issues:read', description: 'Read issues and their comments' },
          { name: 'profile:read', description: 'Read your profile' },
        ],
        resources: [
          { name: 'bughq', audience: 'https://api.bughq.example', description: 'Your BugHQ workspace data' },
        ],
      },
      signedInIdentity: 'Ada <admin>',
      selectedWorkspace: 'Acme & Sons',
      consentAction: 'https://id.example.com/oauth/authorize',
      csrfToken: 'csrf-proof',
      ...overrides,
    },
    injectCSS: false,
    templateOnly: true,
    processClientScripts: false,
  }))
}

describe('OAuth consent view', () => {
  it('shows the requesting client, signed-in identity, permissions, resources, and workspace', async () => {
    const html = await render()

    expect(html).toContain('BugHQ Browser')
    expect(html).toContain('Ada &lt;admin&gt;')
    expect(html).toContain('Acme &amp; Sons')
    expect(html).toContain('issues:read')
    expect(html).toContain('Read issues and their comments')
    expect(html).toContain('bughq')
    expect(html).toContain('Your BugHQ workspace data')
  })

  it('submits only middleware proof, the opaque request id, and the decision', async () => {
    const html = await render()

    expect(html).toContain('action="https://id.example.com/oauth/authorize"')
    expect(html).toContain('name="_token" value="csrf-proof"')
    expect(html).toContain(`name="request_id" value="${'r'.repeat(43)}"`)
    expect(html).toMatch(/name="decision"\s+value="approve"/)
    expect(html).toMatch(/name="decision"\s+value="deny"/)
    for (const authority of ['redirect_uri', 'code_challenge', 'subject_id', 'workspace_id'])
      expect(html).not.toContain(`name="${authority}"`)
  })

  it('omits optional workspace and resource sections when none are requested', async () => {
    const html = await render({
      selectedWorkspace: null,
      consent: {
        requestId: 'r'.repeat(43),
        client: { id: '17', name: 'Simple client', type: 'confidential' },
        permissions: [{ name: 'profile:read', description: 'Read your profile' }],
        resources: [],
      },
    })

    expect(html).toContain('Simple client')
    expect(html).not.toContain('Workspace')
    expect(html).not.toContain('Data access')
  })
})
