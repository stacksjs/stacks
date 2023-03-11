<script lang="ts" setup>
// import { ArrowLeftIcon } from '@heroicons/vue/24/outline'

import { useHealthStore } from '../stores/health'

const keys = useMagicKeys()
const watchedKeys = keys['cmd+shift+,']

const router = useRouter()
const route = useRoute()

const healthStore = useHealthStore()

const healthSubSection = ref(false)

watch(watchedKeys, (v) => {
  if (v)
    router.push('/settings/overview')
})

onMounted(() => {
  handleHash()
})

function handleHash(): void {
  if (route.hash === '#performance')
    healthStore.setActiveTab('performance')

  if (route.hash === '#overview')
    healthStore.setActiveTab('overview')

  if (route.hash === '#uptime')
    healthStore.setActiveTab('uptime')

  if (route.hash === '#broken-links')
    healthStore.setActiveTab('broken-links')

  if (route.hash === '#application-health')
    healthStore.setActiveTab('application-health')

  if (route.hash === '#monthly-reports')
    healthStore.setActiveTab('monthly-reports')

  if (route.hash === '#notifications')
    healthStore.setActiveTab('notifications')
}

function setActive(menu: string) {
  healthStore.setActiveTab(menu)

  router.push({ name: 'health', hash: `#${menu}` })
}

function toggleHealthSubsection() {
  healthSubSection.value = !healthSubSection.value
}

function closeHealthSubsection() {
  healthSubSection.value = false
}

function toggleHealthMenu() {
  router.push({ name: 'health' })
  toggleHealthSubsection()
}
</script>

