import { alias } from '../../../config/alias'
import { buildVueComponents, buildWebComponents, plugins } from '../../composables/src'
// import type { UserOptions } from './options'

function Stacks() {
  // export function Stacks(userOptions: UserOptions = {}) {
  // console.log('userOptions', userOptions)

  return plugins
}

const resolveOptions = {
  dedupe: ['vue'],
  alias,
}

export { Stacks, alias, resolveOptions, buildVueComponents, buildWebComponents }
