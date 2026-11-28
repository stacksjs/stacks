import { defineStore, derived, reactive, state, useSessionStorage } from '@stacksjs/stx'
import { dashboardApi } from '@stacksjs/defaults/functions/dashboard-api'

interface ConfigFile {
  name: string
  title: string
}

export interface ConfigField {
  key: string
  value: string | number | boolean | null
  type: 'string' | 'number' | 'boolean' | 'null'
}

interface ConfigDocument {
  fields: ConfigField[]
  source: string
  revision: string
  diagnostic?: string
}

export type EditorMode = 'fields' | 'source'

export const useProjectConfigEditor = defineStore('dashboard-project-config', () => {
  const files = state<ConfigFile[]>([])
  const current = state<ConfigDocument | null>(null)
  const drafts = reactive<Record<string, ConfigField['value']>>(Object.create(null))
  const sourceDraft = state('')
  const selected = state('')
  const mode = state<EditorMode>('fields')
  const loading = state(true)
  const saving = state(false)
  const message = state('')
  const error = state('')

  const selection = useSessionStorage<{ file: string, mode: EditorMode }>('stacks-dashboard-config-selection', { file: '', mode: 'fields' })
  const saved = useSessionStorage<{ file: string, revision: string } | null>('stacks-dashboard-config-saved', null)
  let listed = false

  function setMode(next: EditorMode): void {
    mode.set(next)
    if (selected())
      selection.set({ file: selected(), mode: next })
  }

  function savedMessage(file: string): string {
    return `Saved config/${file}.ts. Restart any other running services that use this file.`
  }

  const changedFields = derived(() => (current()?.fields ?? []).filter(field => !Object.is(drafts[field.key], field.value)))
  const isDirty = derived(() => mode() === 'source' ? sourceDraft() !== current()?.source : changedFields().length > 0)

  function setDocument(result: ConfigDocument): void {
    for (const key of Object.keys(drafts))
      delete drafts[key]
    for (const field of result.fields)
      drafts[field.key] = field.value
    sourceDraft.set(result.source)
    current.set(result)
  }

  async function loadFiles(): Promise<void> {
    loading.set(true)
    error.set('')
    try {
      const body = await dashboardApi<{ files: ConfigFile[] }>('/api/config/list', { projectConfig: true })
      files.set(body.files)
      const previous = selection()
      const first = body.files.find(file => file.name === previous.file)
        ?? body.files.find(file => file.name === 'app')
        ?? body.files[0]
      if (first)
        await selectFile(first.name, first.name === previous.file ? previous.mode : undefined)
    }
    catch (cause) {
      error.set(cause instanceof Error ? cause.message : 'Unable to load configuration')
    }
    finally {
      loading.set(false)
    }
  }

  async function selectFile(name: string, preferredMode?: EditorMode): Promise<void> {
    selected.set(name)
    current.set(null)
    message.set('')
    error.set('')
    loading.set(true)
    try {
      const result = await dashboardApi<ConfigDocument>(`/api/config/read?name=${encodeURIComponent(name)}`, { projectConfig: true })
      setDocument(result)
      setMode(preferredMode ?? (result.fields.length ? 'fields' : 'source'))
      const confirmation = saved()
      if (confirmation?.file === name && confirmation.revision === result.revision)
        message.set(savedMessage(name))
    }
    catch (cause) {
      error.set(cause instanceof Error ? cause.message : 'Unable to read configuration')
    }
    finally {
      loading.set(false)
    }
  }

  async function save(): Promise<void> {
    const loaded = current()
    const file = selected()
    if (!loaded || loading() || saving() || !isDirty())
      return

    const changed = changedFields()
    if (mode() === 'fields' && changed.some(field => field.type === 'number' && !Number.isFinite(drafts[field.key]))) {
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
          ...(mode() === 'source' ? { source: sourceDraft() } : { updates: changed.map(({ key }) => ({ key, value: drafts[key] })) }),
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

  function initialize(): void {
    if (listed)
      return
    listed = true
    void loadFiles()
  }

  return { files, current, drafts, sourceDraft, selected, mode, setMode, loading, saving, message, error, isDirty, setDocument, loadFiles, selectFile, save, initialize }
})
