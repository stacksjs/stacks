<script setup lang="ts">
import backgroundImage from '../../assets/images/background-faqs.jpg'

const faqs = [
  [
    {
      question: 'Does TaxPal handle VAT?',
      answer:
        'Well no, but if you move your company offshore you can probably ignore it.',
    },
    {
      question: 'Can I pay for my subscription via purchase order?',
      answer: 'Absolutely, we are happy to take your money in all forms.',
    },
    {
      question: 'How do I apply for a job at TaxPal?',
      answer:
        'We only hire our customers, so subscribe for a minimum of 6 months and then let’s talk.',
    },
  ],
  [
    {
      question: 'What was that testimonial about tax fraud all about?',
      answer:
        'TaxPal is just a software application, ultimately your books are your responsibility.',
    },
    {
      question:
        'TaxPal sounds horrible but why do I still feel compelled to purchase?',
      answer:
        'This is the power of excellent visual design. You just can’t resist it, no matter how poorly it actually functions.',
    },
    {
      question:
        'I found other companies called TaxPal, are you sure you can use this name?',
      answer:
        'Honestly not sure at all. We haven’t actually incorporated or anything, we just thought it sounded cool and made this website.',
    },
  ],
  [
    {
      question: 'How do you generate reports?',
      answer:
        'You just tell us what data you need a report for, and we get our kids to create beautiful charts for you using only the finest crayons.',
    },
    {
      question: 'Can we expect more inventory features?',
      answer: 'In life it’s really better to never expect anything at all.',
    },
    {
      question: 'I lost my password, how do I get into my account?',
      answer:
        'Send us an email and we will send you a copy of our latest password spreadsheet so you can find your information.',
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
      class="absolute left-1/2 top-0 max-w-none -translate-y-1/4 translate-x-[-30%]"
      :src="backgroundImage"
      alt=""
      width="1558"
      height="946"
    >
    <Container class="relative">
      <div class="mx-auto max-w-2xl lg:mx-0">
        <h2
          id="faq-title"
          class="font-display text-3xl tracking-tight text-slate-900 sm:text-4xl"
        >
          Frequently asked questions
        </h2>
        <p class="mt-4 text-lg tracking-tight text-slate-700">
          If you can’t find what you’re looking for, email our support team
          and if you’re lucky someone will get back to you.
        </p>
      </div>
      <ul
        role="list"
        class="mx-auto mt-16 grid max-w-2xl grid-cols-1 gap-8 lg:max-w-none lg:grid-cols-3"
      >
        <li v-for="(column, columnIndex) in faqs" :key="columnIndex">
          <ul role="list" class="flex flex-col gap-y-8">
            <li v-for="(faq, faqIndex) in column" :key="faqIndex">
              <h3 class="font-display text-lg leading-7 text-slate-900">
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
