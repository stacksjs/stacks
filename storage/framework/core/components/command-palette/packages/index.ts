import { computed, defineComponent, h } from 'vue'
import Dialog from './CommandDialog.vue'
import Group from './CommandGroup.vue'
import Input from './CommandInput.vue'
import Item from './CommandItem.vue'
import List from './CommandList.vue'
import Root from './CommandRoot.vue'
import { useCommandState } from './useCommandState'

/**
 * Command Empty Node
 */
const Empty = defineComponent({
  name: 'Command.Empty',
  setup(props, { attrs, slots }) {
    const { filtered } = useCommandState()
    const isRender = computed(() => filtered.value.count === 0)
    return () =>
      isRender.value
        ? h(
            'div',
            {
              'command-empty': '',
              'role': 'presentation',
              ...attrs,
            },
            slots,
          )
        : h('div', {
            'command-empty': 'hidden',
            'role': 'presentation',
            'style': {
              display: 'none',
            },
            ...attrs,
          })
  },
})

/**
 * Command Loading Node
 */
const Loading = defineComponent({
  name: 'Command.Loading',
  setup(props, { attrs, slots }) {
    return () =>
      h(
        'div',
        {
          'command-loading': '',
          'role': 'progressbar',
          ...attrs,
        },
        slots,
      )
  },
})

/**
 * Command Separator Node
 */
const Separator = defineComponent({
  name: 'Command.Separator',
  // eslint-disable-next-line unused-imports/no-unused-vars
  setup(props, { attrs, slots }) {
    return () =>
      h('div', {
        'command-separator': '',
        'role': 'separator',
        ...attrs,
      })
  },
})

const Command = Object.assign(Root, {
  Root,
  Dialog,
  Empty,
  Group,
  Input,
  Item,
  List,
  Loading,
  Separator,
}) as typeof Root & {
  readonly Root: typeof Root
  readonly Dialog: typeof Dialog
  readonly Empty: typeof Empty
  readonly Group: typeof Group
  readonly Input: typeof Input
  readonly Item: typeof Item
  readonly List: typeof List
  readonly Loading: typeof Loading
  readonly Separator: typeof Separator
}

export { Command, useCommandState }
export type { CommandGroupProps, CommandInputEmits, CommandInputProps, CommandItemEmits, CommandItemProps, CommandRootEmits, CommandRootProps } from './types'
