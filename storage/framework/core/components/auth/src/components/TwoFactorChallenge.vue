<template>
  <div class="py-32">
    <div class="mx-auto max-w-sm px-8 py-4 rounded-md shadow-md">
      <div class="card-body">
        <form method="POST" action="/two-factor-challenge">
          <div>
            <h3 class="text-center text-sm text-gray-900 font-semibold">
              Two Factor Authentication
            </h3>
            <label for="code" class="block text-sm font-medium leading-6 mt-4 text-gray-900">
              Authentication code
            </label>
            <div class="relative mt-2 rounded-md shadow-sm">
              <input id="code" type="code" name="code" placeholder="XXXXXX" class="block w-full px-2 rounded-md border-0 py-2 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6">
            </div>
          </div>
          <div class="py-4">
            <button type="submit" class="relative w-full font-semibold border-teal text-white bg-teal flex items-center justify-center h-8 px-4 rounded-full focus:outline-none">
              Verify
            </button>
          </div>
          <div>
            <p class="text-gray-700 font-semibold text-xs">
              Open your Symantec 2FA app to view your authentication code.
            </p>
          </div>
          <div class="mt-4">
            <p class="text-gray-700 font-semibold text-xs">
              Having Problems?
            </p>
            <a href="/two-factor-authentication?mode=recovery" class="hover:underline text-blue-500 text-xs">Use recovery code instead</a>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>
