<script setup lang="ts">
import { ref, computed, onMounted, nextTick, onUnmounted } from 'vue'
import { useHead } from '@vueuse/head'
import CodeEditor from '../../../components/Dashboard/CodeEditor.vue'
// import { useToast } from 'vue-toastification'

// const toast = useToast()
const envValues = ref('')
const searchQuery = ref('')
const showAddModal = ref(false)
const isLoading = ref(false)
const showBackup = ref(false)
const backupContent = ref('')

// New variable form
const newVariable = ref({
  key: '',
  value: '',
  description: ''
})

useHead({
  title: 'Dashboard - Environment',
})

// Platform detection for keyboard shortcuts
const isMac = computed(() => (typeof window !== 'undefined' && window.navigator?.platform?.toLowerCase().includes('mac')) ?? false)

// Filter env variables based on search
const filteredEnvValues = computed(() => {
  if (!searchQuery.value) return envValues.value

  return envValues.value.split('\n')
    .filter(line => line.toLowerCase().includes(searchQuery.value.toLowerCase()))
    .join('\n')
})

// Get line numbers including empty lines
const lineNumbers = computed(() => {
  const count = (envValues.value.match(/\n/g) || []).length + 1
  return Array.from({ length: count }, (_, i) => i + 1)
})

// Syntax highlight the content
const highlightedContent = computed(() => {
  return envValues.value.split('\n').map(line => {
    const trimmed = line.trim()
    // Empty line
    if (!trimmed) return '&nbsp;'
    // Comments
    if (trimmed.startsWith('#')) {
      return `<span class="text-gray-500 dark:text-gray-400">${line}</span>`
    }
    // Variable assignments
    if (line.includes('=')) {
      const parts = line.split('=')
      const key = parts[0]?.trim() || ''
      const value = parts.slice(1).join('=').trim()

      // Highlight true/false values
      let highlightedValue = value
      if (value.toLowerCase() === 'true') {
        highlightedValue = `<span class="text-green-600 dark:text-green-400">${value}</span>`
      } else if (value.toLowerCase() === 'false') {
        highlightedValue = `<span class="text-red-600 dark:text-red-400">${value}</span>`
      } else if (value.startsWith('"') || value.startsWith("'")) {
        // String values
        highlightedValue = `<span class="text-yellow-600 dark:text-yellow-400">${value}</span>`
      } else if (!isNaN(Number(value))) {
        // Numeric values
        highlightedValue = `<span class="text-purple-600 dark:text-purple-400">${value}</span>`
      }

      return `<span class="text-blue-600 dark:text-blue-400">${key}</span><span class="text-gray-400">=</span>${highlightedValue}`
    }
    return line
  }).join('\n')
})

// Track cursor position for active line
const updateActiveLine = (event: Event) => {
  const textarea = event.target as HTMLTextAreaElement
  const value = textarea.value
  const selectionStart = textarea.selectionStart
  activeLine.value = value.substr(0, selectionStart).split('\n').length
}

// Keyboard shortcuts
const handleKeyboardShortcuts = (e: KeyboardEvent) => {
  const isCmdOrCtrl = isMac.value ? e.metaKey : e.ctrlKey

  if (isCmdOrCtrl) {
    if (e.key === 's') {
      e.preventDefault()
      handleSave()
    } else if (e.key === 'n') {
      e.preventDefault()
      showAddModal.value = true
    } else if (e.key === 'F' && e.shiftKey) {
      e.preventDefault()
      formatContent()
    }
  }
}

// Format content function
const formatContent = () => {
  const currentValue = envValues.value
  if (!currentValue) return

  const lines = currentValue.split('\n')
  const formattedLines = lines.map(line => {
    // Skip empty lines and comments
    if (!line.trim() || line.trim().startsWith('#')) return line

    const parts = line.split('=')
    if (parts.length < 2) return line

    const key = parts[0].trim()
    const value = parts.slice(1).join('=').trim()
    return `${key}=${value}`
  })

  envValues.value = formattedLines.join('\n')
}

// Enhanced validation
const validateEnv = (content: string) => {
  const lines = content.split('\n')
  const errors: string[] = []
  const keys = new Set<string>()

  lines.forEach((line, index) => {
    if (line.trim() && !line.startsWith('#')) {
      if (!line.includes('=')) {
        errors.push(`Line ${index + 1}: Missing '=' separator`)
      } else if (line.trim().endsWith('=')) {
        errors.push(`Line ${index + 1}: Empty value`)
      } else {
        const parts = line.split('=')
        const key = parts[0]?.trim() ?? ''
        if (keys.has(key)) {
          errors.push(`Line ${index + 1}: Duplicate key '${key}'`)
        }
        if (!/^[A-Z_][A-Z0-9_]*$/.test(key)) {
          errors.push(`Line ${index + 1}: Invalid key format '${key}'. Use uppercase letters, numbers, and underscores only`)
        }
        keys.add(key)
      }
    }
  })

  return errors
}

