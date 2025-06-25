<route lang="yaml">
  meta:
    requiresAuth: true
</route>

<script lang="ts" setup>
import { ref, computed } from 'vue'
import { useHead } from '@vueuse/head'
import { Doughnut } from 'vue-chartjs'
import { Chart as ChartJS, Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale, PointElement, LineElement, ArcElement } from 'chart.js'

// Register ChartJS components
ChartJS.register(Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale, PointElement, LineElement, ArcElement)

useHead({
  title: 'Dashboard - File Manager',
})

// File and folder interfaces
interface FileItem {
  id: number
  name: string
  type: string
  size: number
  path: string
  lastModified: string
  starred: boolean
  shared: boolean
}

interface FolderItem {
  id: number
  name: string
  type: 'folder'
  path: string
  lastModified: string
  starred: boolean
  shared: boolean
  items: (FileItem | FolderItem)[]
}

type Item = FileItem | FolderItem

// File types and their icons
const fileTypeIcons = {
  pdf: 'i-hugeicons-pdf-01',
  doc: 'i-hugeicons-doc-01',
  docx: 'i-hugeicons-doc-01',
  xls: 'i-hugeicons-xls-01',
  xlsx: 'i-hugeicons-xls-01',
  ppt: 'i-hugeicons-ppt-01',
  pptx: 'i-hugeicons-ppt-01',
  jpg: 'i-hugeicons-jpg-01',
  jpeg: 'i-hugeicons-jpg-01',
  png: 'i-hugeicons-png-01',
  gif: 'i-hugeicons-gif-01',
  svg: 'i-hugeicons-svg-01',
  txt: 'i-hugeicons-txt-01',
  zip: 'i-hugeicons-zip-01',
  mp3: 'i-hugeicons-mp3-01',
  mp4: 'i-hugeicons-mp-4-01',
  folder: 'i-hugeicons-folder-02',
  default: 'i-hugeicons-file-02'
}

// Sample file structure
const rootFolder: FolderItem = {
  id: 1,
  name: 'Root',
  type: 'folder',
  path: '/',
  lastModified: '2023-12-01T10:00:00',
  starred: false,
  shared: false,
  items: [
    {
      id: 2,
      name: 'Documents',
      type: 'folder',
      path: '/Documents',
      lastModified: '2023-12-01T10:00:00',
      starred: true,
      shared: true,
      items: [
        {
          id: 6,
          name: 'Project Proposal.pdf',
          type: 'pdf',
          size: 2500000,
          path: '/Documents/Project Proposal.pdf',
          lastModified: '2023-12-05T14:30:00',
          starred: true,
          shared: true
        },
        {
          id: 7,
          name: 'Meeting Notes.docx',
          type: 'docx',
          size: 350000,
          path: '/Documents/Meeting Notes.docx',
          lastModified: '2023-12-10T09:15:00',
          starred: false,
          shared: false
        },
        {
          id: 8,
          name: 'Budget.xlsx',
          type: 'xlsx',
          size: 1200000,
          path: '/Documents/Budget.xlsx',
          lastModified: '2023-12-08T16:45:00',
          starred: false,
          shared: true
        }
      ]
    },
    {
      id: 3,
      name: 'Images',
      type: 'folder',
      path: '/Images',
      lastModified: '2023-12-02T11:30:00',
      starred: false,
      shared: false,
      items: [
        {
          id: 9,
          name: 'Profile Photo.jpg',
          type: 'jpg',
          size: 1800000,
          path: '/Images/Profile Photo.jpg',
          lastModified: '2023-12-03T13:20:00',
          starred: true,
          shared: false
        },
        {
          id: 10,
          name: 'Banner.png',
          type: 'png',
          size: 2700000,
          path: '/Images/Banner.png',
          lastModified: '2023-12-04T10:10:00',
          starred: false,
          shared: true
        },
        {
          id: 11,
          name: 'Icon.svg',
          type: 'svg',
          size: 150000,
          path: '/Images/Icon.svg',
          lastModified: '2023-12-05T09:05:00',
          starred: false,
          shared: false
        }
      ]
    },
    {
      id: 4,
      name: 'Videos',
      type: 'folder',
      path: '/Videos',
      lastModified: '2023-12-03T14:00:00',
      starred: false,
      shared: false,
      items: [
        {
          id: 12,
          name: 'Product Demo.mp4',
          type: 'mp4',
          size: 15000000,
          path: '/Videos/Product Demo.mp4',
          lastModified: '2023-12-06T15:30:00',
          starred: false,
          shared: true
        },
        {
          id: 13,
          name: 'Tutorial.mp4',
          type: 'mp4',
          size: 25000000,
          path: '/Videos/Tutorial.mp4',
          lastModified: '2023-12-07T11:45:00',
          starred: true,
          shared: true
        }
      ]
    },
    {
      id: 5,
      name: 'Downloads',
      type: 'folder',
      path: '/Downloads',
      lastModified: '2023-12-04T09:00:00',
      starred: false,
      shared: false,
      items: [
        {
          id: 14,
          name: 'Software Update.zip',
          type: 'zip',
          size: 45000000,
          path: '/Downloads/Software Update.zip',
          lastModified: '2023-12-08T10:20:00',
          starred: false,
          shared: false
        },
        {
          id: 15,
          name: 'E-book.pdf',
          type: 'pdf',
          size: 3500000,
          path: '/Downloads/E-book.pdf',
          lastModified: '2023-12-09T14:10:00',
          starred: true,
          shared: false
        }
      ]
    }
  ]
}

