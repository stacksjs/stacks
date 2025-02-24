<script setup lang="ts">
defineProps({
  live: Boolean,
  path: {
    type: String,
    default: '~/Code/stacks',
  },
  branch: {
    type: String,
    default: 'main',
  },
  version: {
    type: String,
    default: 'v1.2.3',
  },
})
</script>

<template>
  <div class="font-mono">
    <div class="h-full w-full flex flex-col rounded-lg bg-[#0D1117] text-[#C9D1D9] shadow">
      <!-- Terminal Header -->
      <header class="flex items-center justify-between rounded-t-lg bg-[#161B22] px-3 py-2">
        <div class="flex items-center gap-2">
          <div class="h-3 w-3 rounded-full bg-[#FF5F56]" />
          <div class="h-3 w-3 rounded-full bg-[#FFBD2E]" />
          <div class="h-3 w-3 rounded-full bg-[#27C93F]" />
        </div>
        <div class="absolute left-1/2 -translate-x-1/2 text-sm text-[#8B949E]">
          📁 {{ path }}
        </div>
      </header>

      <!-- Terminal Content -->
      <div class="p-4 text-sm leading-6">
        <div class="flex items-center gap-2 text-[#C9D1D9]">
          <span class="text-[#8B949E]">{{ path }}</span>
          <span>on</span>
          <span class="flex items-center gap-1">
            <span class="text-[#7EE787]">{{ branch }}</span>
          </span>
          <span>via</span>
          <span class="flex items-center gap-1">
            <span class="text-[#8B949E]">🐰</span>
            <span class="text-[#FF7B72]">{{ version }}</span>
          </span>
        </div>

        <div class="flex items-center gap-2 text-[#C9D1D9] mt-1">
          <span class="text-[#8B949E]">❯</span>
          <span>ls</span>
        </div>

        <div class="mt-2 grid grid-cols-4 gap-4">
          <div v-for="file in [
            'CHANGELOG.md', 'LICENSE.md', 'README.md', 'app',
            'bootstrap', 'buddy', 'cloud', 'commitlint.config.ts',
            'bun.lock', 'bunfig.toml', 'config', 'database',
            'docs', 'eslint.config.ts', 'node_modules', 'package.json',
            'pkgx.yaml', 'public', 'resources', 'routes',
            'storage', 'tests', 'tsconfig.json', '~'
          ]" :key="file" class="text-[#C9D1D9]">
            {{ file }}
          </div>
        </div>

        <div class="flex items-center gap-2 text-[#C9D1D9] mt-4">
          <span class="text-[#8B949E]">{{ path }}</span>
          <span>on</span>
          <span class="flex items-center gap-1">
            <span class="text-[#7EE787]">{{ branch }}</span>
          </span>
          <span>via</span>
          <span class="flex items-center gap-1">
            <span class="text-[#8B949E]">🐰</span>
            <span class="text-[#FF7B72]">{{ version }}</span>
          </span>
        </div>

        <div class="flex items-center gap-2 text-[#C9D1D9] mt-1">
          <span class="text-[#8B949E]">❯</span>
          <input
            type="text"
            class="flex-1 bg-transparent border-0 outline-0 focus:outline-0 focus:ring-0 active:outline-0 active:ring-0"
            style="-webkit-tap-highlight-color: transparent;"
          >
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}

.cli-cursor {
  opacity: 1;
}

.cursor-blink {
  animation: blink 1s step-end infinite;
}
</style>
