<script setup lang="ts">
import backgroundImage from '../../assets/images/background-faqs.jpg'

const faqs = [
  [
    {
      question: 'What is the goal of the Stacks framework?',
      answer:
        'The goal of the Stacks framework is to help you create and maintain frontends, backends, and clouds—without having to worry about the boilerplate. It is a rapid development framework, meeting all your full stack needs.',
    },
    {
      question: 'What does the Buddy toolkit do?',
      answer:
        'Buddy is a toolkit that helps you interact with the Stacks API. It provides commands for installing dependencies, starting dev servers, building libraries or servers, committing changes, creating releases, and updating all dependencies and the Stacks framework.',
    },
    {
      question: 'What are the main features of the Stacks framework?',
      answer:
        'The Stacks framework is a harmony of several “engines” to build any web and/or desktop application, in highly scalable & privacy-friendly ways. It includes Stacks Frontend, Stacks Backend, Stacks Cloud, Stacks CI/CD, and Stacks DX.',
    },
  ],
  [
    {
      question: 'How do I get started with Stacks?',
      answer:
        'You can get started with Stacks by running the command "curl -Ssf stacksjs.org | sh" in your terminal. If Bun >= v1.0 is installed already, you can also get started via "bunx stacks new my-project".',
    },
    {
      question: 'What is the Stacks mantra?',
      answer:
        'The Stacks mantra is "Convention over configuration". This means that Stacks provides sensible defaults that allow developers to focus on writing code, rather than setting up configurations.',
    },
    {
      question: 'What is the Stacks CI/CD?',
      answer:
        'Stacks CI/CD allows you to focus on coding, not publishing. It includes a Deployment Manager for zero-setup push-to-deploy and a Release Manager for auto-publishing libraries to npm.',
    },
  ],
  [
    {
      question: 'Is Stacks beginner-friendly?',
      answer:
        'Yes, Stacks is extremely beginner-friendly. The approachable design allows you to learn at your own pace, using thorough documentation covering every aspect of the framework.',
    },
    {
      question: 'What is the Stacks DX?',
      answer:
        'Stacks DX (Developer Experience) enhances productivity for developers. It includes IDE integration, zero-config setup, linter & formatter, type safety, git workflows, auto imports, code snippets, spell checker, utilities collections, team management, and testing.',
    },
    {
      question: 'What is the roadmap for Stacks?',
      answer:
        'The roadmap for Stacks includes first-party supported stacks like Table, Calendar, Command Palette, Date Picker, File Manager, Image, Video, Audio, Identity, Digital Ownership, Payments, and Governance. More information can be found in the detailed roadmap.',
    },
  ],
]
</script>

<template>
  <section
    id="faq"
    aria-labelledby="faq-title"
    class="relative overflow-hidden bg-slate-50 py-20 sm:py-32"
  >
    <img
      class="absolute left-1/2 top-0 max-w-none translate-x-[-30%] -translate-y-1/4"
      :src="backgroundImage"
      alt=""
      width="1558"
      height="946"
    >
    <Container class="relative">
      <div class="mx-auto max-w-2xl lg:mx-0">
        <h2
          id="faq-title"
          class="font-display text-3xl text-slate-900 tracking-tight sm:text-4xl"
        >
          Frequently asked questions
        </h2>
        <p class="mt-4 text-lg text-slate-700 tracking-tight">
          If you can’t find what you’re looking for, we're just one email away.
        </p>
      </div>
      <ul
        role="list"
        class="grid grid-cols-1 mx-auto mt-16 max-w-2xl gap-8 lg:grid-cols-3 lg:max-w-none"
      >
        <li v-for="(column, columnIndex) in faqs" :key="columnIndex">
          <ul role="list" class="flex flex-col gap-y-8">
            <li v-for="(faq, faqIndex) in column" :key="faqIndex">
              <h3 class="font-display text-lg text-slate-900 leading-7">
                {{ faq.question }}
              </h3>
              <p class="mt-4 text-sm text-slate-700">
                {{ faq.answer }}
              </p>
            </li>
          </ul>
        </li>
      </ul>
    </Container>
  </section>
</template>
