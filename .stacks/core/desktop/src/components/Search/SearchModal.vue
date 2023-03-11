<script setup lang="ts">
const emit = defineEmits(['closeSearchModal'])

const router = useRouter()

const query = ref('')

const searchModalInput = ref(null as any)
const userResults = ref([] as any[])
const webpageResults = ref([] as any[])
const eventResults = ref([] as any[])
const memberResults = ref([] as any[])
const agencyResults = ref([] as any[])

const searchModal = ref(null as any)

async function doSearch() {
  const users = await search('users', { query: query.value, perPage: 5 })
  const webpages = await search('webpages', { query: query.value, perPage: 5 })
  const events = await search('events', { query: query.value, perPage: 5 })
  const members = await search('team_members', { query: query.value, perPage: 5 })
  const agencies = await search('agencies', { query: query.value, perPage: 5 })

  userResults.value = users.hits
  webpageResults.value = webpages.hits
  eventResults.value = events.hits
  memberResults.value = members.hits
  agencyResults.value = agencies.hits
}

const searchAction = useDebounceFn(() => {
  doSearch()
}, 500)

function clearResults() {
  userResults.value = []
  webpageResults.value = []
  eventResults.value = []
  memberResults.value = []
  agencyResults.value = []
}

watch(query, (newVal) => {
  if (newVal)
    searchAction()

  if (!newVal)
    clearResults()
})

function navigateUser(userId: number) {
  router.push({ name: 'users-edit-id', params: { id: userId } })
}

function navigateWebpage(webId: number) {
  router.push({ name: 'webpages-edit-id', params: { id: webId } })
}

function navigateEvent(eventId: number) {
  router.push({ name: 'events-edit-id', params: { id: eventId } })
}

function navigateAgency(agencyId: number) {
  router.push({ name: 'reports-center-edit-id', params: { id: agencyId } })
}

function navigateMember(memberId: number) {
  router.push({ name: 'team-members-edit-id', params: { id: memberId } })
}

function closeSearch() {
  emit('closeSearchModal')
}

onMounted(() => {
  searchModalInput.value.focus()

  document.body.style.overflowY = 'hidden'
})

onUnmounted(() => {
  document.body.style.overflowY = 'visible'
})

const hasResults = computed(() => {
  return userResults.value.length
  || webpageResults.value.length
  || eventResults.value.length
  || memberResults.value.length
  || agencyResults.value.length
})

function getText(text: string) {
  const searchStr = query.value.toLocaleLowerCase()
  const fullText = { highlighted: '', normal: '' }

  for (let index = 0; index < text.length; index++) {
    const textElement = text[index]

    if (searchStr[index] === textElement.toLocaleLowerCase())
      fullText.highlighted += `${textElement}`
    else
      fullText.normal += `${textElement}`
  }

  return fullText
}

useClickOutside(searchModal, () => {
  emit('closeSearchModal')
})
</script>

