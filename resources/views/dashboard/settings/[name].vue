<script setup lang="ts">
const settingsMenuOptions = [
  {
    label: 'AI',
    path: 'ai',
    icon: {
      name: 'cpu-chip',
      source: 'heroicons',
    },
  },
  {
    label: 'Analytics',
    path: 'analytics',
    icon: {
      name: 'square-3-stack-3d',
      source: 'heroicons',
    },
  },
  {
    label: 'App',
    path: 'app',
    icon: {
      name: 'square-3-stack-3d',
      source: 'heroicons',
    },
  },
  {
    label: 'Cache',
    path: 'cache',
    icon: {
      name: 'square-3-stack-3d',
      source: 'heroicons',
    },
  },
  {
    label: 'CLI',
    path: 'cli',
    icon: {
      name: 'square-3-stack-3d',
      source: 'heroicons',
    },
  },
  {
    label: 'Cloud',
    path: 'cloud',
    icon: {
      name: 'square-3-stack-3d',
      source: 'heroicons',
    },
  },
  {
    label: 'Database',
    path: 'database',
    icon: {
      name: 'square-3-stack-3d',
      source: 'heroicons',
    },
  },
  {
    label: 'DNS',
    path: 'dns',
    icon: {
      name: 'square-3-stack-3d',
      source: 'heroicons',
    },
  },
  {
    label: 'Email',
    path: 'email',
    icon: {
      name: 'square-3-stack-3d',
      source: 'heroicons',
    },
  },
  {
    label: 'File System',
    path: 'file-system',
    icon: {
      name: 'square-3-stack-3d',
      source: 'heroicons',
    },
  },
  {
    label: 'Hashing',
    path: 'hashing',
    icon: {
      name: 'square-3-stack-3d',
      source: 'heroicons',
    },
  },
  {
    label: 'Languages',
    path: 'languages',
    icon: {
      name: 'square-3-stack-3d',
      source: 'heroicons',
    },
  },
  {
    label: 'Library',
    path: 'library',
    icon: {
      name: 'square-3-stack-3d',
      source: 'heroicons',
    },
  },
  {
    label: 'Native',
    path: 'native',
    icon: {
      name: 'square-3-stack-3d',
      source: 'heroicons',
    },
  },
  {
    label: 'Mail',
    path: 'mail',
    icon: {
      name: 'square-3-stack-3d',
      source: 'heroicons',
    },
  },
  {
    label: 'Queue',
    path: 'queue',
    icon: {
      name: 'square-3-stack-3d',
      source: 'heroicons',
    },
  },
  {
    label: 'Search Engine',
    path: 'search-engine',
    icon: {
      name: 'square-3-stack-3d',
      source: 'heroicons',
    },
  },
  {
    label: 'Search Engine',
    path: 'search-engine',
    icon: {
      name: 'square-3-stack-3d',
      source: 'heroicons',
    },
  },
  {
    label: 'Security',
    path: 'security',
    icon: {
      name: 'square-3-stack-3d',
      source: 'heroicons',
    },
  },
  {
    label: 'Services',
    path: 'services',
    icon: {
      name: 'square-3-stack-3d',
      source: 'heroicons',
    },
  },
  {
    label: 'Storage',
    path: 'storage',
    icon: {
      name: 'square-3-stack-3d',
      source: 'heroicons',
    },
  },
  {
    label: 'Team',
    path: 'team',
    icon: {
      name: 'square-3-stack-3d',
      source: 'heroicons',
    },
  },
  {
    label: 'UI',
    path: 'ui',
    icon: {
      name: 'square-3-stack-3d',
      source: 'heroicons',
    },
  },
]

const router = useRouter()
// get the [name] of current route
const name = computed(() => router.currentRoute.value.params.name)

// const sideMenuOptions = computed(() => settingsMenuOptions)

// set the title of the page
useHead({
  title: `Dashboard Settings - ${name.value}`,
})
</script>

<template>
  <main>
    <div class="flex gap-x-4">
      <SettingsSidebar :menu-options="settingsMenuOptions" />

      <div class="container mx-auto">
        Generic Page here for settings {{ name }}
      </div>
    </div>
  </main>
</template>
