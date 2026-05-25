export * as capture from './capture'
export * as log from './log'
export * as mailgun from './mailgun'
export * as mailtrap from './mailtrap'
// `nodemailer` driver removed — it was a throwing stub that surfaced as a
// runtime crash on `mail.send()` only after a user had already wired it
// into config. Use the SMTP driver (`smtp` in MAIL_MAILER) for SMTP-based
// providers; see stacksjs/stacks#1871 M-7.
export * as sendgrid from './sendgrid'
export * as ses from './ses'
