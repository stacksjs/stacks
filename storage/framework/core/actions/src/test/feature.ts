import { namedTestPaths, runTestSuites } from './runner'

await runTestSuites(['feature'], undefined, namedTestPaths())
