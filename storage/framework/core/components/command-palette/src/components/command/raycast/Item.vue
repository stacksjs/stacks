<script lang="ts" setup>
import { Command } from '../../../../packages'
import type { ItemInfo } from '../../../../packages/types'

defineProps({
  isCommand: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits<(e: 'select', item: ItemInfo) => void>()

const onSelect = (item: ItemInfo) => emit('select', item)
</script>

<template>
  <Command.Item @select="onSelect">
    <slot />
    <span command-raycast-meta="">
      {{ isCommand ? 'Command' : 'Application' }}
    </span>
  </Command.Item>
</template>
