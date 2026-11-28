import { defineStore, derived, reactive, state, useSessionStorage } from '@stacksjs/stx'
import { dashboardApi } from '@stacksjs/defaults/functions/dashboard-api'

import type { ProjectConfigFile, ProjectConfigSection } from '@stacksjs/defaults/resources/functions/dashboard/project-config-sections'
import { configFileLabel, projectConfigSection, sectionForConfig } from '@stacksjs/defaults/resources/functions/dashboard/project-config-sections'

export const useProjectConfigInventory = defineStore('dashboard-project-config-inventory', () => {
  const files = state<ProjectConfigFile[]>([])
  const loading = state(true)
  const error = state('')
  let request: Promise<void> | undefined

  function load(): Promise<void> {
    request ??= (async () => {
      loading.set(true)
      error.set('')
      try {
        const body = await dashboardApi<{ files: ProjectConfigFile[] }>('/api/config/list', { projectConfig: true })
        files.set(body.files.map(file => ({ ...file, title: configFileLabel(file.name) })))
      }
      catch (cause) {
        error.set(cause instanceof Error ? cause.message : 'Unable to load configuration')
        request = undefined
      }
      finally {
        loading.set(false)
      }
    })()
    return request
  }

  return { files, loading, error, load }
})

export interface ConfigField {
  key: string
  value: string | number | boolean | null
  type: 'string' | 'number' | 'boolean' | 'null'
  path: Array<string | number>
  description?: string
}

interface ConfigDocument {
  fields: ConfigField[]
  source: string
  revision: string
  diagnostic?: string
}

export type EditorMode = 'fields' | 'source'

