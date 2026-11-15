import type { WorkflowConfig } from '@stacksjs/types'
import type { IosReleaseOptions } from './commands/release'
import { execFileSync } from 'node:child_process'
import { log } from '@stacksjs/cli'
import { assertPublicationAllowed } from '@stacksjs/actions/publication-preflight'
import { describeGitHubRelease, publishGitHubRelease } from '@stacksjs/actions/github-release'
import { appStoreLocales, commitsBetween, NO_VISIBLE_CHANGES, previousMobileTag, resolveNotes, testerNotes, writeWhatToTest } from '@stacksjs/actions/release-notes'
import { waitMinutes } from './commands/release'
import { commitWorkflowRelease, nextWorkflowRelease, requireQualifiedWorkflow, waitForWorkflowRelease } from './workflow-release'

/** The normal release command selects the configured execution provider. */
export async function releaseWorkflowIos(root: string, config: WorkflowConfig, options: IosReleaseOptions): Promise<string> {
  const git = (...args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim()
  if ((config.branch ?? 'main') !== 'main' || git('branch', '--show-current') !== 'main') throw new Error('Release from main')
  if (git('status', '--porcelain', '--untracked-files=no')) throw new Error('Commit the reviewed changes before releasing')
  if (!options.dryRun) {
    git('fetch', '--quiet', '--tags', 'origin')
    git('merge', '--ff-only', 'origin/main')
    await assertPublicationAllowed({ cwd: root, channel: 'ios' })
  }
  if (git('rev-parse', 'HEAD') !== git('rev-parse', 'origin/main')) throw new Error('Qualify and push this main source before releasing')
  // This happens before touching a manifest, writing notes or allocating a tag.
  const accepted = await requireQualifiedWorkflow(root, config)
  const identity = nextWorkflowRelease(root, config, options.bump)
  const commits = commitsBetween(root, previousMobileTag(root, 'HEAD'), 'HEAD')
  const notes = resolveNotes({ cwd: root, flags: options, config: {}, generate: () => testerNotes(commits) })
  log.info(`Qualified workflow ${accepted}. ${options.dryRun ? 'Would release' : 'Releasing'} ${identity.tag}`)
  const directory = config.release?.notesDirectory ?? 'storage/framework/mobile/ios'
  const locales = config.release?.locales ?? appStoreLocales([])
  if (options.dryRun) { log.info(notes.text); return identity.tag }
  const files = writeWhatToTest(root, directory, notes.text, locales)
  // Newly written notes are untracked until the release commit. Existing notes
  // may be tracked; commit only the reviewed release metadata and note files.
  for (const file of files) git('add', '--', file)
  // Metadata and notes form one commit; preflight happened before either changed.
  commitWorkflowRelease(root, config, identity, files)
  if (!options.skipGithubRelease) {
    const published = await publishGitHubRelease({ cwd: root, tag: identity.tag, name: `${identity.version} (build ${identity.build})`, summary: notes.text || NO_VISIBLE_CHANGES })
    log.info(describeGitHubRelease(identity.tag, published))
  }
  const wait = waitMinutes(options.wait)
  if (wait !== null) log.info(`Release workflow ${await waitForWorkflowRelease(root, config, wait)} confirms native acceptance and tester availability`)
  else log.info(`Follow delivery with buddy workflow:runs. The release workflow verifies the downloaded app before signing and uploading`)
  return identity.tag
}
