<script lang="ts" setup>
import { markRaw, ref } from 'vue'
import { notification } from '../'
import { useCopyCode } from '../composables/useCopyCode'
import HeadlessToast from './HeadlessToast.vue'
import HeadlessToastWithProps from './HeadlessToastWithProps.vue'
import CheckIcon from './icons/CheckIcon.vue'
import CopyIcon from './icons/CopyIcon.vue'

const emit = defineEmits(['setRichColors', 'setCloseButton'])

const allTypes = [
  {
    name: 'Rich Colors Success',
    snippet: `notification.success('Event has been created')

// ...

<Notification richColors  />
`,
    action: () => {
      notification.success('Event has been created')
      emit('setRichColors', true)
    },
  },
  {
    name: 'Rich Colors Info',
    snippet: `notification.info('Event has been created')

// ...

<Notification richColors  />
`,
    action: () => {
      notification.info('Event has been created')
      emit('setRichColors', true)
    },
  },
  {
    name: 'Rich Colors Warning',
    snippet: `notification.warning('Event has been created')

// ...

<Notification richColors  />
`,
    action: () => {
      notification.warning('Event has been created')
      emit('setRichColors', true)
    },
  },
  {
    name: 'Rich Colors Error',
    snippet: `notification.error('Event has not been created')

// ...

<Notification richColors  />
`,
    action: () => {
      notification.error('Event has not been created')
      emit('setRichColors', true)
    },
  },
  {
    name: 'Close Button',
    snippet: `notification('Event has been created', {
  description: 'Monday, January 3rd at 6:00pm',
})

// ...

<Notification closeButton  />
`,
    action: () => {
      notification('Event has been created', {
        description: 'Monday, January 3rd at 6:00pm',
      })
      emit('setCloseButton')
    },
  },
  {
    name: 'Headless',
    snippet: `import { markRaw } from 'vue'

import HeadlessToast from './HeadlessToast.vue'

notification.custom(markRaw(HeadlessToast));
`,
    action: () => {
      notification.custom(markRaw(HeadlessToast), { duration: 999999 })
      emit('setCloseButton')
    },
  },
  {
    name: 'Custom with props',
    snippet: `import { markRaw } from 'vue'

import HeadlessToastWithProps from './HeadlessToastWithProps.vue'

notification.warning(markRaw(HeadlessToastWithProps), {
  componentProps: {
    message: 'This is <br />multiline message'
  }
});
`,
    action: () => {
      notification.warning(markRaw(HeadlessToastWithProps), {
        componentProps: {
          message: 'This is <br />multiline message',
        },
      })
    },
  },
]

const activeType = ref(allTypes[0])
const showCheckIcon = ref(false)

async function handleCopyCode() {
  await useCopyCode({
    code: activeType.value.snippet,
    checkIconRef: showCheckIcon,
  })
  notification('Copied to your clipboard!!!')
}
</script>

<template>
  <div class="types">
    <h1 class="text-lg font-semibold my-2">
      Others
    </h1>
    <div class="mb-4 flex flex-wrap gap-3 overflow-auto">
      <button
        v-for="type in allTypes"
        :key="type.name"
        class="btn-default"
        :class="{
          'bg-neutral-200/50 border-neutral-400/50':
            type.name === activeType.name,
        }"
        @click="
          () => {
            type.action()
            activeType = type
          }
        "
      >
        {{ type.name }}
      </button>
    </div>
    <div class="code-block relative group">
      <Highlight
        language="javascript"
        class-name="rounded-md text-xs"
        :autodetect="false"
        :code="activeType.snippet"
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
