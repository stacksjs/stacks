<template>
    <aside class="bg-black/2 lg:fixed lg:bottom-0 lg:right-0 lg:top-16 lg:w-96 lg:overflow-y-auto lg:border-l lg:border-white/5">
        <header class="flex items-center justify-between border-b border-white/5 px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
            <h2 class="text-base font-semibold leading-7 dark:text-white">Activity feed</h2>
            <a href="#" class="text-sm font-semibold leading-6 text-indigo-600 dark:text-indigo-400">View all</a>
        </header>
        <ul role="list" class="divide-y divide-white/5">
            <li class="px-4 py-4 sm:px-6 lg:px-8">
                <div class="flex items-center gap-x-3">
                <img src="https://images.unsplash.com/photo-1519244703995-f4e0f30006d5?ixlib=rb-1.2.1&amp;ixid=eyJhcHBfaWQiOjEyMDd9&amp;auto=format&amp;fit=facearea&amp;facepad=2&amp;w=256&amp;h=256&amp;q=80" alt="" class="h-6 w-6 flex-none rounded-full bg-gray-800">
                <h3 class="flex-auto truncate text-sm font-semibold leading-6 dark:text-white">Michael Foster</h3>
                <time datetime="2023-01-23T11:00" class="flex-none text-xs text-gray-600">1h</time>
                </div>
                <p class="mt-3 truncate text-sm text-gray-500">Pushed to <span class="text-gray-400">ios-app</span> (<span class="font-mono text-gray-400">2d89f0c8</span> on <span class="text-gray-400">main</span>)</p>
            </li>
            <li class="px-4 py-4 sm:px-6 lg:px-8">
                <div class="flex items-center gap-x-3">
                <img src="https://images.unsplash.com/photo-1517841905240-472988babdf9?ixlib=rb-1.2.1&amp;ixid=eyJhcHBfaWQiOjEyMDd9&amp;auto=format&amp;fit=facearea&amp;facepad=2&amp;w=256&amp;h=256&amp;q=80" alt="" class="h-6 w-6 flex-none rounded-full bg-gray-800">
                <h3 class="flex-auto truncate text-sm font-semibold leading-6 dark:text-white">Lindsay Walton</h3>
                <time datetime="2023-01-23T09:00" class="flex-none text-xs text-gray-600">3h</time>
                </div>
                <p class="mt-3 truncate text-sm text-gray-500">Pushed to <span class="text-gray-400">mobile-api</span> (<span class="font-mono text-gray-400">249df660</span> on <span class="text-gray-400">main</span>)</p>
            </li>
            <li class="px-4 py-4 sm:px-6 lg:px-8">
                <div class="flex items-center gap-x-3">
                <img src="https://images.unsplash.com/photo-1438761681033-6461ffad8d80?ixlib=rb-1.2.1&amp;ixid=eyJhcHBfaWQiOjEyMDd9&amp;auto=format&amp;fit=facearea&amp;facepad=2&amp;w=256&amp;h=256&amp;q=80" alt="" class="h-6 w-6 flex-none rounded-full bg-gray-800">
                <h3 class="flex-auto truncate text-sm font-semibold leading-6 dark:text-white">Courtney Henry</h3>
                <time datetime="2023-01-23T00:00" class="flex-none text-xs text-gray-600">12h</time>
                </div>
                <p class="mt-3 truncate text-sm text-gray-500">Pushed to <span class="text-gray-400">ios-app</span> (<span class="font-mono text-gray-400">11464223</span> on <span class="text-gray-400">main</span>)</p>
            </li>
            <li class="px-4 py-4 sm:px-6 lg:px-8">
                <div class="flex items-center gap-x-3">
                <img src="https://images.unsplash.com/photo-1438761681033-6461ffad8d80?ixlib=rb-1.2.1&amp;ixid=eyJhcHBfaWQiOjEyMDd9&amp;auto=format&amp;fit=facearea&amp;facepad=2&amp;w=256&amp;h=256&amp;q=80" alt="" class="h-6 w-6 flex-none rounded-full bg-gray-800">
                <h3 class="flex-auto truncate text-sm font-semibold leading-6 dark:text-white">Courtney Henry</h3>
                <time datetime="2023-01-21T13:00" class="flex-none text-xs text-gray-600">2d</time>
                </div>
                <p class="mt-3 truncate text-sm text-gray-500">Pushed to <span class="text-gray-400">tailwindui.com</span> (<span class="font-mono text-gray-400">dad28e95</span> on <span class="text-gray-400">main</span>)</p>
            </li>
            <li class="px-4 py-4 sm:px-6 lg:px-8">
                <div class="flex items-center gap-x-3">
                <img src="https://images.unsplash.com/photo-1519244703995-f4e0f30006d5?ixlib=rb-1.2.1&amp;ixid=eyJhcHBfaWQiOjEyMDd9&amp;auto=format&amp;fit=facearea&amp;facepad=2&amp;w=256&amp;h=256&amp;q=80" alt="" class="h-6 w-6 flex-none rounded-full bg-gray-800">
                <h3 class="flex-auto truncate text-sm font-semibold leading-6 dark:text-white">Michael Foster</h3>
                <time datetime="2023-01-18T12:34" class="flex-none text-xs text-gray-600">5d</time>
                </div>
                <p class="mt-3 truncate text-sm text-gray-500">Pushed to <span class="text-gray-400">relay-service</span> (<span class="font-mono text-gray-400">624bc94c</span> on <span class="text-gray-400">main</span>)</p>
            </li>
            <li class="px-4 py-4 sm:px-6 lg:px-8">
                <div class="flex items-center gap-x-3">
                <img src="https://images.unsplash.com/photo-1438761681033-6461ffad8d80?ixlib=rb-1.2.1&amp;ixid=eyJhcHBfaWQiOjEyMDd9&amp;auto=format&amp;fit=facearea&amp;facepad=2&amp;w=256&amp;h=256&amp;q=80" alt="" class="h-6 w-6 flex-none rounded-full bg-gray-800">
                <h3 class="flex-auto truncate text-sm font-semibold leading-6 dark:text-white">Courtney Henry</h3>
                <time datetime="2023-01-16T15:54" class="flex-none text-xs text-gray-600">1w</time>
                </div>
                <p class="mt-3 truncate text-sm text-gray-500">Pushed to <span class="text-gray-400">api.protocol.chat</span> (<span class="font-mono text-gray-400">e111f80e</span> on <span class="text-gray-400">main</span>)</p>
            </li>
            <li class="px-4 py-4 sm:px-6 lg:px-8">
                <div class="flex items-center gap-x-3">
                <img src="https://images.unsplash.com/photo-1519244703995-f4e0f30006d5?ixlib=rb-1.2.1&amp;ixid=eyJhcHBfaWQiOjEyMDd9&amp;auto=format&amp;fit=facearea&amp;facepad=2&amp;w=256&amp;h=256&amp;q=80" alt="" class="h-6 w-6 flex-none rounded-full bg-gray-800">
                <h3 class="flex-auto truncate text-sm font-semibold leading-6 dark:text-white">Michael Foster</h3>
                <time datetime="2023-01-16T11:31" class="flex-none text-xs text-gray-600">1w</time>
                </div>
                <p class="mt-3 truncate text-sm text-gray-500">Pushed to <span class="text-gray-400">api.protocol.chat</span> (<span class="font-mono text-gray-400">5e136005</span> on <span class="text-gray-400">main</span>)</p>
            </li>
            <li class="px-4 py-4 sm:px-6 lg:px-8">
                <div class="flex items-center gap-x-3">
                <img src="https://images.unsplash.com/photo-1517365830460-955ce3ccd263?ixlib=rb-1.2.1&amp;ixid=eyJhcHBfaWQiOjEyMDd9&amp;auto=format&amp;fit=facearea&amp;facepad=2&amp;w=256&amp;h=256&amp;q=80" alt="" class="h-6 w-6 flex-none rounded-full bg-gray-800">
                <h3 class="flex-auto truncate text-sm font-semibold leading-6 dark:text-white">Whitney Francis</h3>
                <time datetime="2023-01-09T08:45" class="flex-none text-xs text-gray-600">2w</time>
                </div>
                <p class="mt-3 truncate text-sm text-gray-500">Pushed to <span class="text-gray-400">ios-app</span> (<span class="font-mono text-gray-400">5c1fd07f</span> on <span class="text-gray-400">main</span>)</p>
            </li>
        </ul>
    </aside>
</template>

<script setup lang="ts">
const github = useGithub()


console.log(github)
</script>