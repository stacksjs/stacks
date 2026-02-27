/**
 * Postinstall script to fix broken package declarations and missing source files.
 *
 * - bun-query-builder: npm package exports "bun" condition pointing to src/ which isn't shipped
 * - ts-mocker & bun-router: ship .d.ts files with parse errors that break tsc
 */
import { existsSync, mkdirSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const root = join(import.meta.dirname, '..')

// Fix bun-query-builder: create src/index.ts stub for "bun" export condition
const bqbSrc = join(root, 'node_modules/bun-query-builder/src')
if (!existsSync(bqbSrc)) {
  mkdirSync(bqbSrc, { recursive: true })
}
writeFileSync(join(bqbSrc, 'index.ts'), 'export * from "../dist/index.js"\n')

// Fix localtunnels: create src/ stubs for "bun" export condition (src/ not shipped in npm package)
const ltSrc = join(root, 'node_modules/localtunnels/src')
if (!existsSync(ltSrc)) {
  mkdirSync(ltSrc, { recursive: true })
}
writeFileSync(join(ltSrc, 'index.ts'), 'export * from "../dist/src/index.js"\n')

const ltCloudSrc = join(root, 'node_modules/localtunnels/src/cloud')
if (!existsSync(ltCloudSrc)) {
  mkdirSync(ltCloudSrc, { recursive: true })
}
writeFileSync(join(ltCloudSrc, 'index.ts'), 'export * from "../../dist/src/cloud/index.js"\n')

// Fix broken .d.ts files in ts-mocker and bun-router that have parse errors
const brokenDtsFiles = [
  'node_modules/ts-mocker/dist/locale-loader.d.ts',
  'node_modules/ts-mocker/dist/modules/database.d.ts',
  'node_modules/ts-mocker/dist/modules/git.d.ts',
  'node_modules/ts-mocker/dist/modules/image.d.ts',
  'node_modules/ts-mocker/dist/modules/internet.d.ts',
  'node_modules/ts-mocker/dist/utils/advanced-data.d.ts',
  'node_modules/@stacksjs/bun-router/dist/errors/error-handler.d.ts',
  'node_modules/@stacksjs/bun-router/dist/testing/websocket-testing.d.ts',
]

for (const file of brokenDtsFiles) {
  const fullPath = join(root, file)
  if (existsSync(fullPath)) {
    writeFileSync(fullPath, 'export {}\n')
  }
}

// Fix broken ts-cloud-core intrinsic-functions.d.ts (dtsx bug with arrow functions in objects)
const fixedIntrinsicFunctions = `export declare const Fn: IntrinsicFunctions;
export declare const Pseudo: {
  AccountId: { Ref: 'AWS::AccountId' };
  Region: { Ref: 'AWS::Region' };
  StackId: { Ref: 'AWS::StackId' };
  StackName: { Ref: 'AWS::StackName' };
  NotificationARNs: { Ref: 'AWS::NotificationARNs' };
  Partition: { Ref: 'AWS::Partition' };
  URLSuffix: { Ref: 'AWS::URLSuffix' };
  NoValue: { Ref: 'AWS::NoValue' };
};
export declare interface IntrinsicFunctions {
  Ref: (logicalName: string) => { Ref: string };
  GetAtt: (logicalName: string, attributeName: string) => { 'Fn::GetAtt': [string, string] };
  Sub: (template: string, variables?: Record<string, any>) => { 'Fn::Sub': string | [string, Record<string, any>] };
  Join: (delimiter: string, values: any[]) => { 'Fn::Join': [string, any[]] };
  Select: (index: number | string, list: any[]) => { 'Fn::Select': [number | string, any[]] };
  Split: (delimiter: string, source: string) => { 'Fn::Split': [string, string] };
  GetAZs: (region?: string) => { 'Fn::GetAZs': string };
  ImportValue: (name: string) => { 'Fn::ImportValue': string };
  If: (condition: string, trueValue: any, falseValue: any) => { 'Fn::If': [string, any, any] };
  Equals: (value1: any, value2: any) => { 'Fn::Equals': [any, any] };
  And: (...conditions: any[]) => { 'Fn::And': any[] };
  Or: (...conditions: any[]) => { 'Fn::Or': any[] };
  Not: (condition: any) => { 'Fn::Not': [any] };
  Base64: (input: string) => { 'Fn::Base64': string };
}
`

function findFiles(dir: string, filename: string): string[] {
  const results: string[] = []
  try {
    for (const entry of readdirSync(dir)) {
      const fullPath = join(dir, entry)
      try {
        const stat = statSync(fullPath)
        if (stat.isDirectory()) {
          results.push(...findFiles(fullPath, filename))
        }
        else if (entry === filename) {
          results.push(fullPath)
        }
      }
      catch {}
    }
  }
  catch {}
  return results
}

const brokenIntrinsicFiles = findFiles(join(root, 'node_modules'), 'intrinsic-functions.d.ts')
  .filter(f => f.includes('ts-cloud-core'))
for (const file of brokenIntrinsicFiles) {
  writeFileSync(file, fixedIntrinsicFunctions)
}

console.log('postinstall: patched broken package declarations')
