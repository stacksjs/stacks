import { version as stacksVersion } from '../../package.json'
import { version as buddyVersion } from '../package.json'

export { buddyVersion, stacksVersion }

export const versionDescriptor = `${buddyVersion} stacks/${stacksVersion}`
export const versionLine = `buddy/${versionDescriptor}`
