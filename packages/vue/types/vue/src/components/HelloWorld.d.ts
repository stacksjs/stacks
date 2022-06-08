import type { increment } from '../../../composables/src'
declare const _sfc_main: import('vue').DefineComponent<{
  name: {
    type: StringConstructor
    required: false
    default: string
  }
}, {
  props: {
    name: any
  }
  count: import('vue').Ref<number>
  increment: typeof increment
}, unknown, {}, {}, import('vue').ComponentOptionsMixin, import('vue').ComponentOptionsMixin, Record<string, any>, string, import('vue').VNodeProps & import('vue').AllowedComponentProps & import('vue').ComponentCustomProps, Readonly<import('vue').ExtractPropTypes<{
  name: {
    type: StringConstructor
    required: false
    default: string
  }
}>>, {
  name: string
}>
export default _sfc_main
