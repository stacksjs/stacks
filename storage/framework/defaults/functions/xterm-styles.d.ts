/**
 * xterm's stylesheet, imported as text by `remote-terminal-element.ts` (Bun's
 * `with { type: 'text' }`). Declared for this one module rather than every
 * `*.css`, so it does not claim anything about how other stylesheets load.
 */
declare module '@xterm/xterm/css/xterm.css' {
  const styles: string
  export default styles
}