// Current state
const currentFolder = ref<FolderItem>(rootFolder)
const currentPath = ref<string[]>(['Root'])
const selectedItems = ref<Item[]>([])
const viewMode = ref<'grid' | 'list'>('grid')
const sortBy = ref<'name' | 'size' | 'lastModified'>('name')
const sortOrder = ref<'asc' | 'desc'>('asc')
const searchQuery = ref('')
const showUploadModal = ref(false)
const showCreateFolderModal = ref(false)
const newFolderName = ref('')
const showDeleteConfirmation = ref(false)
const showSidePanel = ref(true)

// Storage statistics for charts
const storageStats = {
  total: 100 * 1024 * 1024 * 1024, // 100 GB
  used: 45 * 1024 * 1024 * 1024, // 45 GB
  available: 55 * 1024 * 1024 * 1024 // 55 GB
}

// Storage usage by type
const storageByType = {
  documents: 15 * 1024 * 1024 * 1024, // 15 GB
  images: 10 * 1024 * 1024 * 1024, // 10 GB
  videos: 18 * 1024 * 1024 * 1024, // 18 GB
  other: 2 * 1024 * 1024 * 1024 // 2 GB
}

// Chart data
const storageChartData = computed(() => {
  return {
    labels: ['Used', 'Available'],
    datasets: [
      {
        backgroundColor: ['rgba(54, 162, 235, 0.6)', 'rgba(200, 200, 200, 0.6)'],
        borderColor: ['rgba(54, 162, 235, 1)', 'rgba(200, 200, 200, 1)'],
        borderWidth: 1,
        data: [storageStats.used, storageStats.available]
      }
    ]
  }
})

const storageByTypeChartData = computed(() => {
  return {
    labels: ['Documents', 'Images', 'Videos', 'Other'],
    datasets: [
      {
        backgroundColor: [
          'rgba(255, 99, 132, 0.6)',
          'rgba(54, 162, 235, 0.6)',
          'rgba(255, 206, 86, 0.6)',
          'rgba(75, 192, 192, 0.6)'
        ],
        borderColor: [
          'rgba(255, 99, 132, 1)',
          'rgba(54, 162, 235, 1)',
          'rgba(255, 206, 86, 1)',
          'rgba(75, 192, 192, 1)'
        ],
        borderWidth: 1,
        data: [
          storageByType.documents,
          storageByType.images,
          storageByType.videos,
          storageByType.other
        ]
      }
    ]
  }
})

// Chart options
const doughnutChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'bottom' as const,
    }
  }
}

// Computed properties
const filteredItems = computed(() => {
  let items = [...currentFolder.value.items]

  // Apply search filter
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    items = items.filter(item => item.name.toLowerCase().includes(query))
  }

  // Apply sorting
  items.sort((a, b) => {
    if (sortBy.value === 'name') {
      return sortOrder.value === 'asc'
        ? a.name.localeCompare(b.name)
        : b.name.localeCompare(a.name)
    } else if (sortBy.value === 'lastModified') {
      const dateA = new Date(a.lastModified).getTime()
      const dateB = new Date(b.lastModified).getTime()
      return sortOrder.value === 'asc' ? dateA - dateB : dateB - dateA
    } else if (sortBy.value === 'size') {
      // For folders, use 0 as size for sorting
      const sizeA = 'size' in a ? (a as FileItem).size : 0
      const sizeB = 'size' in b ? (b as FileItem).size : 0
      return sortOrder.value === 'asc' ? sizeA - sizeB : sizeB - sizeA
    }
    return 0
  })

  return items
})

