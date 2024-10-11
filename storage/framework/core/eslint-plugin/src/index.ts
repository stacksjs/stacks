import configsFlat from './configs/flat'
import configsRecommended from './configs/recommended'
import { plugin } from './plugin'
import './types'

const p: any = {
  ...plugin,
  configs: {
    recommended: configsRecommended,
    flat: configsFlat,
  },
}

export default p