<template>
  <div

    class="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24"
    role="dialog"
    aria-modal="true"
  >
    <div
      class="fixed inset-0 transition-opacity opacity-100 bg-slate-900/25 backdrop-blur"
    /><div class="relative w-full max-w-2xl px-4 transition-all transform scale-100 opacity-100">
      <div
        ref="searchModal"
        class="overflow-hidden bg-white rounded-lg shadow-md"
      >
        <div class="relative shadow-sm">
          <input
            ref="searchModalInput"
            v-model="query"
            class="block w-full py-4 pl-4 pr-12 text-base text-gray-700 bg-transparent border-none appearance-none dark:placeholder-gray-400 dark:text-gray-300 dark:bg-gray-800 placeholder:text-slate-600 focus:outline-none sm:text-sm sm:leading-6"
            placeholder="Find anything..."
            aria-label="Search"
            role="combobox"
            type="text"
            aria-expanded="true"
            tabindex="0"
            @keyup.enter="doSearch"
            @keyup.esc="closeSearch"
          ><svg
            class="absolute w-6 h-6 pointer-events-none top-4 right-4 fill-slate-400"
            xmlns="http://www.w3.org/2000/svg"
          ><path d="M20.47 21.53a.75.75 0 1 0 1.06-1.06l-1.06 1.06Zm-9.97-4.28a6.75 6.75 0 0 1-6.75-6.75h-1.5a8.25 8.25 0 0 0 8.25 8.25v-1.5ZM3.75 10.5a6.75 6.75 0 0 1 6.75-6.75v-1.5a8.25 8.25 0 0 0-8.25 8.25h1.5Zm6.75-6.75a6.75 6.75 0 0 1 6.75 6.75h1.5a8.25 8.25 0 0 0-8.25-8.25v1.5Zm11.03 16.72-5.196-5.197-1.061 1.06 5.197 5.197 1.06-1.06Zm-4.28-9.97c0 1.864-.755 3.55-1.977 4.773l1.06 1.06A8.226 8.226 0 0 0 18.75 10.5h-1.5Zm-1.977 4.773A6.727 6.727 0 0 1 10.5 17.25v1.5a8.226 8.226 0 0 0 5.834-2.416l-1.061-1.061Z" /></svg>
        </div>
        <ul
          v-if="hasResults"
          class="max-h-[25.375rem] py-4 dark:bg-gray-800 overflow-y-auto rounded-b-lg border-slate-200 text-sm leading-6"
          role="listbox"
        >
          <li
            v-if="userResults.length"
            class="flex flex-col justify-between px-4"
            role="option"
            tabindex="-1"
            aria-selected="false"
          >
            <span class="flex items-start text-lg font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">
              <svg
                class="w-6 h-6 mr-1 text-gray-700 dark:text-gray-100 group-hover:text-gray-500 dark:text-gray-400"
                fill="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <path d="M4.5 6.375a4.125 4.125 0 118.25 0 4.125 4.125 0 01-8.25 0zM14.25 8.625a3.375 3.375 0 116.75 0 3.375 3.375 0 01-6.75 0zM1.5 19.125a7.125 7.125 0 0114.25 0v.003l-.001.119a.75.75 0 01-.363.63 13.067 13.067 0 01-6.761 1.873c-2.472 0-4.786-.684-6.76-1.873a.75.75 0 01-.364-.63l-.001-.122zM17.25 19.128l-.001.144a2.25 2.25 0 01-.233.96 10.088 10.088 0 005.06-1.01.75.75 0 00.42-.643 4.875 4.875 0 00-6.957-4.611 8.586 8.586 0 011.71 5.157v.003z" />
              </svg>
              Users
            </span>

            <ul class="p-2 mt-2 bg-gray-100 rounded-lg dark:bg-gray-700">
              <li
                v-for="(user, index) in userResults"
                :key="index"
                class="p-2 rounded-md cursor-pointer hover:bg-teal-500 hover:text-gray-50"
                @click="navigateUser(user.id)"
              >
                <span class="font-semibold border-b border-teal-500 border-opacity-75 border-b-3">
                  {{ getText(user.full_name).highlighted }}
                </span>{{ getText(user.full_name).normal }}
              </li>
            </ul>
          </li>
          <li
            v-if="webpageResults.length"
            class="flex flex-col justify-between px-4 pt-4"
            role="option"
            tabindex="-1"
            aria-selected="false"
          >
            <span class="flex items-start text-lg font-semibold text-gray-700 whitespace-nowrap dark:text-gray-300">
              <svg
                class="w-6 h-6 mr-1 text-gray-700 dark:text-gray-100 group-hover:text-gray-500 dark:text-gray-400"
                fill="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <path d="M21.721 12.752a9.711 9.711 0 00-.945-5.003 12.754 12.754 0 01-4.339 2.708 18.991 18.991 0 01-.214 4.772 17.165 17.165 0 005.498-2.477zM14.634 15.55a17.324 17.324 0 00.332-4.647c-.952.227-1.945.347-2.966.347-1.021 0-2.014-.12-2.966-.347a17.515 17.515 0 00.332 4.647 17.385 17.385 0 005.268 0zM9.772 17.119a18.963 18.963 0 004.456 0A17.182 17.182 0 0112 21.724a17.18 17.18 0 01-2.228-4.605zM7.777 15.23a18.87 18.87 0 01-.214-4.774 12.753 12.753 0 01-4.34-2.708 9.711 9.711 0 00-.944 5.004 17.165 17.165 0 005.498 2.477zM21.356 14.752a9.765 9.765 0 01-7.478 6.817 18.64 18.64 0 001.988-4.718 18.627 18.627 0 005.49-2.098zM2.644 14.752c1.682.971 3.53 1.688 5.49 2.099a18.64 18.64 0 001.988 4.718 9.765 9.765 0 01-7.478-6.816zM13.878 2.43a9.755 9.755 0 016.116 3.986 11.267 11.267 0 01-3.746 2.504 18.63 18.63 0 00-2.37-6.49zM12 2.276a17.152 17.152 0 012.805 7.121c-.897.23-1.837.353-2.805.353-.968 0-1.908-.122-2.805-.353A17.151 17.151 0 0112 2.276zM10.122 2.43a18.629 18.629 0 00-2.37 6.49 11.266 11.266 0 01-3.746-2.504 9.754 9.754 0 016.116-3.985z" />
              </svg>
              Webpages
            </span>

            <ul class="p-2 mt-2 bg-gray-100 rounded-lg dark:bg-gray-700">
              <li
                v-for="(webpage, index) in webpageResults"
                :key="index"
                class="p-2 rounded-md cursor-pointer hover:bg-teal-500 hover:text-gray-50"
                @click="navigateWebpage(webpage.id)"
              >
                <span class="font-semibold border-b border-teal-500 border-opacity-75 border-b-3">
                  {{ getText(webpage.name).highlighted }}
                </span>{{ getText(webpage.name).normal }}
              </li>
            </ul>
          </li>

          <li
            v-if="eventResults.length"
            class="flex flex-col justify-between px-4 pt-4"
            role="option"
            tabindex="-1"
            aria-selected="false"
          >
            <span class="flex items-start text-lg font-semibold text-gray-700 whitespace-nowrap dark:text-gray-300">
              <svg
                class="w-6 h-6 mr-1 text-gray-700 dark:text-gray-100 group-hover:text-gray-500 dark:text-gray-400"
                fill="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <path d="M12.75 12.75a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM7.5 15.75a.75.75 0 100-1.5.75.75 0 000 1.5zM8.25 17.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM9.75 15.75a.75.75 0 100-1.5.75.75 0 000 1.5zM10.5 17.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM12 15.75a.75.75 0 100-1.5.75.75 0 000 1.5zM12.75 17.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM14.25 15.75a.75.75 0 100-1.5.75.75 0 000 1.5zM15 17.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM16.5 15.75a.75.75 0 100-1.5.75.75 0 000 1.5zM15 12.75a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM16.5 13.5a.75.75 0 100-1.5.75.75 0 000 1.5z" />
                <path
                  clip-rule="evenodd"
                  fill-rule="evenodd"
                  d="M6.75 2.25A.75.75 0 017.5 3v1.5h9V3A.75.75 0 0118 3v1.5h.75a3 3 0 013 3v11.25a3 3 0 01-3 3H5.25a3 3 0 01-3-3V7.5a3 3 0 013-3H6V3a.75.75 0 01.75-.75zm13.5 9a1.5 1.5 0 00-1.5-1.5H5.25a1.5 1.5 0 00-1.5 1.5v7.5a1.5 1.5 0 001.5 1.5h13.5a1.5 1.5 0 001.5-1.5v-7.5z"
                />
              </svg>
              Events
            </span>

            <ul class="p-2 mt-2 bg-gray-100 rounded-lg dark:bg-gray-700">
              <li
                v-for="(event, index) in eventResults"
                :key="index"
                class="p-2 rounded-md cursor-pointer hover:bg-teal-500 hover:text-gray-50"
                @click="navigateEvent(event.id)"
              >
                <span class="font-semibold border-b border-teal-500 border-opacity-75 border-b-3">
                  {{ getText(event.name).highlighted }}
                </span>{{ getText(event.name).normal }}
              </li>
            </ul>
          </li>
          <li
            v-if="memberResults.length"
            class="flex flex-col justify-between px-4 pt-4"
            role="option"
            tabindex="-1"
            aria-selected="false"
          >
            <span class="flex items-start text-lg font-semibold text-gray-700 whitespace-nowrap dark:text-gray-300">
              <svg
                class="w-6 h-6 mr-1 text-gray-700 dark:text-gray-100 group-hover:text-gray-500 dark:text-gray-400"

                viewBox="0 0 24 24"
                fill="currentColor"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
                />
              </svg>
              Team Members
            </span>

            <ul class="p-2 mt-2 bg-gray-100 rounded-lg dark:bg-gray-700">
              <li
                v-for="(member, index) in memberResults"
                :key="index"
                class="p-2 rounded-md cursor-pointer hover:bg-teal-500 hover:text-gray-50"
                @click="navigateMember(member.id)"
              >
                <span class="font-semibold border-b border-teal-500 border-opacity-75 border-b-3">
                  {{ getText(member.name).highlighted }}
                </span>{{ getText(member.name).normal }}
              </li>
            </ul>
          </li>

          <li
            v-if="agencyResults.length"
            class="flex flex-col justify-between px-4 pt-4"
            role="option"
            tabindex="-1"
            aria-selected="false"
          >
            <span class="flex items-start text-lg font-semibold text-gray-700 whitespace-nowrap dark:text-gray-300">
              <svg
                class="w-6 h-6 mr-1 text-gray-700 dark:text-gray-100 group-hover:text-gray-500 dark:text-gray-400"
                fill="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <path d="M5.566 4.657A4.505 4.505 0 016.75 4.5h10.5c.41 0 .806.055 1.183.157A3 3 0 0015.75 3h-7.5a3 3 0 00-2.684 1.657zM2.25 12a3 3 0 013-3h13.5a3 3 0 013 3v6a3 3 0 01-3 3H5.25a3 3 0 01-3-3v-6zM5.25 7.5c-.41 0-.806.055-1.184.157A3 3 0 016.75 6h10.5a3 3 0 012.683 1.657A4.505 4.505 0 0018.75 7.5H5.25z" />
              </svg>
              Agencies
            </span>

            <ul class="p-2 mt-2 bg-gray-100 rounded-lg dark:bg-gray-700">
              <li
                v-for="(agency, index) in agencyResults"
                :key="index"
                class="p-2 rounded-md cursor-pointer hover:bg-teal-500 hover:text-gray-50"
                @click="navigateAgency(agency.id)"
              >
                <span class="font-semibold border-b border-teal-500 border-opacity-75 border-b-3">
                  {{ getText(agency.name).highlighted }}
                </span>{{ getText(agency.name).normal }}
              </li>
            </ul>
          </li>
        </ul>

        <EmptyState v-else />
      </div>
    </div>
  </div>
</template>
