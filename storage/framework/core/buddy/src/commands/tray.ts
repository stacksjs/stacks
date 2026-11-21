import type { CLI } from '@stacksjs/types'
import { reportFailure } from '../result'

export function tray(buddy: CLI): void {
  buddy
    .command('tray', 'Open the Buddy menu-bar app for your Stacks projects')
    .action(async () => {
      try {
        const { runTray } = await import('../tray/run')
        await runTray()
      }
      catch (error) {
        reportFailure({ error })
      }
    })
}
