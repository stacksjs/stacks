/**
 * Stacks Dashboard - Native Desktop Application
 *
 * This file launches the Stacks Dashboard as a native desktop app using Craft.
 * Run with: bun run craft.ts
 */
import { loadURL } from 'ts-craft'

const DEV_URL = 'http://localhost:5173'
const PROD_URL = './dist/index.html'

const isDev = process.env.NODE_ENV !== 'production'

async function launchDashboard() {
  const url = isDev ? DEV_URL : PROD_URL

  await loadURL(url, {
    title: 'Stacks Dashboard',
    width: 1400,
    height: 900,
    resizable: true,
    fullscreen: false,
    darkMode: true,
    hotReload: isDev,
    devTools: isDev,
  })
}

launchDashboard().catch(console.error)
