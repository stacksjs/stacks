<script setup lang="ts">
/**
 * Dashboard Layout Component
 * A unified layout wrapper that combines the modern sidebar and navbar
 * for consistent dashboard page structure.
 */
import { ref, computed, provide, onMounted, onUnmounted } from 'vue'
import { useLocalStorage, useDark, useMediaQuery } from '@vueuse/core'
import SidebarModern from './SidebarModern.vue'
import NavbarModern from './NavbarModern.vue'

interface Props {
  // Page-level settings
  pageTitle?: string
  pageDescription?: string
  // Layout options
  showSidebar?: boolean
  showNavbar?: boolean
  showWindowControls?: boolean
  // Content options
  fullWidth?: boolean
  noPadding?: boolean
  // Background customization (for window controls color extraction)
  backgroundImage?: string
}

const props = withDefaults(defineProps<Props>(), {
  showSidebar: true,
  showNavbar: true,
  showWindowControls: true, // Enable macOS window controls by default
  fullWidth: false,
  noPadding: false,
})

const emit = defineEmits<{
  (e: 'minimize'): void
  (e: 'maximize'): void
  (e: 'close'): void
}>()

// Sidebar state
const isSidebarCollapsed = useLocalStorage('sidebar-collapsed-modern', false)
const isMobileMenuOpen = ref(false)
const isDark = useDark()

// Responsive detection
const isMobile = useMediaQuery('(max-width: 1023px)')
const isDesktop = computed(() => !isMobile.value)

// Sidebar width calculation
const sidebarWidth = computed(() => {
  if (isMobile.value) return 0
  return isSidebarCollapsed.value ? 64 : 256
})

// Provide layout context to child components
provide('isDark', isDark)
provide('isSidebarCollapsed', isSidebarCollapsed)
provide('isMobile', isMobile)

// Mobile menu handling
function openMobileMenu() {
  isMobileMenuOpen.value = true
}

function closeMobileMenu() {
  isMobileMenuOpen.value = false
}

// Handle escape key for mobile menu
function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && isMobileMenuOpen.value) {
    closeMobileMenu()
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
})

// Window control handlers
function handleMinimize() {
  emit('minimize')
}

function handleMaximize() {
  emit('maximize')
}

function handleClose() {
  emit('close')
}
</script>

<template>
  <!-- macOS-inspired layout with subtle background -->
  <div class="min-h-screen bg-neutral-100 dark:bg-neutral-950">
    <!-- Mobile sidebar overlay -->
    <Transition
      enter-active-class="transition-opacity duration-300 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-200 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="isMobileMenuOpen && isMobile"
        class="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
        @click="closeMobileMenu"
      />
    </Transition>

    <!-- Mobile sidebar -->
    <Transition
      enter-active-class="transition-transform duration-300 ease-out"
      enter-from-class="-translate-x-full"
      enter-to-class="translate-x-0"
      leave-active-class="transition-transform duration-200 ease-in"
      leave-from-class="translate-x-0"
      leave-to-class="-translate-x-full"
    >
      <div
        v-if="isMobileMenuOpen && isMobile && showSidebar"
        class="fixed inset-y-0 left-0 z-50 w-64 lg:hidden"
      >
        <SidebarModern @close="closeMobileMenu" />
      </div>
    </Transition>

    <!-- Desktop sidebar -->
    <SidebarModern v-if="showSidebar && isDesktop" />

    <!-- Main content area -->
    <div
      :class="[
        'flex flex-col min-h-screen transition-all duration-300',
        showSidebar && isDesktop ? 'lg:pl-64' : '',
        isSidebarCollapsed && isDesktop ? '!lg:pl-16' : '',
      ]"
      :style="{ paddingLeft: showSidebar && isDesktop ? `${sidebarWidth}px` : '0' }"
    >
      <!-- Navbar -->
      <NavbarModern
        v-if="showNavbar"
        :show-window-controls="showWindowControls"
        @minimize="handleMinimize"
        @maximize="handleMaximize"
        @close="handleClose"
        @open-mobile-menu="openMobileMenu"
      />

      <!-- Page header slot -->
      <div v-if="$slots.header" class="border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
        <div
          :class="[
            'px-4 lg:px-6 py-4',
            fullWidth ? '' : 'max-w-7xl mx-auto',
          ]"
        >
          <slot name="header">
            <!-- Default page header -->
            <div v-if="pageTitle" class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h1 class="text-2xl font-semibold text-neutral-900 dark:text-white">
                  {{ pageTitle }}
                </h1>
                <p v-if="pageDescription" class="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                  {{ pageDescription }}
                </p>
              </div>
              <slot name="header-actions" />
            </div>
          </slot>
        </div>
      </div>

      <!-- Main content -->
      <main
        :class="[
          'flex-1',
          noPadding ? '' : 'px-4 lg:px-6 py-6',
        ]"
      >
        <div
          :class="[
            fullWidth ? '' : 'max-w-7xl mx-auto',
          ]"
        >
          <slot />
        </div>
      </main>

      <!-- Footer slot -->
      <footer v-if="$slots.footer" class="border-t border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
        <div
          :class="[
            'px-4 lg:px-6 py-4',
            fullWidth ? '' : 'max-w-7xl mx-auto',
          ]"
        >
          <slot name="footer" />
        </div>
      </footer>
    </div>

    <!-- Global overlays/modals slot -->
    <slot name="overlays" />
  </div>
</template>
