<script lang="ts">
import { computed, onBeforeUnmount, ref, watchEffect } from 'vue'
</script>

<script lang="ts" setup>
import type { CommandItemEmits, CommandItemProps } from './types'
import { random } from '@stacksjs/strings'

import { useMagicKeys, whenever } from '@vueuse/core'
import { useCommandEvent } from './useCommandEvent'
import { useCommandState } from './useCommandState'

defineOptions({
  name: 'Command.Item',
})

const props = defineProps<CommandItemProps>()

const emit = defineEmits<CommandItemEmits>()

const SELECT_EVENT = `command-item-select`
const VALUE_ATTR = `data-value`

const { current } = useMagicKeys()
const { selectedNode, filtered, isSearching } = useCommandState()
const { itemInfo } = useCommandEvent()

const itemRef = ref<HTMLDivElement>()

const itemId = computed(() => `command-item-${random()}`)

const isRender = computed(() => {
  const itemKey = filtered.value.items.get(itemId.value)

  return !isSearching.value ? true : itemKey !== undefined
})

const currentKeys = computed(() => Array.from(current))

function handleSelect() {
  const itemInfoObj = {
    key: itemId.value,
    value: itemRef.value?.getAttribute(VALUE_ATTR) || '',
  }

  itemInfo.value = itemInfoObj
  emit('select', itemInfoObj)
}

whenever(currentKeys, (v) => {
  if (props.shortcut && props.shortcut.length > 0) {
    const hasKey = props.shortcut.every(key => current.has(key.toLowerCase()))
    if (hasKey && props.perform)
      props.perform()
  }
})

watchEffect(() => {
  itemRef.value?.addEventListener(SELECT_EVENT, handleSelect)
})

onBeforeUnmount(() => {
  itemRef.value?.removeEventListener(SELECT_EVENT, handleSelect)
})
</script>

<template>
  <div
    v-show="isRender"
    ref="itemRef"
    :key="itemId"
    command-item=""
    role="option"
    :aria-selected="selectedNode === itemId"
    :aria-disabled="!isRender"
    :command-item-key="itemId"
    @click="handleSelect"
  >
    <slot />
  </div>
</template>
