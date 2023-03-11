<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'

const {
  link,
  name,
} = defineProps<Props>()

interface Props {
  link: RouteLocationRaw
  name: String
}
</script>

<template>
  <router-link
    v-slot="{ isActive }"
    :to="link"
    aria-current="page"
    class="transition duration-150 ease-in-out sidebar-links group"
  >
    <DashboardIcon
      v-if="name === 'Dashboard'"
      :is-active="isActive"
    />
    <UsersIcon
      v-if="name === 'Users'"
      :is-active="isActive"
    />
    <WebpagesIcon
      v-if="name === 'Webpages'"
      :is-active="isActive"
    />
    <EventsIcon
      v-if="name === 'Events'"
      :is-active="isActive"
    />
    <ReportCenterIcon
      v-if="name === 'Reports Center'"
      :is-active="isActive"
    />
    <NotificationsIcon
      v-if="name === 'Notifications'"
      :is-active="isActive"
    />
    <TeamMembersIcon
      v-if="name === 'Team Members'"
      :is-active="isActive"
    />
    <OverviewIcon
      v-if="name === 'Overview'"
      :is-active="isActive"
    />
    <GeneralIcon
      v-if="name === 'General'"
      :is-active="isActive"
    />
    <SecurityIcon
      v-if="name === 'Security'"
      :is-active="isActive"
    />
    <MemberIcon
      v-if="name === 'Member'"
      :is-active="isActive"
    />
    <PageIcon
      v-if="name === 'Pages'"
      :is-active="isActive"
    />
    <LabelIcon
      v-if="name === 'Label'"
      :is-active="isActive"
    />
    <TemplateIcon
      v-if="name === 'Template'"
      :is-active="isActive"
    />
    <RoadmapIcon
      v-if="name === 'Roadmaps'"
      :is-active="isActive"
    />
    <UpdateIcon
      v-if="name === 'Project Updates'"
      :is-active="isActive"
    />
    <EmojisIcon
      v-if="name === 'Emojis'"
      :is-active="isActive"
    />
    <PlansIcon
      v-if="name === 'Plans'"
      :is-active="isActive"
    />
    <BillingIcon
      v-if="name === 'Billing'"
      :is-active="isActive"
    />
    <span
      :class="{ 'text-gray-900 dark:text-gray-100': isActive }"
      class="pt-1"
    >{{ name }}</span>
  </router-link>
</template>
