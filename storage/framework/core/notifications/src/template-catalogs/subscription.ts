import type { NotificationTemplateDefinition } from '../templates'

/** Where the subscription messages' buttons lead. */
export interface SubscriptionNotificationPaths {
  /** Where the subscriber manages billing. Default `/billing`. */
  billing?: string
}

/**
 * A subscriber's own plan with the app (SaaS billing), in English and German.
 *
 * Variables: `app`, `plan` (its name), plus `date` for `subscription_trial_ending`
 * (the last day of the trial) and `subscription_ended` (when it ended).
 */
/** The names this catalog defines. */
export type SubscriptionNotificationTemplateName = 'subscription_trial_ending' | 'subscription_payment_failed' | 'subscription_ended'

export function subscriptionNotificationTemplates(paths: SubscriptionNotificationPaths = {}): Record<SubscriptionNotificationTemplateName, NotificationTemplateDefinition> {
  const billing = paths.billing ?? '/billing'
  return {
    subscription_trial_ending: {
      copy: {
        en: { subject: 'Your {{app}} trial ends on {{date}}', body: 'Your {{plan}} trial ends on {{date}}. To keep using {{plan}}, check that your payment details are up to date. To stop, cancel before then and you won’t be charged.' },
        de: { subject: 'Deine {{app}}-Testphase endet am {{date}}', body: 'Deine Testphase für {{plan}} endet am {{date}}. Wenn du {{plan}} weiter nutzen willst, prüfe, ob deine Zahlungsdaten aktuell sind. Wenn nicht, kündige vorher, dann wird nichts berechnet.' },
      },
      action: { path: billing, label: { en: 'Manage billing', de: 'Abrechnung verwalten' } },
    },
    subscription_payment_failed: {
      copy: {
        en: { subject: 'Payment for {{plan}} failed', body: 'We couldn’t charge your payment method for your {{app}} {{plan}} plan. Update it to keep {{plan}} active.' },
        de: { subject: 'Zahlung für {{plan}} fehlgeschlagen', body: 'Wir konnten deine Zahlungsmethode für deinen {{app}}-Tarif {{plan}} nicht belasten. Aktualisiere sie, damit {{plan}} aktiv bleibt.' },
      },
      action: { path: billing, label: { en: 'Update payment method', de: 'Zahlungsmethode aktualisieren' } },
    },
    subscription_ended: {
      copy: {
        en: { subject: 'Your {{app}} {{plan}} plan has ended', body: 'Your {{plan}} plan ended on {{date}}. Your account and data are still here; choose a plan again whenever you’re ready.' },
        de: { subject: 'Dein {{app}}-Tarif {{plan}} ist beendet', body: 'Dein Tarif {{plan}} endete am {{date}}. Dein Konto und deine Daten bleiben erhalten; du kannst jederzeit wieder einen Tarif wählen.' },
      },
      action: { path: billing, label: { en: 'Choose a plan', de: 'Tarif wählen' } },
    },
  }
}
