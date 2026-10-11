import type { NotificationTemplateDefinition } from '../templates'

/** Where the account messages' buttons lead. Defaults are the framework's own pages. */
export interface AccountNotificationPaths {
  /** The "forgot password" page. Default `/forgot-password`. */
  resetPassword?: string
}

/**
 * Account security messages, in English and German. Every one is
 * transactional: send it whatever the person's preferences say.
 *
 * Variables: `app` (the app's name) and `support_email` in all of them, plus
 * - `password_changed`: none;
 * - `email_changed`: `old_email`, `new_email`. Send it to both addresses: the
 *   old one is how the owner learns of a change they did not make;
 * - `account_deleted`: `date`. Send it before the address is erased;
 * - `account_created`: `inviter` (who created it), `set_password_url` (a
 *   one-time link, so send it outside any stored queue) and `days` (how long
 *   that link works; two or more).
 */
/** The names this catalog defines. */
export type AccountNotificationTemplateName = 'password_changed' | 'email_changed' | 'account_deleted' | 'account_created'

export function accountNotificationTemplates(paths: AccountNotificationPaths = {}): Record<AccountNotificationTemplateName, NotificationTemplateDefinition> {
  const resetPassword = paths.resetPassword ?? '/forgot-password'
  return {
    password_changed: {
      copy: {
        en: { subject: 'Your {{app}} password was changed', body: 'The password for your {{app}} account was changed.\n\nIf you did this, there’s nothing else to do. If you didn’t, reset your password right away and let us know at {{support_email}}.' },
        de: { subject: 'Dein {{app}}-Passwort wurde geändert', body: 'Das Passwort für dein {{app}}-Konto wurde geändert.\n\nWarst du das, musst du nichts weiter tun. Falls nicht, setze dein Passwort sofort zurück und gib uns unter {{support_email}} Bescheid.' },
      },
      action: { path: resetPassword, label: { en: 'Reset your password', de: 'Passwort zurücksetzen' } },
    },
    email_changed: {
      copy: {
        en: { subject: 'Your {{app}} sign-in email was changed', body: 'The email address for your {{app}} account was changed from {{old_email}} to {{new_email}}. From now on, you sign in and get email at {{new_email}}.\n\nIf you didn’t make this change, write to us at {{support_email}} straight away.' },
        de: { subject: 'Deine Anmelde-E-Mail bei {{app}} wurde geändert', body: 'Die E-Mail-Adresse deines {{app}}-Kontos wurde von {{old_email}} zu {{new_email}} geändert. Ab jetzt meldest du dich mit {{new_email}} an und bekommst dort deine E-Mails.\n\nWarst du das nicht, schreib uns sofort an {{support_email}}.' },
      },
    },
    account_deleted: {
      copy: {
        en: { subject: 'Your {{app}} account is deleted', body: 'Your {{app}} account was deleted on {{date}}. This is the last email we’ll send to this address.\n\nIf you didn’t ask for this, write to us at {{support_email}}.' },
        de: { subject: 'Dein {{app}}-Konto ist gelöscht', body: 'Dein {{app}}-Konto wurde am {{date}} gelöscht. Das ist die letzte E-Mail, die wir an diese Adresse schicken.\n\nHast du das nicht veranlasst, schreib uns an {{support_email}}.' },
      },
    },
    account_created: {
      copy: {
        en: { subject: '{{inviter}} added you to {{app}}', body: '{{inviter}} created an {{app}} account for you with this email address.\n\nSet a password to sign in. The link works for {{days}} days; after that, use “Forgot password” on the sign-in page.' },
        de: { subject: '{{inviter}} hat dich zu {{app}} hinzugefügt', body: '{{inviter}} hat für dich ein {{app}}-Konto mit dieser E-Mail-Adresse angelegt.\n\nLege ein Passwort fest, um dich anzumelden. Der Link gilt {{days}} Tage; danach nutze „Passwort vergessen“ auf der Anmeldeseite.' },
      },
      action: { path: '{{set_password_url}}', label: { en: 'Set your password', de: 'Passwort festlegen' } },
    },
  }
}
