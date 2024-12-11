<script lang="ts" setup>
import type { CommandGroupProps } from './types'
import { random } from '@stacksjs/strings'

import { computed } from 'vue'
import { useCommandState } from './useCommandState'

defineOptions({
  name: 'Command.Group',
})

defineProps<CommandGroupProps>()

const groupId = computed(() => `command-group-${random()}`)

const { filtered, isSearching } = useCommandState()

const isRender = computed(() =>
  !isSearching.value ? true : filtered.value.groups.has(groupId.value),
)
</script>

<template>
  <div
    v-show="isRender"
    :key="groupId"
    command-group=""
    role="presentation"
    :command-group-key="groupId"
    :data-value="heading"
  >
    <div v-if="heading" command-group-heading="">
      {{ heading }}
    </div>
    <div command-group-items="" role="group">
      <slot />
    </div>
  </div>
</template>
