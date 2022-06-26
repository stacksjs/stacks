import { buildFunctions as stacksFunctions, defineBuildConfig } from '../builds'

export default defineBuildConfig(stacksFunctions(['../../../functions/index']))
