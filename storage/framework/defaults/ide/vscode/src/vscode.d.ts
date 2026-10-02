/**
 * The slice of the VS Code extension API this extension uses.
 *
 * `@types/vscode` is the complete declaration, but it would be the only
 * dependency of a package that otherwise has none, and the extension calls a
 * couple of dozen members. The names and signatures below are copied from
 * `@types/vscode` (engine ^1.93 for the terminal shell-integration API), so
 * swapping this file for the real package later is a deletion, not a rewrite.
 */
declare module 'vscode' {
  export interface Disposable {
    dispose: () => unknown
  }

  export type Event<T> = (listener: (event: T) => unknown) => Disposable

  export class Uri {
    static parse(value: string): Uri
    static file(path: string): Uri
    readonly scheme: string
    readonly authority: string
    readonly path: string
    readonly fsPath: string
    toString(skipEncoding?: boolean): string
  }

  export enum ViewColumn {
    Active = -1,
    Beside = -2,
    One = 1,
  }

  export enum StatusBarAlignment {
    Left = 1,
    Right = 2,
  }

  export interface ExtensionContext {
    readonly subscriptions: Disposable[]
  }

  export interface WorkspaceFolder {
    readonly uri: Uri
    readonly name: string
    readonly index: number
  }

  export interface WorkspaceConfiguration {
    get: <T>(section: string, defaultValue: T) => T
  }

  export interface ConfigurationChangeEvent {
    affectsConfiguration: (section: string) => boolean
  }

  export interface FileSystemWatcher extends Disposable {
    readonly onDidCreate: Event<Uri>
    readonly onDidChange: Event<Uri>
    readonly onDidDelete: Event<Uri>
  }

  export interface TerminalOptions {
    name?: string
    cwd?: string | Uri
    env?: Record<string, string | null | undefined>
  }

  export interface TerminalExitStatus {
    readonly code: number | undefined
  }

  export interface TerminalShellExecution {
    read: () => AsyncIterable<string>
  }

  export interface TerminalShellIntegration {
    executeCommand: (commandLine: string) => TerminalShellExecution
  }

  export interface Terminal {
    readonly name: string
    readonly exitStatus: TerminalExitStatus | undefined
    readonly shellIntegration: TerminalShellIntegration | undefined
    show: (preserveFocus?: boolean) => void
    sendText: (text: string, shouldExecute?: boolean) => void
    dispose: () => void
  }

  export interface TerminalShellIntegrationChangeEvent {
    readonly terminal: Terminal
    readonly shellIntegration: TerminalShellIntegration
  }

  export interface TerminalShellExecutionEndEvent {
    readonly terminal: Terminal
    readonly execution: TerminalShellExecution
    readonly exitCode: number | undefined
  }

  export interface StatusBarItem {
    text: string
    tooltip: string | undefined
    command: string | undefined
    name: string | undefined
    show: () => void
    hide: () => void
    dispose: () => void
  }

  export interface QuickPickItem {
    label: string
    description?: string
    detail?: string
    alwaysShow?: boolean
  }

  export interface QuickPick<T extends QuickPickItem> extends Disposable {
    value: string
    title: string | undefined
    placeholder: string | undefined
    items: readonly T[]
    readonly selectedItems: readonly T[]
    busy: boolean
    matchOnDescription: boolean
    readonly onDidChangeValue: Event<string>
    readonly onDidAccept: Event<void>
    readonly onDidHide: Event<void>
    show: () => void
    hide: () => void
  }

  export interface InputBoxOptions {
    title?: string
    prompt?: string
    placeHolder?: string
    value?: string
    ignoreFocusOut?: boolean
    validateInput?: (value: string) => string | undefined | null
  }

  export interface TextDocument {
    readonly uri: Uri
  }

  export interface TextEditor {
    readonly document: TextDocument
  }

  export namespace window {
    export const activeTextEditor: TextEditor | undefined
    export const terminals: readonly Terminal[]
    export const onDidCloseTerminal: Event<Terminal>
    export const onDidChangeTerminalShellIntegration: Event<TerminalShellIntegrationChangeEvent>
    export const onDidEndTerminalShellExecution: Event<TerminalShellExecutionEndEvent>
    export function createTerminal(options: TerminalOptions): Terminal
    export function createStatusBarItem(id: string, alignment?: StatusBarAlignment, priority?: number): StatusBarItem
    export function createQuickPick<T extends QuickPickItem>(): QuickPick<T>
    export function showInputBox(options?: InputBoxOptions): PromiseLike<string | undefined>
    export function showInformationMessage<T extends string>(message: string, ...items: T[]): PromiseLike<T | undefined>
    export function showWarningMessage<T extends string>(message: string, ...items: T[]): PromiseLike<T | undefined>
    export function showErrorMessage<T extends string>(message: string, ...items: T[]): PromiseLike<T | undefined>
  }

  export namespace workspace {
    export const workspaceFolders: readonly WorkspaceFolder[] | undefined
    export const onDidChangeConfiguration: Event<ConfigurationChangeEvent>
    export function getConfiguration(section?: string): WorkspaceConfiguration
    export function getWorkspaceFolder(uri: Uri): WorkspaceFolder | undefined
    export function createFileSystemWatcher(globPattern: string): FileSystemWatcher
  }

  export namespace commands {
    export function registerCommand(command: string, callback: (...args: any[]) => any): Disposable
    export function executeCommand<T = unknown>(command: string, ...rest: any[]): PromiseLike<T>
  }

  export namespace env {
    export function asExternalUri(target: Uri): PromiseLike<Uri>
    export function openExternal(target: Uri): PromiseLike<boolean>
  }
}