const starredItems = computed(() => {
  // Recursively find all starred items
  const findStarredItems = (folder: FolderItem): Item[] => {
    let result: Item[] = []

    for (const item of folder.items) {
      if (item.starred) {
        result.push(item)
      }

      if (item.type === 'folder') {
        result = [...result, ...findStarredItems(item as FolderItem)]
      }
    }

    return result
  }

  return findStarredItems(rootFolder)
})

const sharedItems = computed(() => {
  // Recursively find all shared items
  const findSharedItems = (folder: FolderItem): Item[] => {
    let result: Item[] = []

    for (const item of folder.items) {
      if (item.shared) {
        result.push(item)
      }

      if (item.type === 'folder') {
        result = [...result, ...findSharedItems(item as FolderItem)]
      }
    }

    return result
  }

  return findSharedItems(rootFolder)
})

const recentItems = computed(() => {
  // Recursively find all items and sort by lastModified
  const findAllItems = (folder: FolderItem): Item[] => {
    let result: Item[] = []

    for (const item of folder.items) {
      result.push(item)

      if (item.type === 'folder') {
        result = [...result, ...findAllItems(item as FolderItem)]
      }
    }

    return result
  }

  return findAllItems(rootFolder)
    .filter(item => item.type !== 'folder') // Only include files
    .sort((a, b) => {
      const dateA = new Date(a.lastModified).getTime()
      const dateB = new Date(b.lastModified).getTime()
      return dateB - dateA
    })
    .slice(0, 10) // Get only the 10 most recent items
})

// Methods
function navigateToFolder(folder: FolderItem) {
  currentFolder.value = folder

  // Update path
  const pathIndex = currentPath.value.findIndex(p => p === folder.name)
  if (pathIndex !== -1) {
    // If folder is already in path, truncate path to this folder
    currentPath.value = currentPath.value.slice(0, pathIndex + 1)
  } else {
    // Otherwise add to path
    currentPath.value.push(folder.name)
  }

  // Clear selection
  selectedItems.value = []
}

function navigateUp() {
  if (currentPath.value.length <= 1) return

  // Remove current folder from path
  currentPath.value.pop()

  // Find parent folder
  let parent = rootFolder
  for (let i = 1; i < currentPath.value.length; i++) {
    const folderName = currentPath.value[i]
    const folder = parent.items.find(item =>
      item.type === 'folder' && item.name === folderName
    ) as FolderItem

    if (folder) {
      parent = folder
    }
  }

  currentFolder.value = parent
  selectedItems.value = []
}

function navigateToPath(index: number) {
  if (index >= currentPath.value.length - 1) return

  // Truncate path to selected index
  currentPath.value = currentPath.value.slice(0, index + 1)

  // Find folder at path
  let folder = rootFolder
  for (let i = 1; i < currentPath.value.length; i++) {
    const folderName = currentPath.value[i]
    const foundFolder = folder.items.find(item =>
      item.type === 'folder' && item.name === folderName
    ) as FolderItem

    if (foundFolder) {
      folder = foundFolder
    }
  }

  currentFolder.value = folder
  selectedItems.value = []
}

function toggleItemSelection(item: Item, event: MouseEvent) {
  const index = selectedItems.value.findIndex(i => i.id === item.id)

  if (event.ctrlKey || event.metaKey) {
    // Toggle selection with Ctrl/Cmd key
    if (index === -1) {
      selectedItems.value.push(item)
    } else {
      selectedItems.value.splice(index, 1)
    }
  } else {
    // Single selection
    selectedItems.value = [item]
  }
}

function toggleStar(item: Item) {
  item.starred = !item.starred
}

