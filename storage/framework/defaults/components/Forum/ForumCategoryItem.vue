<template>
  <div class="flex items-start p-4 hover:bg-gray-50">
    <div class="flex-shrink-0 mr-4">
      <div :class="[icon || 'i-hugeicons-chat', 'w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-gray-500']"></div>
    </div>

    <div class="flex-grow min-w-0">
      <h3 class="font-medium">
        <a :href="link" class="text-primary hover:underline">{{ title }}</a>
      </h3>
      <p class="text-sm text-gray-600 mt-1">{{ description }}</p>

      <div class="flex items-center gap-4 mt-2 text-xs text-gray-500">
        <div class="flex items-center gap-1">
          <div class="i-hugeicons-file"></div>
          <span>{{ topicCount }} topics</span>
        </div>
        <div class="flex items-center gap-1">
          <div class="i-hugeicons-chat"></div>
          <span>{{ postCount }} posts</span>
        </div>
      </div>
    </div>

    <div v-if="latestTopic" class="flex-shrink-0 ml-4 text-right">
      <a :href="latestTopic.link" class="text-sm font-medium text-primary hover:underline line-clamp-1">{{ latestTopic.title }}</a>
      <div class="text-xs text-gray-500 mt-1">
        {{ latestTopic.timeAgo }} by
        <a :href="latestTopic.authorLink" class="hover:underline">{{ latestTopic.author }}</a>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  title: string
  description: string
  link: string
  topicCount: number
  postCount: number
  icon?: string
  latestTopic?: {
    title: string
    link: string
    timeAgo: string
    author: string
    authorLink: string
  }
}>()
</script>