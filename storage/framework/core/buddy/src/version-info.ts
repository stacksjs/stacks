import { version as buddyVersion } from '../package.json'

// Every published Stacks framework package shares the release version. Buddy's
// own package metadata is therefore the portable source of truth for both
// labels. Reading the monorepo parent's package.json works from src/ but escapes
// the package after compilation to dist/ and breaks clean npm installs.
const stacksVersion = buddyVersion

export { buddyVersion, stacksVersion }

export const versionDescriptor = `${buddyVersion} stacks/${stacksVersion}`
export const versionLine = `buddy/${versionDescriptor}`
