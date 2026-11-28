import { isAvailable, showMessageBox } from '@stacksjs/desktop/browser'

/** Ask Craft for a platform alert. Null lets the caller open its accessible web dialog. */
export async function confirmSettingsDiscard(message: string, description: string, action: string): Promise<boolean | null> {
  if (!isAvailable('dialog'))
    return null

  try {
    const result = await showMessageBox({
      type: 'warning',
      message,
      detail: description,
      buttons: ['Cancel', action],
      defaultButton: 0,
      cancelButton: 0,
    })
    return result.response === 1
  }
  catch {
    return null
  }
}
