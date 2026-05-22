/**
 * Spawned by `./buddy dev` to start the rpx HTTPS daemon.
 * Avoids the published `dist/bin/cli.js` duplicate-shebang issue on Bun 1.3.x.
 */
import { runDaemon } from '@stacksjs/rpx'

const handle = await runDaemon({ verbose: process.env.RPX_VERBOSE === '1' })
await handle.done
