/**
 * Mail Settings Composable
 *
 * Provides data fetching and persistence for mail configuration.
 */

import { ref } from '@stacksjs/stx'
import { get, put } from '../api'

export interface MailSettings {
  from: string
  to: string
  driver: string
  host: string
  port: number
  username: string
  password: string
}

const defaultSettings: MailSettings = {
  from: '',
  to: '',
  driver: 'SMTP',
  host: '',
  port: 587,
  username: '',
  password: '',
}

export function useMailSettings() {
  const settings = ref<MailSettings>({ ...defaultSettings })
  const isLoading = ref(false)
  const isSaving = ref(false)
  const error = ref<string | null>(null)
  const success = ref<string | null>(null)

  async function fetchSettings() {
    isLoading.value = true
    error.value = null

    try {
      const data = await get<{ data: MailSettings }>('/settings/mail')
      settings.value = data.data || { ...defaultSettings }
    }
    catch (e) {
      console.error('Failed to fetch mail settings:', e)
      // Keep defaults if API not available yet
    }
    finally {
      isLoading.value = false
    }
  }

  async function saveSettings() {
    isSaving.value = true
    error.value = null
    success.value = null

    try {
      await put('/settings/mail', settings.value)
      success.value = 'Mail settings saved successfully.'
    }
    catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to save mail settings.'
    }
    finally {
      isSaving.value = false
    }
  }

  return {
    settings,
    isLoading,
    isSaving,
    error,
    success,
    fetchSettings,
    saveSettings,
  }
}
