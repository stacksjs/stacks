import { defineStore, state } from '@stacksjs/stx'
import { settingsPanePath } from '@stacksjs/defaults/resources/functions/dashboard/settings-panes'

const historyKey = 'stacksSettingsIndex'

export const useSettingsWindow = defineStore('dashboard-settings-window', () => {
  const query = state('')
  const activePath = state(settingsPanePath(typeof location === 'undefined' ? '/settings' : location.pathname))
  const browserNavOpen = state(false)
  const index = state(0)
  const lastIndex = state(0)
  let initialized = false
  let listening = false

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

  // The routed pane changes its STX setup on navigation. This listener
  // belongs to the settings window, so its chrome survives those swaps.
  function listen(): void {
    if (listening)
      return
    listening = true
    syncHistory()
    window.addEventListener('stx:navigate', (event) => {
      const href = (event as CustomEvent<{ url?: string }>).detail?.url ?? location.href
      const next = settingsPanePath(new URL(href, location.href).pathname)
      if (next !== activePath())
        browserNavOpen.set(false)
      activePath.set(next)
    })
    window.addEventListener('stx:load', syncHistory)
    window.addEventListener('popstate', syncHistory)
  }

  return { query, activePath, browserNavOpen, index, lastIndex, listen }
})
