<script lang="ts" setup>
import { ref } from 'vue'
import { notification } from '../../'
import { useCopyCode } from '../../composables/Demo/useCopyCode'

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
    <h1 class="my-2 text-lg font-semibold">
      Usage
    </h1>
    <p class="my-3 text-base">
      Render the toaster in the root of your app.
    </p>
    <div class="code-block group relative">
      <Highlight
        class-name="rounded-md text-xs"
        language="xml"
        :autodetect="false"
        :code="code"
      />
      <button
        aria-label="Copy code"
        title="Copy code"
        class="btn-border absolute right-2 top-2 hidden p-1 group-hover:block"
        @click="handleCopyCode"
      >
        <div v-if="showCheckIcon" class="i-hugeicons:checkmark-circle-01 text-gray-500" />
        <div v-else class="i-hugeicons:copy-01 text-gray-500" />
      </button>
    </div>
  </div>
</template>
