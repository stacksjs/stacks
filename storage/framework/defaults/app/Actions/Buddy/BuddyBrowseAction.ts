import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'

/**
 * Open a native folder picker dialog (macOS)
 *
 * Uses osascript to display a native folder selection dialog
 * and returns the selected path.
 */
export default new Action({
  name: 'BuddyBrowseAction',
  description: 'Open folder picker dialog',
  method: 'POST',
  async handle(_request: RequestInstance) {
    try {
      const { $ } = await import('bun')

      // Use osascript to open native folder picker on macOS
      const script = `osascript -e 'POSIX path of (choose folder with prompt "Select project folder")'`
      const result = await $`sh -c ${script}`.quiet()
      const selectedPath = result.text().trim().replace(/\/$/, '') // Remove trailing slash

      if (selectedPath) {
        return response.json({ path: selectedPath })
      }

      return response.json({ error: 'No folder selected' })
    }
    catch (error) {
      // User cancelled the dialog
      return response.json({ error: 'Folder selection cancelled' })
    }
  },
})
