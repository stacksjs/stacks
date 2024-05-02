<script lang="ts" setup>
import { ref } from 'vue'
import { notification } from '../../packages'
import { useCopyCode } from '../composables/useCopyCode'
import CheckIcon from './icons/CheckIcon.vue'
import CopyIcon from './icons/CopyIcon.vue'

const code = `<!-- App.vue -->
<script lang="ts" setup>
import { Notification, notification } from '@stacksjs/notification'
<\/script>

<template>
  <!-- ... -->
  <Notification />
  <button @click="() => notification('My first notification')">
    Give me a notification
  </button>
</template>
`

const showCheckIcon = ref(false)

async function handleCopyCode() {
  await useCopyCode({ code, checkIconRef: showCheckIcon })
  notification('Copied to your clipboard!')
}
</script>

<template>
  <div class="usage">
    <h1 class="text-lg font-semibold my-2">
      Usage
    </h1>
    <p class="text-base my-3">
      Render the toaster in the root of your app.
    </p>
    <div class="code-block relative group">
      <Highlight
        class-name="rounded-md text-xs"
        language="xml"
        :autodetect="false"
        :code="code"
      />
      <button
        aria-label="Copy code"
        title="Copy code"
        class="absolute right-2 top-2 btn-border p-1 hidden group-hover:block"
        @click="handleCopyCode"
      >
        <CheckIcon v-if="showCheckIcon" />
        <CopyIcon v-else />
      </button>
    </div>
  </div>
</template>
