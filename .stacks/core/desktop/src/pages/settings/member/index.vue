<script setup>
const user = {
  name: 'Debbie Lewis',
  handle: 'deblewis',
  email: 'debbielewis@example.com',
  imageUrl:
    'https://images.unsplash.com/photo-1517365830460-955ce3ccd263?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=4&w=320&h=320&q=80',
}
</script>

<template>
  <div>
    <div class="h-screen divide-y divide-gray-200 lg:grid lg:grid-cols-12 lg:divide-y-0 lg:divide-x lg:ml-64 lg:py-16 dark:bg-zinc-900">
      <form
        class="divide-y divide-gray-200 lg:col-span-10 lg:pl-48"
        action="#"
        method="POST"
      >
        <!-- General section -->
        <div class="py-6 px-4 sm:p-6 lg:pb-8">
          <div>
            <h2 class="section-title">
              Member
            </h2>
            <p class="section-text">
              Manage your workspace settings
            </p>
          </div>
          <div class="divider-line" />
          <div class="flex flex-col mt-6">
            <span>Logo</span>
            <div class="flex justify-center py-6 bg-sky-500 mt-6 w-18 text-lg rounded-md text-white">
              BR
            </div>
            <div class="text-gray-400 text-sm mt-3">
              Pick a logo for your workspace. Recommended size is 256x256px.
            </div>
          </div>
          <div class="divider-line" />
          <div class="flex flex-col mt-6">
            <span>General</span>
            <div class="mt-4">
              <label
                for="workspace-name"
                class="block text-sm font-medium text-gray-700 dark:text-gray-300 input-label"
              >Workspace Name</label>
              <input
                id="workspace-name"
                type="text"
                name="workspace-name"
                autocomplete="given-name"
                class="input w-1/3 mt-1 block rounded-md border border-gray-200 py-1 px-2.5 shadow-xs focus:border-sky-500 focus:outline-none focus:ring-sky-500 sm:text-sm"
              >
            </div>
            <div class="mt-6">
              <label
                for="workspace-url"
                class="block text-sm font-medium text-gray-700 dark:text-gray-300 input-label"
              >Workspace URL</label>
              <input
                id="workspace-url"
                type="text"
                name="workspace-url"
                autocomplete="given-name"
                class="input w-1/3 mt-1 block rounded-md border border-gray-200 py-1 px-2.5 shadow-xs focus:border-sky-500 focus:outline-none focus:ring-sky-500 sm:text-sm"
              >
            </div>
            <div class="mt-6">
              <button class="bg-indigo-500 settings-btn">
                Update
              </button>
            </div>
            <div class="divider-line" />
            <div class="flex flex-col mt-6">
              <div>Delete Workspace</div>
              <div class="text-sm text-gray-600 mt-4">
                If you want to permanently delete this workspace and all of its data, including but not limited to users, issues and comments, you can do so below.
              </div>
              <div class="mt-6">
                <button class="bg-red-400 text-white px-4 py-2 rounded-md text-sm">
                  Delete Workspace
                </button>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  </div>
</template>
