/* eslint-disable */

declare interface Window {
  // extend the window
}

// Markdown files can be treated as components
declare module '*.md' {
  import type { DefineComponent } from '@stacksjs/stx'

  const component: DefineComponent<{}, {}, any>
  export default component
}

declare module '*.stx' {
  import type { DefineComponent } from '@stacksjs/stx'

  const component: DefineComponent<{}, {}, any>
  export default component
}
