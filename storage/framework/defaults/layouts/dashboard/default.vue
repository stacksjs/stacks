<script setup lang="ts">
/**
 * Dashboard Default Layout - macOS Style
 * Uses the modern DashboardLayout component for consistent styling.
 */
import DashboardLayout from '../../components/Dashboard/DashboardLayout.vue'

// Window control handlers for Tauri/Electron integration
function handleMinimize() {
  // @ts-ignore - Tauri API
  if (window.__TAURI__) {
    window.__TAURI__.window.appWindow.minimize()
  }
}

function handleMaximize() {
  // @ts-ignore - Tauri API
  if (window.__TAURI__) {
    window.__TAURI__.window.appWindow.toggleMaximize()
  }
}

function handleClose() {
  // @ts-ignore - Tauri API
  if (window.__TAURI__) {
    window.__TAURI__.window.appWindow.close()
  }
}
</script>

<template>
  <DashboardLayout
    :show-window-controls="true"
    @minimize="handleMinimize"
    @maximize="handleMaximize"
    @close="handleClose"
  >
    <RouterView v-slot="{ Component }">
      <Transition mode="out-in">
        <Suspense timeout="0">
          <Component :is="Component" />
          <template #fallback>
            <div class="flex items-center justify-center py-12">
              <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
            </div>
          </template>
        </Suspense>
      </Transition>
    </RouterView>

    <!-- Global toast notifications -->
    <template #overlays>
      <Toast />
    </template>
  </DashboardLayout>
</template>

<style>
body {
  @apply bg-neutral-100 dark:bg-neutral-950;
}

.v-enter-active,
.v-leave-active {
  transition: opacity 0.15s ease-in-out;
}

.v-enter-from,
.v-leave-to {
  opacity: 0;
}
</style>
