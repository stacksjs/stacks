<script setup lang="ts">
import AIForm from './Forms/AIForm.vue'
import AnalyticsForm from './Forms/AnalyticsForm.vue'
import AppForm from './Forms/AppForm.vue'
import CacheForm from './Forms/CacheForm.vue'
import CliForm from './Forms/CLIForm.vue'
import CloudForm from './Forms/CloudForm.vue'
import DatabaseForm from './Forms/DatabaseForm.vue'
import DNSForm from './Forms/DNSForm.vue'
import EmailForm from './Forms/EmailForm.vue'
import FileSystemForm from './Forms/FileSystemForm.vue'
import HashingForm from './Forms/HashingForm.vue'
import LibraryForm from './Forms/LibraryForm.vue'
import QueueForm from './Forms/QueueForm.vue'
import SearchEngineForm from './Forms/SearchEngineForm.vue'
import SecurityForm from './Forms/SecurityForm.vue'

const props = defineProps({
  name: String,
})
const { name } = toRefs(props)
const options = [
  {
    key: 'ai',
    label: 'AI',
  },
  {
    key: 'analytics',
    label: 'Analytics',
  },
  {
    key: 'app',
    label: 'App',
  },
  {
    key: 'cache',
    label: 'Cache',
  },
  {
    key: 'cli',
    label: 'CLI',
  },
  {
    key: 'cloud',
    label: 'Cloud',
  },
  {
    key: 'database',
    label: 'Database',
  },
  {
    key: 'dns',
    label: 'DNS',
  },
  {
    key: 'email',
    label: 'Email',
  },
  {
    key: 'file-system',
    label: 'File System',
  },
  {
    key: 'hashing',
    label: 'Hashing',
  },
  {
    key: 'languages',
    label: 'Languages',
  },
  {
    key: 'library',
    label: 'Library',
  },
  {
    key: 'native',
    label: 'Native',
  },
  {
    key: 'mail',
    label: 'Mail',
  },
  {
    key: 'queue',
    label: 'Queue',
  },
  {
    key: 'search-engine',
    label: 'Search Engine',
  },
  {
    key: 'security',
    label: 'Security',
  },
  {
    key: 'services',
    label: 'Services',
  },
  {
    key: 'storage',
    label: 'Storage',
  },
  {
    key: 'team',
    label: 'Team',
  },
  {
    key: 'ui',
    label: 'UI',
  },
]
const pageTitle = computed < String > (() => options.find(option => option.key === name.value)?.label || name.value)
</script>

<template>
  <main>
    <div class="bg-white shadow-sm ring-1 ring-gray-900/5 sm:rounded-xl md:col-span-2 px-4 py-6 sm:px-6 lg:px-8">
      <h2 class="text-base font-semibold leading-7 text-gray-900">
        {{ pageTitle }} Configuration
      </h2>
      <p class="mt-1 text-sm leading-6 text-gray-600">
        This configuration defines all of your {{ pageTitle }} options.
      </p>

      <div class="mt-10">
        <template v-if="name === 'ai'"><AIForm /></template>
        <template v-else-if="name === 'analytics'"><AnalyticsForm /></template>
        <template v-else-if="name === 'app'"><AppForm /></template>
        <template v-else-if="name === 'cache'"><CacheForm /></template>
        <template v-else-if="name === 'cli'"><CliForm /></template>
        <template v-else-if="name === 'cloud'"><CloudForm /></template>
        <template v-else-if="name === 'database'"><DatabaseForm /></template>
        <template v-else-if="name === 'dns'"><DNSForm /></template>
        <template v-else-if="name === 'email'"><EmailForm /></template>
        <template v-else-if="name === 'file-system'"><FileSystemForm /></template>
        <template v-else-if="name === 'hashing'"><HashingForm /></template>
        <template v-else-if="name === 'library'"><LibraryForm /></template>
        <template v-else-if="name === 'queue'"><QueueForm /></template>
        <template v-else-if="name === 'search-engine'"><SearchEngineForm /></template>
        <template v-else-if="name === 'security'"><SecurityForm /></template>
        <template v-else>
          <div class="text-center">
            <div class="i-heroicons-cog-8-tooth text-gray-400 w-12 h-12 dark:text-gray-200 transition-all duration-150 ease-in-out" />
            <h3 class="mt-2 text-sm font-semibold text-gray-900">
              Settings <span class="font-bold">{{ pageTitle }}</span> Form not created yet
            </h3>
            <p class="mt-1 text-sm text-gray-500">
              Please ask the maintenance team to fix.
            </p>
          </div>
        </template>
      </div>
    </div>
  </main>
</template>

<style scoped>

</style>
