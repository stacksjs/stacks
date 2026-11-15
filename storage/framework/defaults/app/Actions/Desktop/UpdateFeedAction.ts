import { Action } from '@stacksjs/actions/runtime'

/**
 * The update feed of the desktop app this project builds (`webview.updates`
 * in config/desktop.ts, or `macos.updates` for a native macOS app):
 * `GET /api/updates/{platform}/{arch}`.
 *
 * It serves the manifest `buddy release:desktop` published for that platform
 * and architecture, exactly as stored. The manifest is signed with a key this
 * server never holds, so nothing here can make an app accept an update the
 * releaser did not sign. `?current=<version>` gets 204 when there is nothing
 * newer; `?channel=beta` reads another channel.
 *
 * Mounted by the framework when `webview.updates` or `macos.updates` is
 * configured. To change the path, mount it yourself in routes/api.ts:
 *
 *   route.get('/desktop/feed/{platform}/{arch}', 'Actions/Desktop/UpdateFeedAction')
 *
 * A project that declares both apps with updates serves the web view app's
 * here. Give `macos.updates` its own `prefix` and `feedUrl`, and answer that
 * path from an action of your own with `answerUpdateFeed({ app: 'macos', ... })`.
 */
export default new Action({
  name: 'DesktopUpdateFeedAction',
  description: 'Serves the signed update manifest for a desktop platform and architecture.',
  method: 'GET',

  async handle(request: RequestInstance) {
    const { answerUpdateFeed } = await import('@stacksjs/desktop-build/update-feed')
    const channel = request.get('channel')
    const current = request.get('current')
    return answerUpdateFeed({
      platform: String(request.getParam('platform') ?? ''),
      architecture: String(request.getParam('arch') ?? ''),
      channel: typeof channel === 'string' ? channel : null,
      currentVersion: typeof current === 'string' ? current : null,
    })
  },
})
