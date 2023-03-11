<script setup lang="ts">
import type { Ref } from 'vue'
import { usePageStore } from '~/stores/page'
import { useFilter } from '~/stores/filters'
import type { Page } from '~/types'

const baseUrl = import.meta.env.VITE_API_ROOT_BASE_URL
const pageStore = usePageStore()
const filterStore = useFilter()
const router = useRouter()

const loading = ref(true)
const searchInstanceModal = ref(false)

onMounted(async () => {
  await fetchPages(1)

  loading.value = false
})

async function fetchPages(page: number) {
  await pageStore.fetchPages({ page })
}

async function goToPage(page: number) {
  await pageStore.fetchPages({ page, filters: filterStore.filterVal, search: filterStore.search, sort: filterStore.sort })
}

async function sort(col: string) {
  switch (filterStore.sortType[col]) {
    case '':
      filterStore.setSortType(col, 'asc')
      break
    case undefined:
      filterStore.setSortType(col, 'asc')
      break
    case 'asc':
      filterStore.setSortType(col, 'desc')
      break
    case 'desc':
      filterStore.setSortType(col, '')
      break
    default:
      filterStore.setSortType(col, '')
      break
  }

  const sort = [`${col}:${filterStore.sortType[col]}`]

  filterStore.setSort(sort)
  filterStore.setSortVal(col)

  const params: any = { page: 1, filters: filterStore.filterVal, search: filterStore.search }

  if (filterStore.sortType[col])
    params.sort = filterStore.sort
  else
    filterStore.setSort([])

  await pageStore.fetchPages(params)
}

function getKeywords(keywords: string) {
  return keywords.split(', ')
}

function getBadgeColor(index: number) {
  let color = 'bg-gray-100'

  switch (index) {
    case 0:
      color = 'bg-green-100'
      break
    case 1:
      color = 'bg-red-100'
      break
    case 2:
      color = 'bg-teal-100'
      break
    case 3:
      color = 'bg-blue-100'
      break
    case 4:
      color = 'bg-yellow-100'
      break
    case 5:
      color = 'bg-purple-100'
      break
    default:
      color = 'bg-gray-100'
  }

  return color
}

const currentPage: Ref<Page> = ref({})

function viewSearchInstance(page: Page) {
  currentPage.value = page

  searchInstanceModal.value = true
}

function closeSearchInstanceModal() {
  searchInstanceModal.value = false
}
</script>

