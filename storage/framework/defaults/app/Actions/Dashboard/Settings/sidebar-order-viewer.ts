import type { RequestInstance } from '@stacksjs/types'
import { isLocalDeployment } from '@stacksjs/env'

export async function sidebarOrderViewer(request: RequestInstance): Promise<string> {
  if (isLocalDeployment()) return 'local'
  const user = await request.user()
  if (!user?.id) throw new Error('Authenticated sidebar viewer is required.')
  return `user:${user.id}`
}
