#!/usr/bin/env bun
/**
 * Build script for compiling the Buddy CLI to a native binary.
 *
 * The key to making this work is marking all @stacksjs/* packages and
 * local storage/* imports as external. This prevents the bundler from
 * inlining top-level await from config loading logic.
 */

console.log('🔨 Building Buddy binary...\n')

const result = await Bun.spawn([
  'bun',
  'build',
  './buddy.ts',
  '--compile',
  '--outfile',
  './buddy-bin',
  '--external',
  '@stacksjs/*',
  '--external',
  './storage/*',
  '--external',
  'bun-plugin-stx/*',
], {
  stdout: 'inherit',
  stderr: 'inherit',
}).exited

if (result === 0) {
  console.log('\n✅ Binary compiled successfully to ./buddy-bin')
  console.log('\nTest it with:')
  console.log('  ./buddy-bin --version')
  console.log('  ./buddy-bin --help')
} else {
  console.error('\n❌ Binary compilation failed')
  process.exit(1)
}