// Save changes with error handling
const handleSave = async () => {
  isLoading.value = true
  try {
    const errors = validateEnv(envValues.value)
    if (errors.length) {
      // errors.forEach(error => toast.error(error))
      return
    }

    formatContent() // Format before saving
    await new Promise(resolve => setTimeout(resolve, 1000))
    // toast.success('Environment variables saved successfully')

    // Create backup
    backupContent.value = envValues.value
  } catch (error) {
    // toast.error('Failed to save environment variables')
  } finally {
    isLoading.value = false
  }
}

// Add new variable with enhanced validation
const addVariable = () => {
  if (!newVariable.value.key || !newVariable.value.value) {
    // toast.error('Both key and value are required')
    return
  }

  // Validate key format
  if (!/^[A-Z_][A-Z0-9_]*$/.test(newVariable.value.key)) {
    // toast.error('Invalid key format. Use uppercase letters, numbers, and underscores only')
    return
  }

  const newLine = `${newVariable.value.key}=${newVariable.value.value}`
  const description = newVariable.value.description
    ? `# ${newVariable.value.description}\n`
    : ''

  envValues.value = envValues.value.trim() + '\n\n' + description + newLine

  newVariable.value = { key: '', value: '', description: '' }
  showAddModal.value = false
  // toast.success('Variable added successfully')
}

// Restore backup with confirmation
const restoreBackup = () => {
  if (backupContent.value) {
    envValues.value = backupContent.value
    showBackup.value = false
    // toast.success('Backup restored successfully')
  }
}

// Handle scroll sync between editor and syntax highlighting
const handleScroll = (event: Event) => {
  const textarea = event.target as HTMLTextAreaElement
  const pre = textarea.previousElementSibling
  if (pre instanceof HTMLPreElement) {
    pre.scrollTop = textarea.scrollTop
  }
}

// Focus editor on mount
onMounted(() => {
  nextTick(() => {
    editor.value?.focus()
  })
  window.addEventListener('keydown', handleKeyboardShortcuts)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyboardShortcuts)
})
</script>

