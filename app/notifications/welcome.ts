// export default defineEmail({ // or defineSms or definePushNotification or defineWebhook or defineChat or defineNotification
//   name: 'welcome',
//   subject: 'Welcome to Stacks',
//   to: ({ user }) => user.email,
//   from: ({ config }) => config.email.from,
//   template: 'welcome', // resolves the ./resources/mails/welcome.ts mail template
//   async run({ user }) {
//     // ...
//   },
// })
