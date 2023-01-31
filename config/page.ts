import { type PageOptions as Options } from '@stacksjs/types'
import { onboardingPath, settingsPath } from '@stackjs/path'
/**
 * **Debug Options**
 *
 * This configuration defines all of your database options. Because Stacks is full-typed,
 * you may hover any of the options below and the definitions will be provided. In case
 * you have any questions, feel free to reach out via Discord or GitHub Discussions.
 */
export const page: Options = {
  onboarding: {
    path: 'pages/dashboard/onboarding',
    pages: [],
  },
  settings: {
    path: 'pages/dashboard/settings',
    pages: [],
  },
}
