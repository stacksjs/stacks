interface TrayMenuItem {
  label?: string
  type?: 'normal' | 'separator' | 'submenu'
  action?: string
  submenu?: TrayMenuItem[]
}

interface CraftTrayBridge {
  setTitle(title: string): Promise<void>
  setTooltip(tooltip: string): Promise<void>
  setMenu(items: TrayMenuItem[]): Promise<void>
  onClickToggleWindow(): () => void
}

interface CraftBridge {
  tray?: CraftTrayBridge
}

type TrayActionHandler = (action: string) => void | Promise<void>

function bridge(): CraftBridge | undefined {
  return (globalThis as typeof globalThis & { craft?: CraftBridge }).craft
}

export function buildTrayMenu(projects: string[]): TrayMenuItem[] {
  const projectItems = projects.map((project) => {
    const name = project.split('/').filter(Boolean).pop() || project
    return {
      label: name,
      type: 'submenu' as const,
      submenu: [
        { label: 'Open Terminal', action: `open-terminal::${project}` },
        { label: 'Copy IP Address', action: `copy-ip::${project}` },
        { label: 'Open Dashboard', action: `open-dashboard::${project}` },
        { label: 'Buddy Commands', action: `buddy-commands::${project}` },
        { label: 'Deploy', action: `deploy::${project}` },
        { type: 'separator' as const },
        { label: 'Deploy Logs', action: `deploy-logs::${project}` },
        { label: 'Site Logs', action: `site-logs::${project}` },
        { label: 'Error Logs', action: `error-logs::${project}` },
        { type: 'separator' as const },
        { label: 'Edit .env', action: `edit-env::${project}` },
        { label: 'Edit DNS', action: `edit-dns::${project}` },
        { label: 'Edit Email Addresses', action: `edit-email::${project}` },
        { label: 'Ask Buddy', action: `ask-buddy::${project}` },
      ],
    }
  })

  return [
    { label: 'Refresh', action: 'refresh' },
    { label: 'Open Terminal', action: 'open-terminal' },
    { label: 'Environment Check', action: 'env-check' },
    { label: 'Settings', action: 'settings' },
    { label: 'Check for Updates', action: 'check-updates' },
    { type: 'separator' },
    { label: 'Projects', type: 'submenu', submenu: projectItems },
    { type: 'separator' },
    { label: 'Quit', action: 'quit' },
  ]
}

export async function installTrayMenu(projects: string[], onAction: TrayActionHandler): Promise<() => void> {
  const craft = bridge()
  if (!craft?.tray)
    return () => {}

  await craft.tray.setTitle('Stacks')
  await craft.tray.setTooltip('Stacks project shortcuts')
  await craft.tray.setMenu(buildTrayMenu(projects))
  const removeClick = craft.tray.onClickToggleWindow()
  const listener = (event: Event) => {
    const action = (event as CustomEvent<{ action?: string }>).detail?.action
    if (action && action !== 'quit') void onAction(action)
  }
  globalThis.addEventListener('craft:tray:menuAction', listener)
  return () => {
    removeClick()
    globalThis.removeEventListener('craft:tray:menuAction', listener)
  }
}
