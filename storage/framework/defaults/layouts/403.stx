a<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const searchQuery = ref('')

const handleSearch = (e) => {
  e.preventDefault()
  console.log('Searching for:', searchQuery.value)
}

const goBack = () => {
  router.back()
}
</script>

<template>
  <div class="min-h-screen flex flex-col lg:flex-row bg-gradient-to-br from-slate-50 to-slate-100">
    <!-- Left side content -->
    <div class="w-full lg:w-1/2 flex items-center justify-center p-8">
      <div class="max-w-xl w-full">
        <div class="flex items-center justify-between mb-16">
          <div class="flex items-center space-x-2">
            <h1 class="text-xl font-bold text-slate-900">Your App</h1>
          </div>
        </div>

        <div class="">
          <h2 class="text-6xl font-bold text-slate-900 mb-4">
            Access Denied
          </h2>
          <p class="text-8xl font-bold mb-8 bounce" style="animation-duration: 1s; animation-iteration-count: 2;">
            403
          </p>
          <p class="text-xl text-slate-600 mb-8">
            Sorry, you don't have permission to access this page.
          </p>

          <div class="flex sm:flex-row gap-4">
            <router-link
              to="/"
              class="flex items-center justify-center px-6 py-3 bg-slate-500 text-white rounded-lg hover:bg-slate-600 transition-colors duration-200 w-full sm:w-auto"
            >
              <i class="i-hugeicons-home-03 h-5 w-5 mr-2" />
              Back to Home
            </router-link>

            <button
              @click="goBack"
              class="flex items-center justify-center px-6 py-3 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors duration-200 w-full sm:w-auto"
            >
              <i class="i-hugeicons-arrow-left-02 h-5 w-5 mr-2" />
              Go Back
            </button>
          </div>
        </div>

        <div class="mt-16 border-t border-slate-200 pt-8">
          <p class="text-slate-600">
            Need help? Contact us at
            <a href="mailto:support@example.com" class="text-slate-500 hover:text-slate-600">
              support@example.com
            </a>
          </p>
        </div>
      </div>
    </div>

    <!-- Right side SVG -->
    <div class="w-full lg:w-1/2 h-[100vh] relative overflow-hidden flex items-center justify-center">
      <svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
        <defs>
          <linearGradient id="a" x1="50%" x2="50%" y1="100%" y2="0%">
            <stop offset="0" stop-color="#76c3c3"/>
            <stop offset="1" stop-color="#183468"/>
          </linearGradient>
          <linearGradient id="b" x1="100%" x2="0%" y1="50%" y2="50%">
            <stop offset="0" stop-color="#486587"/>
            <stop offset=".3323" stop-color="#183352"/>
            <stop offset=".6667" stop-color="#264a6e"/>
            <stop offset="1" stop-color="#183352"/>
          </linearGradient>
          <linearGradient id="c" x1="49.87%" x2="48.5%" y1="3.62%" y2="100%">
            <stop offset="0" stop-color="#e0f2fa"/>
            <stop offset=".0898" stop-color="#89bed6"/>
            <stop offset=".3298" stop-color="#1e3c6e"/>
            <stop offset="1" stop-color="#1b376b"/>
          </linearGradient>
          <linearGradient id="d">
            <stop offset="0" stop-color="#b0ddf1"/>
            <stop offset="1" stop-color="#325c82"/>
          </linearGradient>
          <linearGradient id="e" x1="49.87%" x2="49.87%" xlink:href="#d" y1="3.62%" y2="77.75%"/>
          <linearGradient id="f">
            <stop offset="0" stop-color="#1d3a6d"/>
            <stop offset="1" stop-color="#467994"/>
          </linearGradient>
          <linearGradient id="g" x1="91.59%" x2="66.97%" xlink:href="#f" y1="5.89%" y2="100%"/>
          <linearGradient id="h" x1="97.27%" x2="52.53%" xlink:href="#f" y1="6.88%" y2="100%"/>
          <linearGradient id="i" x1="82.73%" x2="41.46%" xlink:href="#f" y1="41.06%" y2="167.23%"/>
          <linearGradient id="j" x1="49.87%" x2="49.87%" xlink:href="#d" y1="3.62%" y2="100.77%"/>
          <linearGradient id="k" x1="100%" x2="72.45%" xlink:href="#f" y1="0%" y2="85.2%"/>
          <linearGradient id="l" x1="100%" x2="62.1%" y1="0%" y2="68.86%">
            <stop offset="0" stop-color="#163055"/>
            <stop offset="1" stop-color="#2f587f"/>
          </linearGradient>
          <circle id="m" cx="180" cy="102" r="40"/>
          <filter id="n" height="340%" width="340%" x="-120%" y="-120%">
            <feOffset in="SourceAlpha" result="shadowOffsetOuter1"/>
            <feGaussianBlur in="shadowOffsetOuter1" result="shadowBlurOuter1" stdDeviation="32"/>
            <feColorMatrix in="shadowBlurOuter1" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.696473053 0"/>
          </filter>
          <linearGradient id="o" x1="0%" y1="50%" y2="50%">
            <stop offset="0" stop-color="#fff" stop-opacity="0"/>
            <stop offset="1" stop-color="#fff"/>
          </linearGradient>
        </defs>
        <g fill="none" fill-rule="evenodd">
          <path d="m0 0h1024v1024h-1024z" fill="url(#a)"/>
          <g transform="translate(761 481)">
            <path d="m96 27 4-1v11h-4z" fill="#8dbcd2"/>
            <path d="m76 23 4-1v15h-4z" fill="#8dbcd2"/>
            <g fill="#183352">
              <path d="m40 22 4 1v14h-4z"/>
              <path d="m20 26 4 1v14h-4z"/>
              <path d="m59 0h2v20h-2z" opacity=".5"/>
            </g>
            <path d="m61 0c3 0 3 2 6 2s3-2 6-2 3 2 6 2v8c-3 0-3-2-6-2s-3 2-6 2-3-2-6-2z" fill="url(#b)"/>
            <path d="m50 20 10-2v110h-60l10-100 10-2v10.92l10-.98v-11.94l10-2v12.96l10-.98z" fill="#8dbcd2"/>
            <path d="m100 26 10 2 10 100h-60v-110l10 2v13.98l10 .98v-12.96l10 2v11.94l10 .98z" fill="#183352"/>
          </g>
          <g transform="translate(0 565)">
            <path d="m1024 385h-1024v-278.14c118.4 21.09 185.14 57.03 327.4 48.14 198.54-12.4 250-125 500-125 90.18 0 147.92 16.3 196.6 37.12z" fill="url(#c)"/>
            <path d="m1024 355h-1024v-275.44c76.46-35.75 137.14-79.56 285-79.56 250 0 301.46 112.6 500 125 103.24 6.45 166.7-10.7 239-28.66z" fill="url(#e)"/>
            <path d="m344.12 130.57c23.1 13.47-25.27 81.95-145.12 205.43h649c-344.06-141.7-512.02-210.17-503.88-205.43z" fill="url(#e)"/>
            <path d="m0 336v-256.44c76.46-35.75 137.14-79.56 285-79.56 71.14 0 86.22 26.04 32.5 82-48 50 147.33 58.02 36 136.5-40.67 28.67 21.17 67.83 185.5 117.5z" fill="url(#g)"/>
            <path d="m317.5 82c-48 50 147.33 58.02 36 136.5-40.67 28.67 21.17 67.83 185.5 117.5h-484z" fill="url(#h)"/>
            <path d="m353.5 218.5c-40.67 28.67 21.17 67.83 185.5 117.5h-364z" fill="url(#i)"/>
            <path d="m0 459v-194.46c100.25 21.2 167.18 50.29 296.67 42.19 198.57-12.43 250.04-125.15 500.07-125.15 109.75 0 171.47 24.16 227.26 51.25v226.17z" fill="url(#j)"/>
            <path d="m1024 459h-177.84c51.95-58.9 48.86-97.16-9.28-114.78-186.64-56.58-101.76-162.64-39.97-162.64 109.64 0 171.34 24.12 227.09 51.19z" fill="url(#k)"/>
            <path d="m1024 459h-177.81c52.01-59.01 48.94-97.34-9.22-115l187.03 53.48z" fill="url(#l)"/>
          </g>
          <g id="moonGroup">
            <g transform="translate(94 23)">
              <use fill="#000" filter="url(#n)" xlink:href="#m"/>
              <use fill="#d2f1fe" xlink:href="#m"/>
            </g>
          </g>
          <g transform="translate(94 23)">
            <use fill="#000" filter="url(#n)" xlink:href="#m"/>
            <g fill="#fff">
              <circle cx="123" cy="255" fill-opacity=".4" r="3"/>
              <circle cx="2" cy="234" r="2"/>
              <circle cx="33" cy="65" r="3"/>
              <circle cx="122" cy="2" r="2"/>
              <circle cx="72" cy="144" r="2"/>
              <circle cx="282" cy="224" r="2"/>
              <circle cx="373" cy="65" opacity=".4" r="3"/>
              <circle cx="433" cy="255" r="3"/>
            </g>
            <path d="m373.25 325.25a5 5 0 0 0 0-10h-75v10z" fill="url(#o)" opacity=".4" transform="matrix(.70710678 .70710678 -.70710678 .70710678 325.523078 -145.38023)"/>
            <g fill="#fff">
              <circle cx="363" cy="345" r="3"/>
              <circle cx="513" cy="115" r="3"/>
              <circle cx="723" cy="5" opacity=".4" r="3"/>
              <circle cx="422" cy="134" r="2"/>
              <circle cx="752" cy="204" r="2"/>
              <circle cx="672" cy="114" r="2"/>
              <circle cx="853" cy="255" opacity=".4" r="3"/>
              <circle cx="623" cy="225" r="3"/>
              <circle cx="823" cy="55" r="3"/>
              <circle cx="902" cy="144" r="2"/>
              <circle cx="552" cy="14" r="2"/>
            </g>
          </g>
          <path d="m796 535a4 4 0 0 1 4 4v20h-8v-20a4 4 0 0 1 4-4z" fill="#486587"/>
          <path d="m798 535.54a4 4 0 0 0 -2 3.46v20h-4v-20a4 4 0 0 1 6-3.46zm48-.54a4 4 0 0 1 4 4v20h-8v-20a4 4 0 0 1 4-4z" fill="#071423"/>
          <path d="m846 559v-20a4 4 0 0 0 -2-3.46 4 4 0 0 1 6 3.46v20z" fill="#8dbcd2"/>
          <path d="m554.67 131.48a9.46 9.46 0 0 1 13.33 0 9.46 9.46 0 0 0 13.33 0l13.33-13.24a28.39 28.39 0 0 1 40 0l10 9.93a14.2 14.2 0 0 0 20 0 14.2 14.2 0 0 1 20 0l.6.6a31.8 31.8 0 0 1 9.4 22.56h-146.66v-3.84c0-6.01 2.4-11.78 6.67-16.01zm196.33-123.23c11.07-11 28.93-11 40 0l10 9.94a14.19 14.19 0 0 0 20 0 14.19 14.19 0 0 1 20 0 16.36 16.36 0 0 0 21.3 1.5l8.7-6.47a33.47 33.47 0 0 1 40 0l4.06 3.03a39.6 39.6 0 0 1 15.94 31.75h-200c0-12.72 8.93-28.75 20-39.75zm-736.9 66.89.9-.9a21.29 21.29 0 0 1 30 0 21.29 21.29 0 0 0 30 0l10-9.93a35.48 35.48 0 0 1 50 0l15 14.9a14.2 14.2 0 0 0 20 0 14.2 14.2 0 0 1 20 0c6.4 6.35 10 15 10 24.02v5.77h-200c0-12.71 5.07-24.9 14.1-33.86z" fill="#fff" opacity=".07" transform="translate(54 301)"/>
        </g>
      </svg>
    </div>
  </div>
</template>

<style>
@keyframes floatMoon {
  0% { transform: translateX(0); }
  50% { transform: translateX(20px); }
  100% { transform: translateX(0); }
}
#moonGroup {
  animation: floatMoon 4s ease-in-out infinite;
}

@keyframes waveTop {
  0% { transform: translateY(0); }
  50% { transform: translateY(-2px); }
  100% { transform: translateY(0); }
}

g[transform="translate(761 481)"] path[d="m61 0c3 0 3 2 6 2s3-2 6-2 3 2 6 2v8c-3 0-3-2-6-2s-3 2-6 2-3-2-6-2z"] {
  animation: waveTop 2s ease-in-out infinite;
}

g[transform="translate(761 481)"] g[fill="#183352"] path {
  animation: waveTop 2s ease-in-out infinite;
}
</style>