function createProjectConfigEditor(section: ProjectConfigSection) {
  return defineStore(`dashboard-project-config-${section}`, () => {
    const inventory = useProjectConfigInventory
    const order: readonly string[] = projectConfigSection(section)?.files ?? []
    const files = derived(() => inventory.files().filter(file => sectionForConfig(file.name) === section)
      .sort((left, right) => order.indexOf(left.name) - order.indexOf(right.name)))
    const current = state<ConfigDocument | null>(null)
    const drafts = reactive<Record<string, ConfigField['value']>>(Object.create(null))
    const sourceDraft = state('')
    const selected = state('')
    const mode = state<EditorMode>('fields')
    const loading = state(true)
    const saving = state(false)
    const message = state('')
    const error = state('')

    const selection = useSessionStorage<{ file: string, mode: EditorMode }>(`stacks-dashboard-config-selection:${section}`, { file: '', mode: 'fields' })
    const saved = useSessionStorage<{ file: string, revision: string } | null>(`stacks-dashboard-config-saved:${section}`, null)
    const pending = new Map<string, {
      document: ConfigDocument
      source: string
      values: Array<[string, ConfigField['value']]>
      mode: EditorMode
    }>()
    let generation = 0

    function setMode(next: EditorMode): void {
      mode.set(next)
      if (selected())
        selection.set({ file: selected(), mode: next })
    }

    function savedMessage(file: string): string {
      return `Saved config/${file}.ts. Restart any other running services that use this file.`
    }

    function draftValue(field: ConfigField): ConfigField['value'] {
      const value = drafts[field.key]
      if (field.type === 'number' && typeof value === 'string')
        return value.trim() ? Number(value) : NaN
      return value
    }

    const changedFields = derived(() => (current()?.fields ?? []).filter(field => !Object.is(draftValue(field), field.value)))
    const isDirty = derived(() => mode() === 'source' ? sourceDraft() !== current()?.source : changedFields().length > 0)

    function setDocument(result: ConfigDocument): void {
      for (const key of Object.keys(drafts))
        delete drafts[key]
      for (const field of result.fields)
        drafts[field.key] = field.value
      sourceDraft.set(result.source)
      current.set(result)
    }

    async function initialize(requested?: string): Promise<void> {
      await inventory.load()
      if (inventory.error()) {
        error.set(inventory.error())
        loading.set(false)
        return
      }
      const previous = selection()
      const first = files().find(file => file.name === requested)
        ?? files().find(file => file.name === (selected() || previous.file))
        ?? files()[0]
      if (first)
        await selectFile(first.name, { mode: first.name === previous.file ? previous.mode : undefined })
      else
        loading.set(false)
    }

    async function selectFile(name: string, options?: { mode?: EditorMode, reload?: boolean }): Promise<void> {
      if (saving() || (!options?.reload && selected() === name && (current() || loading())))
        return

      const loaded = current()
      const previous = selected()
      if (options?.reload)
        pending.delete(name)
      else if (loaded && previous && isDirty()) {
        pending.set(previous, {
          document: loaded,
          source: sourceDraft(),
          values: changedFields().map(({ key }) => [key, drafts[key]]),
          mode: mode(),
        })
      }

      const request = ++generation
      const draft = pending.get(name)
      selected.set(name)
      current.set(null)
      message.set('')
      error.set('')
      loading.set(true)
      try {
        const result = draft?.document ?? await dashboardApi<ConfigDocument>(`/api/config/read?name=${encodeURIComponent(name)}`, { projectConfig: true })
        if (request !== generation)
          return
        pending.delete(name)
        setDocument(result)
        if (draft) {
          for (const [key, value] of draft.values)
            drafts[key] = value
          sourceDraft.set(draft.source)
        }
        setMode(draft?.mode ?? options?.mode ?? (name === 'dns' || result.fields.length ? 'fields' : 'source'))
        const confirmation = saved()
        if (!draft && confirmation?.file === name && confirmation.revision === result.revision)
          message.set(savedMessage(name))
      }
      catch (cause) {
        if (request === generation)
          error.set(cause instanceof Error ? cause.message : 'Unable to read configuration')
      }
      finally {
        if (request === generation)
          loading.set(false)
      }
    }

    async function save(): Promise<void> {
      const loaded = current()
      const file = selected()
      if (!loaded || loading() || saving() || !isDirty())
        return

      const updates = changedFields().map(field => ({ key: field.key, type: field.type, value: draftValue(field) }))
      if (mode() === 'fields' && updates.some(field => field.type === 'number' && !Number.isFinite(field.value))) {
        error.set('Enter a valid number in each number field.')
        return
      }

      message.set('')
      error.set('')
      saving.set(true)
      try {
        const result = await dashboardApi<ConfigDocument>('/api/config/update', {
          method: 'POST',
          projectConfig: true,
          body: {
            file,
            revision: loaded.revision,
            ...(mode() === 'source' ? { source: sourceDraft() } : { updates: updates.map(({ key, value }) => ({ key, value })) }),
          },
        })
        setDocument(result)
        saved.set({ file, revision: result.revision })
        message.set(savedMessage(file))
      }
      catch (cause) {
        error.set(cause instanceof Error ? cause.message : 'Unable to save configuration')
      }
      finally {
        saving.set(false)
      }
    }

    function hasUnsavedChanges(): boolean {
      return pending.size > 0 || Boolean(current() && isDirty())
    }

    return { files, current, drafts, sourceDraft, selected, mode, setMode, loading, saving, message, error, isDirty, setDocument, selectFile, save, initialize, hasUnsavedChanges }
  })
}

const editors = new Map<ProjectConfigSection, ReturnType<typeof createProjectConfigEditor>>()

export function projectConfigEditor(section: ProjectConfigSection): ReturnType<typeof createProjectConfigEditor> {
  let editor = editors.get(section)
  if (!editor) {
    editor = createProjectConfigEditor(section)
    editors.set(section, editor)
  }
  return editor
}

export function hasUnsavedProjectConfig(): boolean {
  return [...editors.values()].some(editor => editor.hasUnsavedChanges())
}

export function requestedProjectConfigFile(): string | undefined {
  return new URLSearchParams(location.search).get('file') ?? undefined
}

export function rememberProjectConfigFile(file: string): void {
  const url = new URL(location.href)
  if (url.searchParams.get('file') !== file) {
    url.searchParams.set('file', file)
    history.replaceState(history.state, '', url)
  }
}
