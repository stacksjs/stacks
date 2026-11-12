import { Action } from '@stacksjs/actions/runtime'

/**
 * A published release artifact of the desktop app this project builds:
 * `GET /api/updates/files/{channel}/{target}/{version}/{file}`, where
 * `target` is `<platform>-<arch>` (`darwin-arm64`).
 *
 * It is where `buddy release:desktop` points a manifest and release.json when
 * `webview.updates.artifactBaseUrl` is not set, so a release on any disk, the
 * private local one included, can be downloaded with no bucket or CDN. The
 * file is streamed from the updates disk with its length and byte ranges, so
 * a large installer is never held in memory and a download can resume.
 *
 * Only a key of the artifact shape under `webview.updates.prefix` is read: no
 * path here reaches another folder or file on the disk. Public on purpose,
 * like the feed: an installer is downloaded before anyone has an account.
 *
 * Mounted by the framework beside the feed. The URL a release writes follows
 * `feedUrl`, so to move it, mount this action at `<feedUrl path>/files/...`.
 */
export default new Action({
  name: 'DesktopUpdateArtifactAction',
  description: 'Streams a published desktop release artifact from the updates disk.',
  method: 'GET',

  async handle(request: RequestInstance) {
    const { answerUpdateArtifact } = await import('@stacksjs/desktop-build/update-feed')
    return answerUpdateArtifact({
      channel: String(request.getParam('channel') ?? ''),
      target: String(request.getParam('target') ?? ''),
      version: String(request.getParam('version') ?? ''),
      file: String(request.getParam('file') ?? ''),
      range: request.headers?.get('range') ?? null,
      method: request.method,
    })
  },
})
