<script lang="ts" setup>
import { Command } from '../../../../packages'
import type { ItemInfo } from '../../../../packages/types'

defineProps({
  shortcut: {
    type: Array,
  },
})

const emit = defineEmits<(e: 'select', item: ItemInfo) => void>()

const onSelect = (item: ItemInfo) => emit('select', item)
</script>

<template>
  <Command.Item @select="onSelect">
    <slot />
    <div command-vercel-shortcuts="">
      <kbd v-for="key in shortcut" key="key">{{ key }}</kbd>
    </div>
  </Command.Item>
</template>