<template>
  <div class="px-4 sm:px-6 lg:px-8">
    <TableList
      v-if="pageStore.hasPages && !loading"
      :results="pageStore.results"
      @navigate-to-page="goToPage"
    >
      <thead class="dark:bg-gray-800">
        <tr>
          <th
            scope="col"
            class="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase cursor-pointer dark:text-gray-400 dark:text-gray-300"
            @click="sort('page')"
          >
            <div class="flex items-center">
              <span>URI</span>
              <SortIcon :type="filterStore.sortType.page" />
            </div>
          </th>

          <th
            scope="col"
            class="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase cursor-pointer dark:text-gray-400 dark:text-gray-300"
            @click="sort('title')"
          >
            <div class="flex items-center">
              <span>Title & Description</span>
              <SortIcon :type="filterStore.sortType.title" />
            </div>
          </th>

          <th
            scope="col"
            class="px-6 w-[24rem] py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase dark:text-gray-400 dark:text-gray-300"
          >
            Keywords
          </th>
          <th
            scope="col"
            class="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase dark:text-gray-400 dark:text-gray-300"
          >
            Status
          </th>
          <th
            scope="col"
            class="relative px-6 py-3"
          >
            <span class="sr-only">Action</span>
          </th>
        </tr>
      </thead>
      <tbody class="bg-white divide-y divide-gray-200 dark:divide-gray-600">
        <tr
          v-for="(page, index) in pageStore.pages"
          :key="index"
          class="bg-white dark:bg-gray-800"
        >
          <td class="px-6 py-4 text-sm font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap">
            {{ page.page }}
          </td>

          <td class="px-6 py-4 text-sm text-gray-500 break-words dark:text-gray-400 dark:text-gray-300">
            <div
              class="flex items-center text-sm font-medium text-gray-900 dark:text-gray-100"
            >
              {{ page.title }}
              <!---->
            </div>
            <div class="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-300">
              {{ page.description }}
            </div>
          </td>

          <td class="px-6 py-4 space-y-2 text-sm text-gray-500 break-words dark:text-gray-400 dark:text-gray-300">
            <span
              v-for="(keyword, keywordIndex) in getKeywords(page.keywords)"
              :key="keywordIndex"
              class="inline-flex mr-2 items-center rounded-full px-2.5 py-0.5 text-xs font-medium text-gray-800"
              :class="getBadgeColor(keywordIndex)"
            >{{ keyword }}</span>
          </td>
          <td class="px-6 py-4 text-sm text-gray-500 break-words dark:text-gray-400 dark:text-gray-300">
            <svg
              fill="currentColor"
              class="w-6 h-6 text-green-600"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                clip-rule="evenodd"
                fill-rule="evenodd"
                d="M8.603 3.799A4.49 4.49 0 0112 2.25c1.357 0 2.573.6 3.397 1.549a4.49 4.49 0 013.498 1.307 4.491 4.491 0 011.307 3.497A4.49 4.49 0 0121.75 12a4.49 4.49 0 01-1.549 3.397 4.491 4.491 0 01-1.307 3.497 4.491 4.491 0 01-3.497 1.307A4.49 4.49 0 0112 21.75a4.49 4.49 0 01-3.397-1.549 4.49 4.49 0 01-3.498-1.306 4.491 4.491 0 01-1.307-3.498A4.49 4.49 0 012.25 12c0-1.357.6-2.573 1.549-3.397a4.49 4.49 0 011.307-3.497 4.49 4.49 0 013.497-1.307zm7.007 6.387a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z"
              />
            </svg>
          </td>
          <td class="px-6 py-4 text-sm font-semibold text-right">
            <span class="inline-flex rounded-md shadow-sm isolate">
              <button
                type="button"
                title="Edit Team Member"
                class="relative items-center p-2 text-xs font-semibold text-white transition duration-150 ease-in-out border border-gray-300 rounded-md dark-hover:bg-gray-500 dark:border-gray-500 hover:bg-gray-100 focus:z-10 focus:outline-none focus:ring-2 group"
                @click="$event => viewSearchInstance(page)"
              >

                <svg
                  class="w-5 h-5 text-gray-500 dark:text-gray-300 group-hover:text-gray-700"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.5"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
                  />
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
              </button>
            </span>
          </td>
        </tr>
      </tbody>
    </TableList>

    <EmptyState v-if="!pageStore.hasPages && !loading" />

    <ModalWrapper
      v-if="searchInstanceModal"
      @close-modal="closeSearchInstanceModal()"
    >
      <template #modal-body>
        <div class="absolute top-0 right-0 hidden pt-4 pr-4 sm:block">
          <button
            type="button"
            class="text-gray-400 rounded-md dark:text-gray-200 dark-hover:text-gray-100 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2"
            @click="closeSearchInstanceModal()"
          >
            <span class="sr-only">Close</span>
            <!-- Heroicon name: outline/x-mark -->
            <svg
              class="w-6 h-6"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke-width="1.5"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div class="sm:flex sm:items-start">
          <div class="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
            <h3
              id="modal-title"
              class="text-lg font-medium leading-6 text-gray-900 dark:text-gray-100"
            >
              Search Engine Instance
            </h3>
            <div class="mt-2">
              <p
                id="subtitle"
                class="text-xs text-green-800 dark:text-green-600 mb-2"
              >
                {{ baseUrl }} › {{ currentPage.page.substring(1) }}
              </p>

              <a
                id="title"
                :href="`${baseUrl}${currentPage.page}`"
                target="_new"
                class="text-lg text-blue-800 dark:text-blue-400"
              >

                {{ currentPage.title }}
              </a>

              <p
                id="title"
                class="text-sm text-gray-800 mt-2 dark:text-gray-200"
              >
                {{ currentPage.description }}
              </p>
            </div>
          </div>
        </div>
      </template>

      <template #modal-actions>
        <button
          type="button"
          class="secondary-button"
          @click="closeSearchInstanceModal()"
        >
          Close
        </button>
      </template>
    </ModalWrapper>
  </div>
</template>

<style>
.circular--portrait { position: relative; width: 50px; height: 50px; overflow: hidden; border-radius: 50%; } .circular--portrait img { width: 100%; height: auto; }
</style>
