// @babel/generator and @babel/traverse ship default exports that
// TypeScript can't see because the package's `.d.ts` declares them
// as namespace re-exports. The runtime shape is correct under
// `esModuleInterop`; the ignore is the cheapest fix until upstream
// publishes proper module-default declarations.
// eslint-disable-next-line ts/ban-ts-comment
// @ts-ignore — upstream .d.ts lacks default export declaration
export { default as generator } from '@babel/generator'
export { default as parser } from '@babel/parser'
// eslint-disable-next-line ts/ban-ts-comment
// @ts-ignore — upstream .d.ts lacks default export declaration
export { default as traverse } from '@babel/traverse'
