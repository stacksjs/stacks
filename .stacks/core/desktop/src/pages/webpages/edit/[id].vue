<script setup lang="ts">
import { useWebpageStore } from '~/stores/webpage'

const webpageStore = useWebpageStore()

const active = ref('')

const router = useRouter()
const route = useRoute()

function changeActive(menu: string) {
  active.value = menu

  router.push({ hash: `#${menu}` })
}

onMounted(() => {
  loadDefaultMenu()
})

function loadDefaultMenu() {
  if (route.hash === '#leads')
    active.value = 'leads'

  if (route.hash === '#status')
    active.value = 'status'

  if (route.hash === '#card')
    active.value = 'card'

  if (route.hash === '#site' || route.hash === '')
    active.value = 'site'

  if (route.hash === '#personal')
    active.value = 'personal'

  if (route.hash === '#header-image')
    active.value = 'header-image'
  if (route.hash === '#primary-text')
    active.value = 'primary-text'
  if (route.hash === '#secondary-text')
    active.value = 'secondary-text'
}

const isEditFormActive = computed(() => {
  return [
    'site',
    'personal',
    'header-image',
    'primary-text',
    'secondary-text',
  ].includes(active.value)
})

onMounted(async () => {
  await fetchWebpage()
})

async function fetchWebpage() {
  await webpageStore.fetchWebpage(route.params.id)
}

function viewWebpage() {
  window.open(getSubdomainLink(webpageStore.webpage.subdomain))
}

function getSubdomainLink(subdomain: string) {
  return `https://${subdomain}.agentmedicareplans.com`
}
</script>

<template>
  <div>
    <div class="flex flex-col lg:pl-64">
      <main class="flex-1">
        <TopBar />

        <div class="dark:bg-gray-800">
          <div class="px-4 py-12 sm:px-6 lg:px-8">
            <div class="flex items-center justify-start">
              <div class="flex items-center flex-1">
                <div class="pr-2">
                  <button
                    class="text-gray-400 hover:text-gray-600"
                    @click="router.go(-1)"
                  >
                    <svg
                      fill="none"
                      stroke="currentColor"
                      class="w-6 h-6"
                      stroke-width="2"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                      aria-hidden="true"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"
                      />
                    </svg>
                  </button>
                </div>

                <div class="flex items-center">
                  <svg
                    class="flex-shrink-0 w-8 h-8 mr-2 text-gray-400 svg sprite-sprites"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  ><path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
                  /></svg>
                  <span class="dark:text-gray-300">
                    {{ `${webpageStore.webpage.first_name} ${webpageStore.webpage.last_name}` }} Agent Website
                  </span>
                </div>
              </div>
              <div>
                <button
                  type="button"
                  class="primary-button"
                  @click="viewWebpage()"
                >
                  <svg
                    class="flex-shrink-0 w-6 h-6 mr-2 text-gray-100"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  ><path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  /><path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                  /></svg>

                  View Website
                </button>
              </div>
            </div>

            <div v-if="!isEmpty(webpageStore.webpage)">
              <MainHeader
                :active-status="active"
                :webpage="webpageStore.webpage"
                @active-menu="changeActive"
              />

              <WebpageForm
                v-if="isEditFormActive"
                :active-status="active"
                :webpage="webpageStore.webpage"
                @active-menu="changeActive"
              />

              <WebpageStatus
                v-if="active === 'status'"
                :webpage="webpageStore.webpage"
              />

              <LeadSubmission v-if="active === 'leads'" />

              <BusinessCard
                v-if="active === 'card'"
                :webpage="webpageStore.webpage"
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  </div>
</template>
