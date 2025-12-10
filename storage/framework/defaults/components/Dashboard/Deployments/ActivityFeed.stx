<script setup lang="ts">
const githubStore = useGitStore()
const github = useGitHub()

onMounted(async () => {
  await githubStore.fetchCommits()
})
</script>

<template>
  <aside class="bg-black/2 lg:fixed lg:bottom-0 lg:right-0 lg:top-16 lg:w-96 lg:overflow-y-auto lg:border-l lg:border-white/5">
    <header class="flex items-center justify-between border-b border-white/5 px-4 py-4 lg:px-8 sm:px-6 sm:py-6">
      <h2 class="text-base font-semibold leading-7 dark:text-white">
        Activity feed
      </h2>
    </header>
    <ul v-if="githubStore.hasCommits" role="list" class="divide-y divide-gray-200">
      <li v-for="(commit, index) in githubStore.getCommits" :key="index" class="px-4 py-4 lg:px-8 sm:px-6">
        <div class="flex items-center gap-x-3">
          <a target="_new" :href="commit.author.html_url"><img :src="commit.author.avatar_url" alt="" class="h-6 w-6 flex-none rounded-full bg-gray-800"></a>
          <a target="_new" :href="commit.author.html_url" class="flex-auto truncate text-sm font-semibold leading-6 dark:text-white">{{ commit.author.login }}</a>
          <time :datetime="commit.commit.committer.date" class="flex-none text-xs text-gray-600">{{ github.getTimeDifference(commit.commit.committer.date) }}</time>
        </div>
        <p class="mt-3 text-sm text-gray-500">
          <a :href="commit.commit.url" class="truncate text-gray-400 font-mono hover:text-gray-500">{{ commit.sha.slice(0, 10) }}</a> on <span class="text-gray-400">main</span>
        </p>
      </li>
    </ul>
  </aside>
</template>
