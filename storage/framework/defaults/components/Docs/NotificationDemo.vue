<script lang="ts" setup>
import type { Position, Theme } from '../../../storage/framework/core/components/notification/src/types'
import { ref } from 'vue'
import { Notification } from '@stacksjs/notification'
import Expand from '../../../storage/framework/core/components/notification/src/Expand.vue'
import Others from '../../../storage/framework/core/components/notification/src/Others.vue'
import Pos from '../../../storage/framework/core/components/notification/src/Position.vue'
import Styling from '../../../storage/framework/core/components/notification/src/Styling.vue'
import Theming from '../../../storage/framework/core/components/notification/src/Theming.vue'
import Types from '../../../storage/framework/core/components/notification/src/Types.vue'

const expand = ref(false)
const position = ref<Position>('top-right')
const richColors = ref(false)
const closeButton = ref(false)
const theme = ref<Theme>('light')
</script>

<template>
  <div class="flex flex-col">
    <div class="flex font-semibold text-lg">
      Basic
    </div>
    <div class="text-primary grid grid-cols-1 gap-8 pb-20 text-xs 2xl:text-sm">
      <Types />
      <Pos v-model:position="position" />
      <Expand v-model:expand="expand" />
      <Theming @set-theme="(newTheme: Theme) => (theme = newTheme)" />
      <Styling />
      <Others
        @set-rich-colors="richColors = true"
        @set-close-button="closeButton = true"
      />
    </div>

    <Notification
      :position="position"
      :expand="expand"
      :rich-colors="richColors"
      :close-button="closeButton"
      :theme="theme"
    />
  </div>
</template>
