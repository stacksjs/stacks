import { defineStore, state } from '@stacksjs/stx'

const historyKey = 'stacksSettingsIndex'

export const useSettingsWindow = defineStore('dashboard-settings-window', () => {
  const query = state('')
  const index = state(0)
  const lastIndex = state(0)
  let initialized = false

  function syncHistory(): void {
    const saved = history.state?.[historyKey]
    const isEntry = typeof saved === 'number'
    const next = isEntry ? saved : initialized ? index() + 1 : 0
    if (!isEntry)
      history.replaceState({ ...history.state, [historyKey]: next }, '')
    index.set(next)
    lastIndex.set(isEntry ? Math.max(lastIndex(), next) : next)
    initialized = true
  }

  return { query, index, lastIndex, syncHistory }
})
