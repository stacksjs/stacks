<script setup lang="ts">
/**
 * Modern Navbar Component
 * A cleaner, more refined navigation header with improved UX.
 */
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useDark, useLocalStorage } from '@vueuse/core'
import Avatar from './UI/Avatar.vue'
import Dropdown from './UI/Dropdown.vue'
import DropdownItem from './UI/DropdownItem.vue'
import WindowControls from './UI/WindowControls.vue'

interface Props {
  showWindowControls?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  showWindowControls: false,
})

const emit = defineEmits<{
  (e: 'minimize'): void
  (e: 'maximize'): void
  (e: 'close'): void
  (e: 'openMobileMenu'): void
}>()

const router = useRouter()
const route = useRoute()
const isDark = useDark()

// Search state
const searchQuery = ref('')
const isSearchFocused = ref(false)

// Sidebar collapsed state sync
const isSidebarCollapsed = useLocalStorage('sidebar-collapsed-modern', false)

// Notifications count (would come from real data)
const notificationCount = ref(3)

// Quick actions using Command+K
const showCommandPalette = ref(false)

// User data (would come from auth)
const user = ref({
  name: 'Chris Breuer',
  email: 'chris@stacksjs.org',
  avatar: 'https://avatars.githubusercontent.com/u/6228425',
})

// Breadcrumb
const breadcrumb = computed(() => {
  const parts = route.path.split('/').filter(Boolean)
  return parts.map((part, index) => ({
    label: part.charAt(0).toUpperCase() + part.slice(1).replace(/-/g, ' '),
    path: '/' + parts.slice(0, index + 1).join('/'),
    isLast: index === parts.length - 1,
  }))
})

// Keyboard shortcut for search
function handleKeydown(event: KeyboardEvent) {
  // Cmd/Ctrl + K for command palette
  if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
    event.preventDefault()
    showCommandPalette.value = !showCommandPalette.value
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
})

// Navigation actions
function navigateTo(path: string) {
  router.push(path)
}

async function handleLogout() {
  // Would call actual logout function
  router.push('/login')
}

function toggleDark() {
  isDark.value = !isDark.value
}

function isActiveRoute(path: string): boolean {
  return route.path === path || route.path.startsWith(path + '/')
}
</script>

