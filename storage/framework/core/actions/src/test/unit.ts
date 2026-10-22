import { namedTestPaths, runTestSuites } from './runner'

await runTestSuites(['unit'], undefined, namedTestPaths())
