<script lang="ts" setup>
import { defineComponent, h, markRaw, ref } from 'vue'
import { notification } from '../../'
import { useCopyCode } from '../../composables/Demo/useCopyCode'

// eslint-disable-next-line no-template-curly-in-string
const promiseCode = '`${data.name} notification has been added`'

const CustomDiv = defineComponent({
  setup() {
    return () =>
      h('div', {
        innerHTML: 'A custom toast with unstyling',
      })
  },
})

const allTypes = [
  {
    name: 'Default',
    snippet: `notification('Event has been created')`,
    action: () => notification('Event has been created'),
  },
  {
    name: 'Description',
    snippet: `notification.message('Event has been created', {
  description: 'Monday, January 3rd at 6:00pm',
})`,
    action: () =>
      notification('Event has been created', {
        description: 'Monday, January 3rd at 6:00pm',
      }),
  },
  {
    name: 'Success',
    snippet: `notification.success('Event has been created')`,
    action: () => notification.success('Event has been created'),
  },
  {
    name: 'Info',
    snippet: `notification.info('Event has been created')`,
    action: () => notification.info('Event has been created'),
  },
  {
    name: 'Warning',
    snippet: `notification.warning('Event has been created')`,
    action: () => notification.warning('Event has been created'),
  },
  {
    name: 'Error',
    snippet: `notification.error('Event has not been created')`,
    action: () => notification.error('Event has not been created'),
  },
  {
    name: 'Action',
    snippet: `notification('Event has been created', {
  action: {
    label: 'Undo',
    onClick: () => console.log('Undo')
  },
})`,
    action: () =>
      notification.message('Event has been created', {
        action: {
          label: 'Undo',
          // eslint-disable-next-line no-console
          onClick: () => console.log('Undo'),
        },
        duration: 10000000,
      }),
  },
  {
    name: 'Promise',
    snippet: `const promise = () => new Promise((resolve) => setTimeout(resolve, 2000));

notification.promise(promise, {
  loading: 'Loading...',
  success: (data) => {
    return ${promiseCode};
  },
  error: (data: any) => 'Error',
});`,
    action: () =>
      notification.promise(
        () =>
          new Promise((resolve) => {
            setTimeout(() => {
              resolve({ name: 'Stacks Notification' })
            }, 2000)
          }),
        {
          loading: 'Loading...',
          success: (data: any) => {
            return `${data.name} toast has been added`
          },
          error: () => 'Error',
          duration: 10000000,
        },
      ),
  },
  {
    name: 'Custom',
    snippet: `import { defineComponent, h, markRaw } from 'vue'

const CustomDiv = defineComponent({
  setup() {
    return () =>
      h('div', {
        innerHTML: 'A custom toast with styling'
      })
  }
})

notification(markRaw(CustomDiv))
`,
    action: () => notification(markRaw(CustomDiv)),
  },
]

const activeType = ref(allTypes[0])
const showCheckIcon = ref(false)

async function handleCopyCode() {
  await useCopyCode({
    code: activeType.value.snippet,
    checkIconRef: showCheckIcon,
  })
  notification('Copied to your clipboard!')
}
</script>

<template>
  <div class="types">
    <h1 class="my-2 text-lg font-semibold">
      Types
    </h1>

    <p class="my-3 text-base">
      You can customize the type of toast you want to render, and pass an
      options object as the second argument.
    </p>

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

    <div class="group code-block relative">
      <Highlight
        language="javascript"
        class-name="rounded-md text-xs"
        :autodetect="false"
        :code="activeType.snippet"
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
