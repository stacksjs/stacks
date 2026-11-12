import { Action } from '@stacksjs/enums'

const previews = new Map<string, string>([
  [Action.UpgradeDeps, 'DRY RUN: Dependency upgrades are not implemented by this stage. No changes were made.'],
  [Action.UpgradeBun, 'DRY RUN: Bun upgrades are not implemented by this stage. No changes were made.'],
  [Action.UpgradeShell, 'DRY RUN: would update the Oh My Zsh configuration and copy the Buddy shell plugin. No changes were made.'],
  [Action.UpgradeBinary, 'DRY RUN: would compile and install the Stacks binary. No changes were made.'],
])

/** Read-only planning shared by the owning dispatcher and direct tool scripts. */
export function upgradeToolPreview(action: string): string | undefined {
  return previews.get(action)
}