function toggleShare(item: Item) {
  item.shared = !item.shared
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'

  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

function getFileIcon(type: string): string {
  return fileTypeIcons[type as keyof typeof fileTypeIcons] || fileTypeIcons.default
}

function createNewFolder() {
  if (!newFolderName.value.trim()) return

  const newFolder: FolderItem = {
    id: Date.now(), // Generate a unique ID
    name: newFolderName.value.trim(),
    type: 'folder',
    path: `${currentFolder.value.path}/${newFolderName.value.trim()}`,
    lastModified: new Date().toISOString(),
    starred: false,
    shared: false,
    items: []
  }

  currentFolder.value.items.push(newFolder)
  newFolderName.value = ''
  showCreateFolderModal.value = false
}

function deleteSelectedItems() {
  if (selectedItems.value.length === 0) return

  // Remove selected items from current folder
  for (const item of selectedItems.value) {
    const index = currentFolder.value.items.findIndex(i => i.id === item.id)
    if (index !== -1) {
      currentFolder.value.items.splice(index, 1)
    }
  }

  selectedItems.value = []
  showDeleteConfirmation.value = false
}
</script>

<template>
  <div class="h-full flex flex-col">
    <!-- Main content -->
    <div class="flex-1 flex">
      <!-- Sidebar -->
      <div :class="[
        'border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 transition-all duration-300',
        showSidePanel ? 'w-64' : 'w-0 overflow-hidden'
      ]">
        <div class="h-full flex flex-col">
          <!-- Storage overview -->
          <div class="p-4 border-b border-gray-200 dark:border-gray-700">
            <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300">Storage</h3>
            <div class="mt-2" style="height: 120px;">
              <Doughnut :data="storageChartData" :options="doughnutChartOptions" />
            </div>
            <div class="mt-2 text-xs text-gray-500 dark:text-gray-400">
              <div class="flex justify-between">
                <span>Used</span>
                <span>{{ formatFileSize(storageStats.used) }}</span>
              </div>
              <div class="flex justify-between">
                <span>Available</span>
                <span>{{ formatFileSize(storageStats.available) }}</span>
              </div>
              <div class="flex justify-between font-medium">
                <span>Total</span>
                <span>{{ formatFileSize(storageStats.total) }}</span>
              </div>
            </div>
          </div>

          <!-- Storage by type -->
          <div class="p-4 border-b border-gray-200 dark:border-gray-700">
            <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300">Storage by Type</h3>
            <div class="mt-2" style="height: 120px;">
              <Doughnut :data="storageByTypeChartData" :options="doughnutChartOptions" />
            </div>
            <div class="mt-2 text-xs text-gray-500 dark:text-gray-400">
              <div class="flex justify-between">
                <span>Documents</span>
                <span>{{ formatFileSize(storageByType.documents) }}</span>
              </div>
              <div class="flex justify-between">
                <span>Images</span>
                <span>{{ formatFileSize(storageByType.images) }}</span>
              </div>
              <div class="flex justify-between">
                <span>Videos</span>
                <span>{{ formatFileSize(storageByType.videos) }}</span>
              </div>
              <div class="flex justify-between">
                <span>Other</span>
                <span>{{ formatFileSize(storageByType.other) }}</span>
              </div>
            </div>
          </div>

          <!-- Navigation -->
          <nav class="flex-1 overflow-y-auto p-2">
            <div class="space-y-1">
              <button
                @click="navigateToFolder(rootFolder)"
                class="w-full flex items-center px-2 py-2 text-sm font-medium rounded-md"
                :class="[
                  currentFolder.id === rootFolder.id
                    ? 'bg-gray-100 text-gray-900 dark:bg-gray-700 dark:text-white'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white'
                ]"
              >
                <div class="i-hugeicons-home-02 h-5 w-5 mr-3 text-gray-400 dark:text-gray-500"></div>
                Home
              </button>

              <button
                class="w-full flex items-center px-2 py-2 text-sm font-medium rounded-md text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white"
              >
                <div class="i-hugeicons-star h-5 w-5 mr-3 text-gray-400 dark:text-gray-500"></div>
                Starred
                <span class="ml-auto bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 py-0.5 px-2 rounded-full text-xs">
                  {{ starredItems.length }}
                </span>
              </button>

              <button
                class="w-full flex items-center px-2 py-2 text-sm font-medium rounded-md text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white"
              >
                <div class="i-hugeicons-share-01 h-5 w-5 mr-3 text-gray-400 dark:text-gray-500"></div>
                Shared
                <span class="ml-auto bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 py-0.5 px-2 rounded-full text-xs">
                  {{ sharedItems.length }}
                </span>
              </button>

              <button
                class="w-full flex items-center px-2 py-2 text-sm font-medium rounded-md text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white"
              >
                <div class="i-hugeicons-clock-04 h-5 w-5 mr-3 text-gray-400 dark:text-gray-500"></div>
                Recent
              </button>

              <button
                class="w-full flex items-center px-2 py-2 text-sm font-medium rounded-md text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white"
              >
                <div class="i-hugeicons-waste h-5 w-5 mr-3 text-gray-400 dark:text-gray-500"></div>
                Trash
              </button>
            </div>

            <div class="mt-8">
              <h3 class="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider dark:text-gray-400">
                Folders
              </h3>
              <div class="mt-1 space-y-1">
                <button
                  v-for="folder in rootFolder.items.filter(item => item.type === 'folder')"
                  :key="folder.id"
                  @click="navigateToFolder(folder as FolderItem)"
                  class="w-full flex items-center px-2 py-2 text-sm font-medium rounded-md"
                  :class="[
                    currentFolder.id === folder.id
                      ? 'bg-gray-100 text-gray-900 dark:bg-gray-700 dark:text-white'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white'
                  ]"
                >
                  <div class="i-hugeicons-folder-02 h-5 w-5 mr-3 text-gray-400 dark:text-gray-500"></div>
                  {{ folder.name }}
                </button>
              </div>
            </div>
          </nav>

          <!-- Upload button -->
          <div class="p-4 border-t border-gray-200 dark:border-gray-700">
            <button
              @click="showUploadModal = true"
              class="w-full flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-gray-800"
            >
              <div class="i-hugeicons-upload-01 h-5 w-5 mr-2"></div>
              Upload Files
            </button>
          </div>
        </div>
      </div>

      <!-- Main content area -->
      <div class="flex-1 flex flex-col">
        <!-- Toolbar -->
        <div class="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
          <div class="flex items-center justify-between">
            <!-- Toggle sidebar button -->
            <button
              @click="showSidePanel = !showSidePanel"
              class="p-2 rounded-md text-gray-500 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-700"
            >
              <div class="i-hugeicons-menu-01 h-5 w-5"></div>
            </button>

            <!-- Search -->
            <div class="max-w-lg w-full lg:max-w-xs ml-4">
              <label for="search" class="sr-only">Search</label>
              <div class="relative text-gray-400 focus-within:text-gray-600 dark:focus-within:text-gray-300">
                <div class="pointer-events-none absolute inset-y-0 left-0 pl-3 flex items-center">
                  <div class="i-hugeicons-search-01 h-5 w-5"></div>
                </div>
                <input
                  id="search"
                  v-model="searchQuery"
                  class="block w-full bg-white dark:bg-gray-700 py-2 pl-10 pr-3 border border-gray-300 dark:border-gray-600 rounded-md leading-5 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="Search files and folders..."
                  type="search"
                />
              </div>
            </div>

            <!-- View and sort options -->
            <div class="flex items-center space-x-2">
              <!-- View mode toggle -->
              <div class="flex rounded-md shadow-sm">
                <button
                  @click="viewMode = 'grid'"
                  :class="[
                    'relative inline-flex items-center px-3 py-2 rounded-l-md border border-gray-300 dark:border-gray-600 text-sm font-medium',
                    viewMode === 'grid'
                      ? 'bg-indigo-600 text-white border-indigo-600 dark:border-indigo-600'
                      : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600'
                  ]"
                >
                  <div class="i-hugeicons-grid-view h-5 w-5"></div>
                </button>
                <button
                  @click="viewMode = 'list'"
                  :class="[
                    'relative inline-flex items-center px-3 py-2 rounded-r-md border border-gray-300 dark:border-gray-600 text-sm font-medium',
                    viewMode === 'list'
                      ? 'bg-indigo-600 text-white border-indigo-600 dark:border-indigo-600'
                      : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600'
                  ]"
                >
                  <div class="i-hugeicons-right-to-left-list-number h-5 w-5"></div>
                </button>
              </div>

              <!-- Sort options -->
              <select
                v-model="sortBy"
                class="block w-full pl-3 pr-10 py-2 text-base border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="name">Name</option>
                <option value="lastModified">Date</option>
                <option value="size">Size</option>
              </select>

              <button
                @click="sortOrder = sortOrder === 'asc' ? 'desc' : 'asc'"
                class="p-2 rounded-md text-gray-500 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-700"
              >
                <div :class="[
                  sortOrder === 'asc' ? 'i-hugeicons-arrow-up-02' : 'i-hugeicons-arrow-down-02',
                  'h-5 w-5'
                ]"></div>
              </button>
            </div>

            <!-- Actions -->
            <div class="flex items-center space-x-2">
              <button
                @click="showCreateFolderModal = true"
                class="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-gray-800"
              >
                <div class="i-hugeicons-folder-add h-4 w-4 mr-2"></div>
                New Folder
              </button>
              <button
                @click="showUploadModal = true"
                class="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-gray-800"
              >
                <div class="i-hugeicons-upload-01 h-4 w-4 mr-2"></div>
                Upload
              </button>
            </div>
          </div>

          <!-- Breadcrumbs -->
          <nav class="flex mt-4" aria-label="Breadcrumb">
            <ol class="flex items-center space-x-1">
              <li v-for="(path, index) in currentPath" :key="index">
                <div class="flex items-center">
                  <span v-if="index > 0" class="text-gray-400 dark:text-gray-500 mx-1">/</span>
                  <button
                    @click="navigateToPath(index)"
                    :class="[
                      'text-sm font-medium',
                      index === currentPath.length - 1
                        ? 'text-indigo-600 dark:text-indigo-400'
                        : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                    ]"
                  >
                    {{ path }}
                  </button>
                </div>
              </li>
            </ol>
          </nav>
        </div>

        <!-- Content -->
        <div class="flex-1 overflow-auto p-4 bg-gray-50 dark:bg-gray-900">
          <!-- Empty state -->
          <div v-if="filteredItems.length === 0" class="flex flex-col items-center justify-center h-full text-center">
            <div class="i-hugeicons-folder-02 h-16 w-16 text-gray-400 dark:text-gray-600"></div>
            <h3 class="mt-2 text-sm font-medium text-gray-900 dark:text-white">No items</h3>
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {{ searchQuery ? 'No items match your search.' : 'This folder is empty.' }}
            </p>
            <div class="mt-6 flex space-x-4">
              <button
                @click="showCreateFolderModal = true"
                class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-gray-800"
              >
                <div class="i-hugeicons-folder-add h-5 w-5 mr-2"></div>
                New Folder
              </button>
              <button
                @click="showUploadModal = true"
                class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-gray-800"
              >
                <div class="i-hugeicons-upload-01 h-5 w-5 mr-2"></div>
                Upload Files
              </button>
            </div>
          </div>

          <!-- Grid view -->
          <div v-else-if="viewMode === 'grid'" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            <div
              v-for="item in filteredItems"
              :key="item.id"
              @click="item.type === 'folder' ? navigateToFolder(item as FolderItem) : toggleItemSelection(item, $event)"
              @contextmenu.prevent
              :class="[
                'relative group p-4 rounded-lg border cursor-pointer transition-all duration-200',
                selectedItems.some(i => i.id === item.id)
                  ? 'bg-indigo-50 border-indigo-300 dark:bg-indigo-900/30 dark:border-indigo-700'
                  : 'bg-white border-gray-200 hover:border-gray-300 dark:bg-gray-800 dark:border-gray-700 dark:hover:border-gray-600'
              ]"
            >
              <!-- Item icon -->
              <div class="flex justify-center mb-4">
                <div
                  :class="[
                    item.type === 'folder' ? 'i-hugeicons-folder-02' : getFileIcon(item.type),
                    'h-12 w-12',
                    item.type === 'folder' ? 'text-indigo-400 dark:text-indigo-300' : 'text-gray-500 dark:text-gray-400'
                  ]"
                ></div>
              </div>

              <!-- Item name -->
              <div class="text-center">
                <p class="text-sm font-medium text-gray-900 dark:text-white truncate">{{ item.name }}</p>
                <p v-if="item.type !== 'folder'" class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {{ formatFileSize((item as FileItem).size) }}
                </p>
              </div>

              <!-- Actions -->
              <div class="absolute top-2 right-2 flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  @click.stop="toggleStar(item)"
                  class="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
                  :class="[
                    item.starred ? 'text-yellow-500' : 'text-gray-400 dark:text-gray-500'
                  ]"
                >
                  <div class="i-hugeicons-star h-4 w-4"></div>
                </button>
                <button
                  @click.stop="toggleShare(item)"
                  class="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
                  :class="[
                    item.shared ? 'text-indigo-500' : 'text-gray-400 dark:text-gray-500'
                  ]"
                >
                  <div class="i-hugeicons-share-01 h-4 w-4"></div>
                </button>
              </div>
            </div>
          </div>

          <!-- List view -->
          <div v-else class="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
            <table class="min-w-full divide-y divide-gray-300 dark:divide-gray-700">
              <thead class="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th scope="col" class="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 dark:text-white sm:pl-6">
                    Name
                  </th>
                  <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">
                    Size
                  </th>
                  <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">
                    Modified
                  </th>
                  <th scope="col" class="relative py-3.5 pl-3 pr-4 sm:pr-6">
                    <span class="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-800">
                <tr
                  v-for="item in filteredItems"
                  :key="item.id"
                  @click="item.type === 'folder' ? navigateToFolder(item as FolderItem) : toggleItemSelection(item, $event)"
                  :class="[
                    'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700',
                    selectedItems.some(i => i.id === item.id)
                      ? 'bg-indigo-50 dark:bg-indigo-900/30'
                      : ''
                  ]"
                >
                  <td class="whitespace-nowrap py-4 pl-4 pr-3 text-sm sm:pl-6">
                    <div class="flex items-center">
                      <div
                        :class="[
                          item.type === 'folder' ? 'i-hugeicons-folder-02' : getFileIcon(item.type),
                          'h-6 w-6 mr-3',
                          item.type === 'folder' ? 'text-indigo-400 dark:text-indigo-300' : 'text-gray-500 dark:text-gray-400'
                        ]"
                      ></div>
                      <div class="font-medium text-gray-900 dark:text-white">{{ item.name }}</div>
                    </div>
                  </td>
                  <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                    {{ item.type === 'folder' ? '-' : formatFileSize((item as FileItem).size) }}
                  </td>
                  <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                    {{ formatDate(item.lastModified) }}
                  </td>
                  <td class="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                    <div class="flex justify-end space-x-2">
                      <button
                        @click.stop="toggleStar(item)"
                        class="text-gray-400 hover:text-yellow-500"
                        :class="{ 'text-yellow-500': item.starred }"
                      >
                        <div class="i-hugeicons-star h-5 w-5"></div>
                      </button>
                      <button
                        @click.stop="toggleShare(item)"
                        class="text-gray-400 hover:text-indigo-500"
                        :class="{ 'text-indigo-500': item.shared }"
                      >
                        <div class="i-hugeicons-share-01 h-5 w-5"></div>
                      </button>
                      <button
                        @click.stop="selectedItems = [item]; showDeleteConfirmation = true"
                        class="text-gray-400 hover:text-red-500"
                      >
                        <div class="i-hugeicons-waste h-5 w-5"></div>
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <!-- Create Folder Modal -->
    <div v-if="showCreateFolderModal" class="fixed inset-0 z-10 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
      <div class="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity dark:bg-gray-900 dark:bg-opacity-75" aria-hidden="true" @click="showCreateFolderModal = false"></div>

        <span class="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

        <div class="inline-block align-bottom bg-white dark:bg-gray-800 rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
          <div class="sm:flex sm:items-start">
            <div class="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-indigo-100 dark:bg-indigo-900 sm:mx-0 sm:h-10 sm:w-10">
              <div class="i-hugeicons-folder-add h-6 w-6 text-indigo-600 dark:text-indigo-400"></div>
            </div>
            <div class="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
              <h3 class="text-lg leading-6 font-medium text-gray-900 dark:text-white" id="modal-title">
                Create New Folder
              </h3>
              <div class="mt-2">
                <p class="text-sm text-gray-500 dark:text-gray-400">
                  Enter a name for the new folder.
                </p>
              </div>
            </div>
          </div>
          <div class="mt-4">
            <input
              type="text"
              v-model="newFolderName"
              class="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
              placeholder="Folder name"
              @keyup.enter="createNewFolder"
            />
          </div>
          <div class="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
            <button
              type="button"
              @click="createNewFolder"
              class="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:ml-3 sm:w-auto sm:text-sm dark:focus:ring-offset-gray-800"
            >
              Create
            </button>
            <button
              type="button"
              @click="showCreateFolderModal = false"
              class="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 dark:border-gray-600 shadow-sm px-4 py-2 bg-white dark:bg-gray-700 text-base font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:w-auto sm:text-sm dark:focus:ring-offset-gray-800"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Upload Modal -->
    <div v-if="showUploadModal" class="fixed inset-0 z-10 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
      <div class="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity dark:bg-gray-900 dark:bg-opacity-75" aria-hidden="true" @click="showUploadModal = false"></div>

        <span class="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

        <div class="inline-block align-bottom bg-white dark:bg-gray-800 rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
          <div class="sm:flex sm:items-start">
            <div class="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-indigo-100 dark:bg-indigo-900 sm:mx-0 sm:h-10 sm:w-10">
              <div class="i-hugeicons-upload-01 h-6 w-6 text-indigo-600 dark:text-indigo-400"></div>
            </div>
            <div class="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
              <h3 class="text-lg leading-6 font-medium text-gray-900 dark:text-white" id="modal-title">
                Upload Files
              </h3>
              <div class="mt-2">
                <p class="text-sm text-gray-500 dark:text-gray-400">
                  Select files to upload to the current folder.
                </p>
              </div>
            </div>
          </div>
          <div class="mt-4">
            <div class="flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 dark:border-gray-600 border-dashed rounded-md">
              <div class="space-y-1 text-center">
                <div class="i-hugeicons-upload-01 mx-auto h-12 w-12 text-gray-400 dark:text-gray-500"></div>
                <div class="flex text-sm text-gray-600 dark:text-gray-400">
                  <label for="file-upload" class="relative cursor-pointer bg-white dark:bg-gray-800 rounded-md font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500 dark:focus-within:ring-offset-gray-800">
                    <span>Upload a file</span>
                    <input id="file-upload" name="file-upload" type="file" class="sr-only" multiple />
                  </label>
                  <p class="pl-1">or drag and drop</p>
                </div>
                <p class="text-xs text-gray-500 dark:text-gray-400">
                  PNG, JPG, GIF, PDF, DOCX up to 10MB
                </p>
              </div>
            </div>
          </div>
          <div class="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
            <button
              type="button"
              class="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:ml-3 sm:w-auto sm:text-sm dark:focus:ring-offset-gray-800"
            >
              Upload
            </button>
            <button
              type="button"
              @click="showUploadModal = false"
              class="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 dark:border-gray-600 shadow-sm px-4 py-2 bg-white dark:bg-gray-700 text-base font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:w-auto sm:text-sm dark:focus:ring-offset-gray-800"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Delete Confirmation Modal -->
    <div v-if="showDeleteConfirmation" class="fixed inset-0 z-10 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
      <div class="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity dark:bg-gray-900 dark:bg-opacity-75" aria-hidden="true" @click="showDeleteConfirmation = false"></div>

        <span class="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

        <div class="inline-block align-bottom bg-white dark:bg-gray-800 rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
          <div class="sm:flex sm:items-start">
            <div class="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 dark:bg-red-900 sm:mx-0 sm:h-10 sm:w-10">
              <div class="i-hugeicons-alert-02 h-6 w-6 text-red-600 dark:text-red-400"></div>
            </div>
            <div class="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
              <h3 class="text-lg leading-6 font-medium text-gray-900 dark:text-white" id="modal-title">
                Delete {{ selectedItems.length > 1 ? 'Items' : 'Item' }}
              </h3>
              <div class="mt-2">
                <p class="text-sm text-gray-500 dark:text-gray-400">
                  Are you sure you want to delete {{ selectedItems.length > 1 ? 'these items' : 'this item' }}? This action cannot be undone.
                </p>
              </div>
              <div v-if="selectedItems.length > 0" class="mt-3 max-h-40 overflow-y-auto">
                <ul class="divide-y divide-gray-200 dark:divide-gray-700">
                  <li v-for="item in selectedItems" :key="item.id" class="py-2 flex items-center">
                    <div
                      :class="[
                        item.type === 'folder' ? 'i-hugeicons-folder-02' : getFileIcon(item.type),
                        'h-5 w-5 mr-3',
                        item.type === 'folder' ? 'text-indigo-400 dark:text-indigo-300' : 'text-gray-500 dark:text-gray-400'
                      ]"
                    ></div>
                    <span class="text-sm text-gray-700 dark:text-gray-300">{{ item.name }}</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
          <div class="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
            <button
              type="button"
              @click="deleteSelectedItems"
              class="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:ml-3 sm:w-auto sm:text-sm dark:focus:ring-offset-gray-800"
            >
              Delete
            </button>
            <button
              type="button"
              @click="showDeleteConfirmation = false"
              class="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 dark:border-gray-600 shadow-sm px-4 py-2 bg-white dark:bg-gray-700 text-base font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:w-auto sm:text-sm dark:focus:ring-offset-gray-800"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