<template>
  <div class="min-h-screen py-4 dark:bg-blue-gray-800 lg:py-8">
    <div class="px-4 lg:px-8 sm:px-6">
      <div class="sm:flex sm:items-center">
        <div class="sm:flex-auto">
          <h1 class="text-base text-gray-900 dark:text-gray-100 font-semibold leading-6">
            Environment Variables
          </h1>
          <p class="mt-2 text-sm text-gray-700 dark:text-gray-300">
            This is your project's <code class="text-red-400">.env</code> file. Be careful when editing production values.
          </p>
        </div>
        <div class="mt-4 sm:ml-16 sm:mt-0 sm:flex-none space-x-3">
          <button
            @click="showAddModal = true"
            type="button"
            class="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            Add Variable
          </button>
          <button
            v-if="backupContent"
            @click="showBackup = true"
            type="button"
            class="rounded-md bg-gray-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-gray-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-600"
          >
            Show Backup
          </button>
        </div>
      </div>

      <div class="mt-8 flow-root">
        <div class="overflow-x-auto -mx-4 -my-2 lg:-mx-8 sm:-mx-6">
          <div class="inline-block min-w-full py-2 align-middle lg:px-8 sm:px-6">
            <div class="overflow-hidden sm:rounded-lg">
              <form @submit.prevent="handleSave" class="relative">
                <CodeEditor
                  v-model="envValues"
                  :loading="isLoading"
                  language="env"
                  :line-numbers="true"
                  :keyboard-shortcuts="true"
                  @save="handleSave"
                  @format="formatContent"
                />

                <!-- Keyboard shortcuts -->
                <div class="mt-2 mb-4 flex items-center text-sm text-gray-500 dark:text-gray-400 space-x-4">
                  <div class="flex items-center space-x-1">
                    <kbd class="px-1.5 py-0.5 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded dark:bg-gray-700 dark:text-gray-100 dark:border-gray-600">{{ isMac ? '⌘' : 'Ctrl' }}</kbd>
                    <span>+</span>
                    <kbd class="px-1.5 py-0.5 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded dark:bg-gray-700 dark:text-gray-100 dark:border-gray-600">S</kbd>
                    <span class="text-xs">save</span>
                  </div>
                  <div class="flex items-center space-x-1">
                    <kbd class="px-1.5 py-0.5 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded dark:bg-gray-700 dark:text-gray-100 dark:border-gray-600">{{ isMac ? '⌘' : 'Ctrl' }}</kbd>
                    <span>+</span>
                    <kbd class="px-1.5 py-0.5 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded dark:bg-gray-700 dark:text-gray-100 dark:border-gray-600">N</kbd>
                    <span class="text-xs">new</span>
                  </div>
                  <div class="flex items-center space-x-1">
                    <kbd class="px-1.5 py-0.5 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded dark:bg-gray-700 dark:text-gray-100 dark:border-gray-600">{{ isMac ? '⌘' : 'Ctrl' }}</kbd>
                    <span>+</span>
                    <kbd class="px-1.5 py-0.5 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded dark:bg-gray-700 dark:text-gray-100 dark:border-gray-600">⇧</kbd>
                    <span>+</span>
                    <kbd class="px-1.5 py-0.5 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded dark:bg-gray-700 dark:text-gray-100 dark:border-gray-600">F</kbd>
                    <span class="text-xs">format</span>
                  </div>
                </div>

                <!-- Action buttons -->
                <div class="mt-4 flex justify-end space-x-3">
                  <button
                    type="button"
                    @click="formatContent"
                    class="rounded-md px-3 py-2 text-sm font-semibold text-gray-900 dark:text-gray-100 shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-blue-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  >
                    Format
                  </button>
                  <button
                    type="button"
                    @click="envValues = ''"
                    class="rounded-md px-3 py-2 text-sm font-semibold text-gray-900 dark:text-gray-100 shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-blue-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  >
                    Clear
                  </button>
                  <button
                    type="submit"
                    :disabled="isLoading"
                    class="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span v-if="isLoading" class="flex items-center space-x-2">
                      <div class="i-hugeicons-arrow-path h-4 w-4 animate-spin" />
                      <span>Saving...</span>
                    </span>
                    <span v-else>Save Changes</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Add Variable Modal -->
    <div v-if="showAddModal" class="relative z-10" aria-labelledby="modal-title" role="dialog" aria-modal="true">
      <div class="fixed inset-0 bg-gray-500 dark:bg-gray-900 bg-opacity-75 dark:bg-opacity-75 transition-opacity"></div>

      <div class="fixed inset-0 z-10 overflow-y-auto">
        <div class="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
          <div class="relative transform overflow-hidden rounded-lg bg-white dark:bg-blue-gray-700 px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
            <div>
              <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-gray-100">Add Environment Variable</h3>
              <div class="mt-4 space-y-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Key</label>
                  <input
                    v-model="newVariable.key"
                    type="text"
                    class="mt-1 block w-full rounded-md border-0 py-1.5 text-gray-900 dark:text-gray-100 dark:bg-blue-gray-600 shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-gray-600 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                    placeholder="APP_NAME"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Value</label>
                  <input
                    v-model="newVariable.value"
                    type="text"
                    class="mt-1 block w-full rounded-md border-0 py-1.5 text-gray-900 dark:text-gray-100 dark:bg-blue-gray-600 shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-gray-600 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                    placeholder="My App"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Description (optional)</label>
                  <input
                    v-model="newVariable.description"
                    type="text"
                    class="mt-1 block w-full rounded-md border-0 py-1.5 text-gray-900 dark:text-gray-100 dark:bg-blue-gray-600 shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-gray-600 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                    placeholder="Application name used in emails and UI"
                  />
                </div>
              </div>
            </div>
            <div class="mt-5 sm:mt-6 sm:grid sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-3">
              <button
                type="button"
                class="inline-flex w-full justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 sm:col-start-2"
                @click="addVariable"
              >
                Add
              </button>
              <button
                type="button"
                class="mt-3 inline-flex w-full justify-center rounded-md bg-white dark:bg-blue-gray-600 px-3 py-2 text-sm font-semibold text-gray-900 dark:text-gray-100 shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-blue-gray-500 sm:col-start-1 sm:mt-0"
                @click="showAddModal = false"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Backup Modal -->
    <div v-if="showBackup" class="relative z-10" aria-labelledby="modal-title" role="dialog" aria-modal="true">
      <div class="fixed inset-0 bg-gray-500 dark:bg-gray-900 bg-opacity-75 dark:bg-opacity-75 transition-opacity"></div>

      <div class="fixed inset-0 z-10 overflow-y-auto">
        <div class="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
          <div class="relative transform overflow-hidden rounded-lg bg-white dark:bg-blue-gray-700 px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
            <div>
              <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-gray-100">Backup Content</h3>
              <div class="mt-4">
                <textarea
                  v-model="backupContent"
                  rows="10"
                  class="block w-full rounded-md border-0 py-1.5 text-gray-900 dark:text-gray-100 dark:bg-blue-gray-600 shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-gray-600 font-mono text-sm placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600"
                  readonly
                />
              </div>
            </div>
            <div class="mt-5 sm:mt-6 sm:grid sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-3">
              <button
                type="button"
                class="inline-flex w-full justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 sm:col-start-2"
                @click="restoreBackup"
              >
                Restore Backup
              </button>
              <button
                type="button"
                class="mt-3 inline-flex w-full justify-center rounded-md bg-white dark:bg-blue-gray-600 px-3 py-2 text-sm font-semibold text-gray-900 dark:text-gray-100 shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-blue-gray-500 sm:col-start-1 sm:mt-0"
                @click="showBackup = false"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
