import { type BunPlugin as Plugin, plugin } from 'bun'

/**
 * Test Preloader
 *
 * This plugin is triggered before each test is run. You may use this file
 * to preload/define plugins that will automatically be injected
 * into the Bun process before tests are run.
 */

const customPlugin: Plugin = {
  name: 'Custom loader',
  setup() {
    console.log('Custom loader, triggered before tests run')
  },
}

plugin(customPlugin)
