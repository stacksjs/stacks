import assert from 'node:assert/strict'
import { mkdtempSync, realpathSync, mkdirSync, writeFileSync, readFileSync, existsSync, symlinkSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { projectPath, frameworkPath } from '../../../path/src'
import { setEnvValue } from '../../src/helpers'
import { cleanProject } from '../../src/clean'
import { updateConfigFile } from '../../../storage/src/helpers'
const original = process.cwd()
const root = realpathSync(mkdtempSync(join(tmpdir(), 'stacks-helper-filesystem-')))
try {
  mkdirSync(join(root, 'storage/framework/core/package'), { recursive: true })
  writeFileSync(join(root, 'package.json'), '{}')
  process.chdir(root)
  assert.equal(projectPath(), root)
  assert.equal(frameworkPath(), join(root, 'storage/framework'))
  switch (process.argv[2]) {
    case 'env': {
      for (const value of ['cost$&', '$$', '$1', "$`", "$'", 'literal value']) {
        writeFileSync(join(root, '.env'), 'EXAMPLE=old\nOTHER=keep\n')
        await setEnvValue('EXAMPLE', value)
        assert.equal(readFileSync(join(root, '.env'), 'utf8'), `EXAMPLE=${value}\nOTHER=keep\n`)
      }
      writeFileSync(join(root, '.env'), 'OTHER=keep')
      await setEnvValue('A.B', '$&')
      assert.equal(readFileSync(join(root, '.env'), 'utf8'), 'OTHER=keep\nA.B=$&\n')
      break
    }
    case 'config': {
      const file = join(root, 'config.json')
      writeFileSync(file, '{"kept":true}')
      let reads = 0
      const prototype = Object.defineProperty({}, 'leaked', { enumerable: true, get() { reads++; return 1 } })
      const update = Object.setPrototypeOf(JSON.parse('{"__proto__":{"isAdmin":true},"constructor":"data","own":1}'), prototype)
      await updateConfigFile(file, update)
      const result = JSON.parse(readFileSync(file, 'utf8'))
      assert.deepEqual(result, JSON.parse('{"kept":true,"__proto__":{"isAdmin":true},"constructor":"data","own":1}'))
      assert.equal(reads, 0)
      const before = readFileSync(file, 'utf8')
      const cycle: any = {}; cycle.self = cycle
      for (const value of [1n, cycle]) {
        await assert.rejects(updateConfigFile(file, { value }))
        assert.equal(readFileSync(file, 'utf8'), before)
      }
      writeFileSync(file, '{invalid')
      await assert.rejects(updateConfigFile(file, { change: true }))
      assert.equal(readFileSync(file, 'utf8'), '{invalid')
      break
    }
    case 'clean': {
      for (const path of ['node_modules', 'storage/framework/dist', 'storage/framework/core/package/dist', 'storage/framework/core/package/node_modules', 'storage/framework/cloud/cdk.out']) {
        mkdirSync(join(root, path), { recursive: true }); writeFileSync(join(root, path, 'artifact'), 'built')
      }
      const outside = join(root, 'outside')
      mkdirSync(join(outside, 'dist'), { recursive: true }); writeFileSync(join(outside, 'dist/keep'), 'keep')
      symlinkSync(outside, join(root, 'storage/framework/external'), 'dir')
      symlinkSync(outside, join(root, 'storage/framework/core/package/dist-link'), 'dir')
      writeFileSync(join(root, 'storage/framework/core/package/source.ts'), 'source')
      writeFileSync(join(root, 'bun.lock'), 'lock')
      await cleanProject()
      for (const path of ['node_modules', 'storage/framework/dist', 'storage/framework/core/package/dist', 'storage/framework/core/package/node_modules', 'storage/framework/cloud/cdk.out', 'bun.lock']) assert.equal(existsSync(join(root, path)), false, path)
      assert.equal(readFileSync(join(outside, 'dist/keep'), 'utf8'), 'keep')
      assert.equal(readFileSync(join(root, 'storage/framework/core/package/source.ts'), 'utf8'), 'source')
      // An aliased framework parent must not make cleanup operate on external data.
      rmSync(join(root, 'storage/framework'), { recursive: true, force: true })
      symlinkSync(outside, join(root, 'storage/framework'), 'dir')
      await cleanProject()
      assert.equal(readFileSync(join(outside, 'dist/keep'), 'utf8'), 'keep')
      break
    }
    default: throw new Error('Unknown filesystem case')
  }
  console.log(`filesystem ${process.argv[2]} OK`)
}
finally { process.chdir(original); rmSync(root, { recursive: true, force: true }) }
