<script lang="ts" setup>
interface Props {
  title: string
  data: Number | String
  action: Boolean
}

const {
  title,
  data,
  action,
} = defineProps<Props>()

const emit = defineEmits(['cardAction'])

function cardActionEmit() {
  emit('cardAction')
}
</script>

<template>
  <div class="overflow-hidden bg-white rounded-lg shadow-lg dark:bg-gray-800 dark:border-gray-600 dark:border backdrop-blur-sm">
    <div class="p-5">
      <div class="flex items-center">
        <div class="flex-shrink-0">
          <slot name="stat-card-logo" />
        </div>
        <div class="flex-1 ml-5">
          <dl>
            <dt class="text-base font-medium dark:text-gray-300 text-gray-500 dark:text-gray-400 truncate">
              {{ title }}
            </dt>
            <dd>
              <div class="text-xl font-semibold dark:text-gray-50 text-gray-900 dark:text-gray-100">
                {{ formatNumberWithCommas(Number(data)) }}
              </div>
            </dd>
          </dl>
        </div>
      </div>
    </div>
    <div
      v-if="action"
      class="px-5 py-3 bg-gray-50 dark:bg-gray-700"
    >
      <div class="text-sm">
        <a
          href="#"
          class="font-medium text-teal-700 hover:text-teal-900 dark-hover:text-teal-300 dark:text-teal-200"
          @click="cardActionEmit()"
        >
          View all
        </a>
      </div>
    </div>
  </div>
</template>
