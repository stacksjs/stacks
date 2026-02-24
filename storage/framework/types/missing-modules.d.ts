// Type stubs for external packages not installed in the monorepo.
// These packages are optional dependencies used in specific deployment
// or feature contexts (cloud, UI, build tooling, etc.).

// ============================================================================
// Broadcasting (not installed — optional runtime dependency)
// ============================================================================

declare module 'ts-broadcasting' {
  export class Broadcaster { constructor(config?: any); channel(name: string): any; private(name: string): any; presence(name: string): any }
  export class BroadcastServer { constructor(config?: any); start(): Promise<void>; stop(): Promise<void>; [key: string]: any }
  export class BroadcastEvent { constructor(data?: any); [key: string]: any }
  export function broadcast(channel: string, event: string, data?: any): void
  export type BroadcastConfig = any
  export type ChannelType = any
  export type ServerConfig = any
}

// ============================================================================
// UI (not installed — optional Vue UI components)
// ============================================================================

declare module '@headlessui/vue' {
  import type { Component } from 'vue'
  export const Dialog: Component
  export const DialogPanel: Component
  export const DialogTitle: Component
  export const DialogDescription: Component
  export const Menu: Component
  export const MenuButton: Component
  export const MenuItems: Component
  export const MenuItem: Component
  export const Transition: Component
  export const TransitionChild: Component
  export const TransitionRoot: Component
  export const Listbox: Component
  export const ListboxButton: Component
  export const ListboxOptions: Component
  export const ListboxOption: Component
  export const Switch: Component
  export const SwitchGroup: Component
  export const SwitchLabel: Component
  export const Tab: Component
  export const TabGroup: Component
  export const TabList: Component
  export const TabPanel: Component
  export const TabPanels: Component
  export const Disclosure: Component
  export const DisclosureButton: Component
  export const DisclosurePanel: Component
  export const Popover: Component
  export const PopoverButton: Component
  export const PopoverPanel: Component
  export const RadioGroup: Component
  export const RadioGroupLabel: Component
  export const RadioGroupOption: Component
  export const RadioGroupDescription: Component
  export const Combobox: Component
  export const ComboboxInput: Component
  export const ComboboxButton: Component
  export const ComboboxOptions: Component
  export const ComboboxOption: Component
}

declare module 'headwind' {
  export type HeadwindOptions = any
  const content: any
  export default content
}

declare module '@stacksjs/headwind' {
  const content: any
  export default content
}

// ============================================================================
// Security (not installed — optional crypto dependency)
// ============================================================================

declare module 'ts-security-crypto' {
  export function encrypt(data: string, key?: string): Promise<{ encrypted: string }>
  export function decrypt(data: string, key?: string): Promise<string>
  export function hash(data: string, algorithm?: string): string
  export function verifyHash(data: string, hash: string): boolean
  export function generateKey(length?: number): string
  export function base64Decode(data: string): string
  export function base64Encode(data: string): string
  export function hashPassword(password: string, options?: any): Promise<string>
  export function verifyPassword(password: string, hash: string): Promise<boolean>
  export function md5(data: string): string
}

// ============================================================================
// Auto-imports (augment bun-plugin-auto-imports with missing exports)
// ============================================================================

declare module 'bun-plugin-auto-imports' {
  export function autoImports(options: any): any
  export const GENERATED_COMMENT: string
  export function generateESLintGlobals(options: any): any
  export function generateRuntimeIndex(dirs: string[], outputPath: string): Promise<void>
  export function generateGlobalsScript(dirs: string[], outputPath: string, indexPath: string): Promise<void>
  export type AutoImportsOptions = any
}

// ============================================================================
// Build tools (not installed — optional build-time dependencies)
// ============================================================================

declare module 'bun-plugin-stx/serve' {
  export function serve(options?: any): any
  export function stxServe(options?: any): any
  export function createStxServer(options?: any): any
  export const stxPlugin: any
}

declare module 'vite' {
  export function defineConfig(config: any): any
  export function createServer(config?: any): Promise<any>
  export function build(config?: any): Promise<any>
  export type Plugin = any
  export type UserConfig = any
  export type ResolvedConfig = any
}

declare module 'vite-ssg' {
  export function ViteSSG(app: any, options?: any): any
  export type ViteSSGContext = any
}

declare module 'vite-plugin-pwa' {
  export function VitePWA(options?: any): any
  export type Options = any
}

declare module 'vite-plugin-inspect' {
  export default function Inspect(options?: any): any
  export type Options = any
}

declare module 'unplugin-vue-components' {
  export default function Components(options?: any): any
  export type Options = any
}

declare module 'unplugin-auto-import/types' {
  export type Options = any
}

