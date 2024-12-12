<script lang="ts" setup>
import type { ItemInfo } from './types'
import { whenever } from '@vueuse/core'

import { onBeforeUnmount, ref, watch } from 'vue'
import Command from './CommandRoot.vue'
import { useCommandEvent } from './useCommandEvent'
import { useCommandState } from './useCommandState'

defineOptions({
  name: 'Command.Dialog',
})

const props = defineProps<{
  visible: boolean
  theme: string
}>()

const emit = defineEmits<{
  (e: 'selectItem', item: ItemInfo): void
}>()

const { resetStore } = useCommandState()
const { itemInfo } = useCommandEvent()
const dialogRef = ref<HTMLDivElement>()

watch(
  () => itemInfo.value,
  (item) => {
    emit('selectItem', item!)
  },
)

whenever(() => props.visible, resetStore)

onBeforeUnmount(resetStore)
</script>

<template>
  <Teleport ref="dialogRef" to="body">
    <Transition name="command-dialog" appear>
      <Command v-if="visible" :theme="theme">
        <div command-dialog>
          <div command-dialog-mask>
            <div command-dialog-wrapper>
              <div command-dialog-header>
                <slot name="header" />
              </div>
              <div command-dialog-body>
                <slot name="body" />
              </div>
              <div v-if="$slots.footer" command-dialog-footer>
                <slot name="footer" />
              </div>
            </div>
          </div>
        </div>
      </Command>
    </Transition>
  </Teleport>
</template>
