declare interface Window {
    // extend the window
}

declare module '*.vue' {
    import type { DefineComponent } from '@vue/runtime-core'

    const component: DefineComponent<{}, {}, any>
    export default component
}