// ============================================================================
// Vue tooling (not installed — optional dev-time dependencies)
// ============================================================================

declare module 'vue-component-meta' {
  export function createComponentMetaChecker(tsConfigPath: string, options?: any): any
  export type ComponentMeta = any
  export type MetaCheckerOptions = any
}

declare module 'vue-docgen-web-types/types/config' {
  export type WebTypesBuilderConfig = any
}

// ============================================================================
// Misc utilities (not installed — optional runtime dependencies)
// ============================================================================

declare module 'ts-md' {
  export function render(markdown: string): string
  export function parse(markdown: string): any
  export function parseMarkdown(markdown: string): any
}

declare module 'qrcode' {
  export function toDataURL(text: string, options?: any): Promise<string>
  export function toString(text: string, options?: any): Promise<string>
  export function toCanvas(canvas: any, text: string, options?: any): Promise<void>
}

declare module 'markdown-table' {
  export function markdownTable(table: string[][], options?: any): string
}

declare module 'filesize' {
  export function filesize(bytes: number, options?: any): string
  export default function (bytes: number, options?: any): string
}

declare module 'crypto-js/md5' {
  export default function md5(message: string): any
}

declare module 'bun-queue' {
  import type { Faker } from 'ts-mocker'
  export class Queue<T = any> { constructor(name: string, options?: any); add(data: T, options?: any): Promise<any>; process(handler: (job: Job<T>) => Promise<any>): void; process(concurrency: number, handler: (job: Job<T>) => Promise<any>): void; on(event: string, handler: (...args: any[]) => void): void; [key: string]: any }
  export class QueueManager { constructor(options?: any); [key: string]: any }
  export class QueueWorker { constructor(options?: any); [key: string]: any }
  export class Worker { constructor(options?: any); [key: string]: any }
  export class WorkerManager { constructor(options?: any); [key: string]: any }
  export class WorkCoordinator { constructor(options?: any); [key: string]: any }
  export class Job<T = any> { constructor(data?: T); data: T; id: string | number; [key: string]: any }
  export class JobBase { constructor(data?: any); [key: string]: any }
  export class JobProcessor { constructor(options?: any); [key: string]: any }
  export class FailedJob { constructor(data?: any); [key: string]: any }
  export class FailedJobManager { constructor(options?: any); [key: string]: any }
  export class PriorityQueue { constructor(options?: any); [key: string]: any }
  export class QueueGroup { constructor(options?: any); [key: string]: any }
  export class QueueObservable { constructor(options?: any); [key: string]: any }
  export class DeadLetterQueue { constructor(options?: any); [key: string]: any }
  export class BatchProcessor { constructor(options?: any); [key: string]: any }
  export class RateLimiter { constructor(options?: any); [key: string]: any }
  export class LeaderElection { constructor(options?: any); [key: string]: any }
  export class DistributedLock { constructor(options?: any); [key: string]: any }
  export type WorkerOptions = any
  export type JobEvents = any
  export function dispatch(job: any, options?: any): Promise<any>
  export function dispatchSync(job: any): Promise<any>
  export function dispatchAfter(delay: number, job: any): Promise<any>
  export function dispatchIf(condition: boolean, job: any): Promise<any>
  export function dispatchUnless(condition: boolean, job: any): Promise<any>
  export function dispatchChain(jobs: any[]): Promise<any>
  export function dispatchFunction(fn: Function, options?: any): Promise<any>
  export function batch(jobs: any[]): any
  export function chain(jobs: any[]): any
  export function getQueueManager(): any
  export function setQueueManager(manager: any): void
  export function closeQueueManager(): Promise<void>
  export function getGlobalJobProcessor(): any
  export function setGlobalJobProcessor(processor: any): void
  export function createJobProcessor(options?: any): any
  export const middleware: {
    RateLimitMiddleware: any
    ThrottleMiddleware: any
    UniqueJobMiddleware: any
    WithoutOverlappingMiddleware: any
    SkipIfMiddleware: any
    FailureMiddleware: any
  }
  export const RateLimitMiddleware: any
  export const ThrottleMiddleware: any
  export const UniqueJobMiddleware: any
  export const WithoutOverlappingMiddleware: any
  export const SkipIfMiddleware: any
  export const FailureMiddleware: any
}

declare module '@tauri-apps/api' {
  export const invoke: (cmd: string, args?: any) => Promise<any>
  export const event: any
  export const window: any
  export const app: any
  export const core: any
  export const dpi: any
  export const image: any
  export const menu: any
  export const mocks: any
  export const path: any
  export const tray: any
  export const webview: any
  export const webviewWindow: any
}