<template>
  <header
    :class="[
      'sticky top-0 z-40',
      'h-13 flex items-center gap-3',
      // macOS vibrancy toolbar
      'bg-white/72 dark:bg-neutral-900/80',
      'backdrop-blur-xl backdrop-saturate-150',
      'border-b border-black/5 dark:border-white/5',
      'px-4',
      'transition-all duration-200',
    ]"
  >
    <!-- Window Controls (for desktop app) -->
    <div v-if="showWindowControls" class="flex items-center mr-2">
      <WindowControls
        variant="macos"
        size="sm"
        @minimize="$emit('minimize')"
        @maximize="$emit('maximize')"
        @close="$emit('close')"
      />
    </div>

    <!-- Mobile menu button -->
    <button
      type="button"
      class="lg:hidden p-2 -ml-2 rounded-lg text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:text-neutral-200 dark:hover:bg-neutral-800 transition-colors"
      @click="emit('openMobileMenu')"
    >
      <span class="sr-only">Open sidebar</span>
      <div class="i-hugeicons-menu-01 w-5 h-5" />
    </button>

    <!-- Breadcrumb -->
    <nav v-if="breadcrumb.length > 0" class="hidden lg:flex items-center gap-1 text-sm">
      <RouterLink
        to="/"
        class="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
      >
        <div class="i-hugeicons-home-02 w-4 h-4" />
      </RouterLink>
      <template v-for="(crumb, index) in breadcrumb" :key="crumb.path">
        <span class="text-neutral-300 dark:text-neutral-600">/</span>
        <RouterLink
          v-if="!crumb.isLast"
          :to="crumb.path"
          class="text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200 transition-colors"
        >
          {{ crumb.label }}
        </RouterLink>
        <span v-else class="text-neutral-700 dark:text-neutral-200 font-medium">
          {{ crumb.label }}
        </span>
      </template>
    </nav>

    <!-- Spacer -->
    <div class="flex-1" />

    <!-- Search - macOS Spotlight style -->
    <div class="hidden sm:flex items-center">
      <div
        :class="[
          'relative flex items-center',
          'w-56 lg:w-72',
          'transition-all duration-200',
          isSearchFocused ? 'w-64 lg:w-80' : '',
        ]"
      >
        <div class="i-hugeicons-search-01 absolute left-2.5 w-3.5 h-3.5 text-neutral-400" />
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search"
          class="w-full pl-8 pr-16 py-1.5 text-[13px] bg-black/5 dark:bg-white/8 border border-black/8 dark:border-white/10 rounded-lg text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/50 transition-all"
          @focus="isSearchFocused = true"
          @blur="isSearchFocused = false"
        />
        <div class="absolute right-2.5 flex items-center gap-1">
          <kbd class="hidden lg:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-medium text-neutral-400 bg-black/5 dark:bg-white/10 border border-black/10 dark:border-white/10 rounded">
            <span>⌘</span>K
          </kbd>
        </div>
      </div>
    </div>

    <!-- Right section - macOS toolbar buttons -->
    <div class="flex items-center gap-1">
      <!-- Error Tracking -->
      <RouterLink
        to="/monitoring/errors"
        :class="[
          'p-1.5 rounded-md transition-all duration-150 active:scale-95',
          isActiveRoute('/monitoring/errors')
            ? 'text-blue-600 dark:text-blue-400 bg-blue-500/15 dark:bg-blue-400/15'
            : 'text-neutral-500 hover:text-neutral-700 hover:bg-black/5 dark:text-neutral-400 dark:hover:text-neutral-200 dark:hover:bg-white/8',
        ]"
      >
        <div class="i-hugeicons-bug-01 w-[18px] h-[18px]" />
      </RouterLink>

      <!-- Health -->
      <RouterLink
        to="/health"
        :class="[
          'p-1.5 rounded-md transition-all duration-150 active:scale-95',
          isActiveRoute('/health')
            ? 'text-blue-600 dark:text-blue-400 bg-blue-500/15 dark:bg-blue-400/15'
            : 'text-neutral-500 hover:text-neutral-700 hover:bg-black/5 dark:text-neutral-400 dark:hover:text-neutral-200 dark:hover:bg-white/8',
        ]"
      >
        <div class="i-hugeicons-pulse-02 w-[18px] h-[18px]" />
      </RouterLink>

      <!-- Notifications -->
      <RouterLink
        to="/notifications"
        :class="[
          'relative p-1.5 rounded-md transition-all duration-150 active:scale-95',
          isActiveRoute('/notifications')
            ? 'text-blue-600 dark:text-blue-400 bg-blue-500/15 dark:bg-blue-400/15'
            : 'text-neutral-500 hover:text-neutral-700 hover:bg-black/5 dark:text-neutral-400 dark:hover:text-neutral-200 dark:hover:bg-white/8',
        ]"
      >
        <div class="i-hugeicons-notification-02 w-[18px] h-[18px]" />
        <span
          v-if="notificationCount > 0"
          class="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[16px] h-4 px-1 text-[10px] font-bold text-white bg-red-500 rounded-full"
        >
          {{ notificationCount > 9 ? '9+' : notificationCount }}
        </span>
      </RouterLink>

      <!-- Dark mode toggle -->
      <button
        type="button"
        class="p-1.5 rounded-md text-neutral-500 hover:text-neutral-700 hover:bg-black/5 dark:text-neutral-400 dark:hover:text-neutral-200 dark:hover:bg-white/8 transition-all duration-150 active:scale-95"
        @click="toggleDark"
      >
        <div :class="[isDark ? 'i-hugeicons-sun-02' : 'i-hugeicons-moon-02', 'w-[18px] h-[18px]']" />
      </button>

      <!-- Separator -->
      <div class="w-px h-5 bg-black/10 dark:bg-white/10 mx-1" />

      <!-- User dropdown -->
      <Dropdown align="right" width="md">
        <template #trigger="{ isOpen }">
          <button
            type="button"
            :class="[
              'flex items-center gap-2 p-1.5 rounded-lg transition-colors',
              isOpen ? 'bg-neutral-100 dark:bg-neutral-800' : 'hover:bg-neutral-100 dark:hover:bg-neutral-800',
            ]"
          >
            <Avatar
              :src="user.avatar"
              :name="user.name"
              size="sm"
              status="online"
            />
            <div class="hidden lg:block text-left">
              <div class="text-sm font-medium text-neutral-700 dark:text-neutral-200">
                {{ user.name }}
              </div>
            </div>
            <div class="i-hugeicons-arrow-down-01 w-4 h-4 text-neutral-400 hidden lg:block" />
          </button>
        </template>

        <template #default="{ close }">
          <div class="px-4 py-3 border-b border-neutral-200 dark:border-neutral-700">
            <p class="text-sm font-medium text-neutral-900 dark:text-white">{{ user.name }}</p>
            <p class="text-xs text-neutral-500 dark:text-neutral-400 truncate">{{ user.email }}</p>
          </div>

          <div class="py-1">
            <DropdownItem as="router-link" to="/profile" @click="close">
              <template #icon>
                <div class="i-hugeicons-user-02 w-4 h-4" />
              </template>
              Your Profile
            </DropdownItem>

            <DropdownItem as="router-link" to="/settings" @click="close">
              <template #icon>
                <div class="i-hugeicons-settings-02 w-4 h-4" />
              </template>
              Settings
            </DropdownItem>

            <DropdownItem as="router-link" to="/billing" @click="close">
              <template #icon>
                <div class="i-hugeicons-credit-card w-4 h-4" />
              </template>
              Billing
            </DropdownItem>

            <DropdownItem as="a" href="https://docs.stacksjs.org" target="_blank" @click="close">
              <template #icon>
                <div class="i-hugeicons-book-02 w-4 h-4" />
              </template>
              Documentation
              <template #trailing>
                <div class="i-hugeicons-arrow-up-right-01 w-3 h-3 text-neutral-400" />
              </template>
            </DropdownItem>
          </div>

          <div class="border-t border-neutral-200 dark:border-neutral-700 py-1">
            <DropdownItem danger @click="handleLogout">
              <template #icon>
                <div class="i-hugeicons-logout-02 w-4 h-4" />
              </template>
              Sign out
            </DropdownItem>
          </div>
        </template>
      </Dropdown>
    </div>
  </header>
</template>
