import { route } from '@stacksjs/router'

/**
 * The desktop update feed: what an installed desktop app (`desktop.webview`)
 * asks for a newer version. Mounted while `config/desktop.ts` has
 * `webview.updates`. An app route at the same path registers first and wins.
 *
 * Public on purpose: an app checks before anyone has signed in, and the
 * manifest it gets is only as good as its signature.
 */
route.get('/api/updates/{platform}/{arch}', 'Actions/Desktop/UpdateFeedAction')

/**
 * The artifacts those manifests name, streamed from the updates disk. A
 * release points here unless `webview.updates.artifactBaseUrl` names a bucket
 * or CDN that serves the disk itself.
 */
route.get('/api/updates/files/{channel}/{target}/{version}/{file}', 'Actions/Desktop/UpdateArtifactAction')
