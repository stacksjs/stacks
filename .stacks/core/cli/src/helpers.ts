import { debugLevel } from '@stacksjs/config'
import type { CliOptions, Spinner } from '@stacksjs/types'
import { spinner } from '@stacksjs/cli'
import { italic } from './utilities'

export async function animatedLoading(options?: CliOptions) {
  const debug = debugLevel(options)
  const pleaseWait = 'This may take a little while...'
  let spin = options?.loadingAnimation

  // the spinner is not shown when debug output is being inherited
  if (debug !== 'inherit' && typeof spin === 'object') {
    if (spin.isSpinning && spin.text === 'Running...') {
      setTimeout(() => {
        (spin as Spinner).text = italic(pleaseWait)
      }, 5000)
      return
    }

    // this triggers when options.shortLived === false and options.loadingAnimation === true
    spin = spinner('Running...').start()
    setTimeout(() => {
      (spin as Spinner).text = italic(pleaseWait)
    }, 5000)
  }
}