<template>
  <div class="flex flex-col flex-1 h-0 pt-1 mt-5 overflow-y-auto">
    <div
      v-if=" !route.fullPath.includes('settings')"
      class="relative inline-block px-3 text-left"
    >
      <nav class="px-3 mt-6">
        <div class="space-y-2">
          <SidebarLink
            name="Dashboard"
            link="/"
            @click="closeHealthSubsection"
          />
          <SidebarLink
            name="Users"
            link="/users"
            @click="closeHealthSubsection"
          />
          <SidebarLink
            name="Webpages"
            link="/webpages"
            @click="closeHealthSubsection"
          />
          <SidebarLink
            name="Events"
            link="/events"
            @click="closeHealthSubsection"
          />
          <SidebarLink
            name="Reports Center"
            link="/reports-center"
            @click="closeHealthSubsection"
          />

          <SidebarLink
            name="Pages"
            link="/pages"
            @click="closeHealthSubsection"
          />

          <SidebarLink
            name="Team Members"
            link="/team-members"
            @click="closeHealthSubsection"
          />
          <!-- <SidebarLink
            v-if="false"
            name="Notifications"
            link="/notifications"
            @click="closeHealthSubsection"
          /> -->
          <a
            href="#"
            aria-current="page"
            class="transition duration-150 ease-in-out sidebar-links group"
            @click="toggleHealthMenu"
          >
            <!-- :class="{ 'text-gray-900 dark:text-gray-100': isActive, 'group-hover:text-gray-900': !isDark }" -->
            <div class="flex items-end flex-1">

              <svg
                class="w-5 h-5 mr-3 text-gray-700 dark:text-gray-100 group-hover:text-gray-500 dark:text-gray-400"
                fill="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
              </svg>

              <span>Health</span>

              <!-- :class="{ 'text-gray-900 dark:text-gray-100': isActive }" class="pt-1" -->
            </div>

            <!-- down -->
            <svg
              v-if="!healthSubSection"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
              class="flex-shrink-0 w-5 h-5 text-gray-700 dark:text-gray-100 group-hover:text-gray-500 dark:text-gray-400"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M19.5 8.25l-7.5 7.5-7.5-7.5"
              />
            </svg>

            <!-- up -->
            <svg
              v-else
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
              class="flex-shrink-0 w-5 h-5 text-gray-700 dark:text-gray-100 group-hover:text-gray-500 dark:text-gray-400"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M4.5 15.75l7.5-7.5 7.5 7.5"
              />
            </svg>
          </a>

          <div
            v-if="healthSubSection"
            class="pl-8"
          >
            <ul class="space-y-2">
              <li
                class="text-xs duration-150 ease-in-out cursor-pointer sidebar-links"
                :class="{ 'active-subsection-sidebar': healthStore.currentTab === 'overview' }"
                @click="setActive('overview')"
              >
                <svg
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.5"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                  class="w-5 h-5 mr-1 text-gray-700 dark:text-gray-100 group-hover:text-gray-500 dark:text-gray-400"
                  :class="{ 'text-gray-900 dark:text-gray-100': healthStore.currentTab === 'overview', 'group-hover:text-gray-900': !isDark }"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z"
                  />
                </svg>
                Overview
              </li>
              <li
                class="text-xs duration-150 ease-in-out cursor-pointer sidebar-links"
                :class="{ 'active-subsection-sidebar': healthStore.currentTab === 'uptime' }"
                @click="setActive('uptime')"
              >
                <svg
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.5"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                  class="w-5 h-5 mr-1 text-gray-700 dark:text-gray-100 group-hover:text-gray-500 dark:text-gray-400"
                  :class="{ 'text-gray-900 dark:text-gray-100': healthStore.currentTab === 'uptime', 'group-hover:text-gray-900': !isDark }"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                Uptime
              </li>
              <li
                class="text-xs duration-150 ease-in-out cursor-pointer sidebar-links"
                :class="{ 'active-subsection-sidebar': healthStore.currentTab === 'performance' }"
                @click="setActive('performance')"
              >
                <svg
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.5"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                  class="w-5 h-5 mr-1 text-gray-700 dark:text-gray-100 group-hover:text-gray-500 dark:text-gray-400"
                  :class="{ 'text-gray-900 dark:text-gray-100': healthStore.currentTab === 'performance', 'group-hover:text-gray-900': !isDark }"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941"
                  />
                </svg>
                Performance
              </li>
              <li
                class="text-xs duration-150 ease-in-out cursor-pointer sidebar-links"
                :class="{ 'active-subsection-sidebar': healthStore.currentTab === 'broken-links' }"
                @click="setActive('broken-links')"
              >
                <svg
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.5"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                  class="w-5 h-5 mr-1 text-gray-700 dark:text-gray-100 group-hover:text-gray-500 dark:text-gray-400"
                  :class="{ 'text-gray-900 dark:text-gray-100': healthStore.currentTab === 'broken-links', 'group-hover:text-gray-900': !isDark }"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M3 3l8.735 8.735m0 0a.374.374 0 11.53.53m-.53-.53l.53.53m0 0L21 21M14.652 9.348a3.75 3.75 0 010 5.304m2.121-7.425a6.75 6.75 0 010 9.546m2.121-11.667c3.808 3.807 3.808 9.98 0 13.788m-9.546-4.242a3.733 3.733 0 01-1.06-2.122m-1.061 4.243a6.75 6.75 0 01-1.625-6.929m-.496 9.05c-3.068-3.067-3.664-7.67-1.79-11.334M12 12h.008v.008H12V12z"
                  />
                </svg>
                Broken Links
              </li>
              <li
                class="text-xs duration-150 ease-in-out cursor-pointer sidebar-links"
                :class="{ 'active-subsection-sidebar': healthStore.currentTab === 'application-health' }"
                @click="setActive('application-health')"
              >
                <svg
                  class="flex-shrink-0 w-5 h-5 mr-1 text-gray-700 dark:text-gray-100 group-hover:text-gray-500 dark:text-gray-400"
                  :class="{ 'text-gray-900 dark:text-gray-100': healthStore.currentTab === 'application-health', 'group-hover:text-gray-900': !isDark }"
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
                    d="M11.35 3.836c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m8.9-4.414c.376.023.75.05 1.124.08 1.131.094 1.976 1.057 1.976 2.192V16.5A2.25 2.25 0 0118 18.75h-2.25m-7.5-10.5H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V18.75m-7.5-10.5h6.375c.621 0 1.125.504 1.125 1.125v9.375m-8.25-3l1.5 1.5 3-3.75"
                  />
                </svg>
                Application Health
              </li>
            </ul>
          </div>
        </div>
      </nav>
    </div>
    <div
      v-else-if="route.fullPath.includes('settings')"
      class="relative inline-block px-3 text-left"
    >
      <nav class="px-3 mt-2">
        <router-link
          class="flex items-center text-gray-600 dark:text-gray-200"
          to="/"
        >
          <svg
            fill="currentColor"
            class="w-4 h-4 mr-5"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path
              clip-rule="evenodd"
              fill-rule="evenodd"
              d="M11.03 3.97a.75.75 0 010 1.06l-6.22 6.22H21a.75.75 0 010 1.5H4.81l6.22 6.22a.75.75 0 11-1.06 1.06l-7.5-7.5a.75.75 0 010-1.06l7.5-7.5a.75.75 0 011.06 0z"
            />
          </svg>
          <div class="text-l">
            Back
          </div>
        </router-link>
        <div class="mt-5 space-y-2">
          <SidebarLink
            name="Overview"
            link="/settings/overview"
          />
          <SidebarLink
            name="General"
            link="/settings/general"
          />
          <SidebarLink
            name="Security"
            link="/settings/security"
          />
          <SidebarLink
            name="Member"
            link="/settings/member"
          />
          <SidebarLink
            name="Label"
            link="/settings/label"
          />
          <SidebarLink
            name="Template"
            link="/settings/template"
          />
          <SidebarLink
            name="Roadmaps"
            link="/settings/roadmaps"
          />
          <SidebarLink
            name="Project Updates"
            link="/settings/project-updates"
          />
          <SidebarLink
            name="Emojis"
            link="/settings/emojis"
          />
          <SidebarLink
            name="Plans"
            link="/settings/plans"
          />
          <SidebarLink
            name="Billing"
            link="/settings/billing"
          />
        </div>
      </nav>
    </div>
  </div>
</template>
