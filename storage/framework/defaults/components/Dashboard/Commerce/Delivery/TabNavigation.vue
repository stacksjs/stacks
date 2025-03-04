<template>
  <div>
    <div class="sm:hidden">
      <label for="tabs" class="sr-only">Select a tab</label>
      <select
        id="tabs"
        name="tabs"
        class="block w-full rounded-md border-gray-300 focus:border-blue-500 focus:ring-blue-500 dark:border-gray-700 dark:bg-blue-gray-800 dark:text-white"
        v-model="selectedTab"
        @change="navigateToTab"
      >
        <option v-for="tab in tabs" :key="tab.value" :value="tab.value">{{ tab.name }}</option>
      </select>
    </div>
    <div class="hidden sm:block">
      <div class="border-b border-gray-200 dark:border-gray-700">
        <nav class="-mb-px flex space-x-8" aria-label="Tabs">
          <router-link
            v-for="tab in tabs"
            :key="tab.value"
            :to="tab.href"
            :class="[
              tab.value === modelValue
                ? 'border-blue-500 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:border-gray-600 dark:hover:text-gray-300',
              'whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium'
            ]"
          >
            {{ tab.name }}
          </router-link>
        </nav>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'

interface Tab {
  name: string
  value: string
  href: string
}

const props = defineProps({
  modelValue: {
    type: String,
    required: true
  },
  tabs: {
    type: Array as () => Tab[],
    required: true
  }
})

defineEmits(['update:modelValue'])

const router = useRouter()
const selectedTab = ref(props.modelValue)

watch(() => props.modelValue, (newValue) => {
  selectedTab.value = newValue
})

const navigateToTab = () => {
  const selectedTabObj = props.tabs.find(tab => tab.value === selectedTab.value)
  if (selectedTabObj) {
    router.push(selectedTabObj.href)
  }
}
</script>
