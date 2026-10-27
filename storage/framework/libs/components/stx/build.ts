import { buildStxComponentLibrary } from '../../../core/actions/src/build/component-library'

const result = await buildStxComponentLibrary()
if (!result?.components.length)
  throw new Error('The public STX sample library has no components to publish')
