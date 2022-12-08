# Vite Tauri Desktop Application Template

This is a starter template for those who want to make a desktop application with web technologies. This template uses the below stack.

### Vite.js
Vite.js is a new modern bundler for javascript which is blazing fast and includes many sensible defaults.

### Tauri
Tauri is a new modern technology to turn your web apps into a desktop app for multiple platforms (Windows, MacOS, Linux, android and ios soon). Tauri apps have very small file size and tiny memory consumption.

### Vue 3
Vue.js is an incremental frontend framework which is an absolute joy to work with. It has seen very impressive improvements in version 3 including Composition Api, script setup, dynamic css binding and ... .

### UnoCSS 
Vuetify is arguably the best component library for Vue 3 and is currently in alpha stage but will soon be ready for production. Lots of premade components will make your job as application developer easier and more fun.

## Installation
- Ready your workspace according to Tauri. [Tauri Getting Started](https://tauri.app/v1/guides/getting-started/prerequisites/)

  - Note: You only need to install global things such as Rust and other OS level packages. Any thing related to application itself is already installed and ready for you.

- Clone repository
  - `git clone https://github.com/yooneskh/vite-tauri-template app-name`

- `yarn` (or `npm install` but yarn is preferred)

- Modify these files according to your app.

  - ./index.html
  - ./package.json
  - ./public/favicon.svg
  - ./src-tauri/icons/*
  - ./src-tauri/tauri.conf.json

## Development

There are two ways you can develo your app.

### In Browser
- `yarn serve`
  - launches vite and you can test and develop your app in the browser at http://localhost:8080.

### In Tauri Window

Launch two terminals and in

1- `yarn serve:tauri`

This launches Vite and configures [Unified Network](https://github.com/yooneskh/unified-network) (which is mine) to use Tauri for api calls (to get around CORS problems).

2- `yarn serve:native`

This launches Tauri window and you would see your app in the native window.

**Note:** There are mainly 2 differences between development in browser and in Tauri window.

- One is who executes your http calls, because when in browser, you are subject to CORS rules, but when testing in Tauri mode, Tauri's native module is executing the http calls so CORS will not be a problem.

- Second is the renderer engine. In browsers, it is usually the latest modern engine, but in Tauri, it will be the OS's web engine, which is good, but maybe not as good as the browsers.

## Building

`yarn build` builds web application and packages them with Tauri in "./src-tauri/target/releases".

## License
Do whatever you want with it!