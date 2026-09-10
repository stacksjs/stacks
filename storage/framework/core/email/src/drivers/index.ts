export * as capture from './capture'
// Also by name. The namespace form alone meant the only way to reach the class
// was `@stacksjs/email/drivers/capture`, and in a workspace checkout that
// subpath resolves to `dist` while the barrel resolves to `src` - two module
// graphs, two capture stores, so a test asserting on one saw nothing the app
// wrote to the other (stacksjs/stacks#2581).
export { CaptureEmailDriver } from './capture'
export type { CapturedMessage } from './capture'
export * as log from './log'
export * as mailgun from './mailgun'
export * as mailtrap from './mailtrap'
// `nodemailer` driver removed — it was a throwing stub that surfaced as a
// runtime crash on `mail.send()` only after a user had already wired it
// into config. Use the SMTP driver (`smtp` in MAIL_MAILER) for SMTP-based
// providers; see stacksjs/stacks#1871 M-7.
export * as sendgrid from './sendgrid'
export * as ses from './ses'
