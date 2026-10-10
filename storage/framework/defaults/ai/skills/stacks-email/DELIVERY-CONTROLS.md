# Native email delivery controls

Read this for suppression, unsubscribe, deduplication, provider webhooks and
rendering. Source root: `storage/framework/core/email/src/`.

Native mail.queue(message) and mail.later(delaySeconds, message) dispatch
SendEmailJob to the emails queue. Their current dispatch failure path logs and
falls back to synchronous sending, so an awaited queue call does not guarantee
background execution or durable acceptance. A sync QUEUE_DRIVER also executes
inline. Read email.ts and stacks-queue before depending on timing or delivery.

## Results, suppression and send keys

Mail.send returns EmailResult and can return success false without throwing.
Mail.sendOrFail throws EmailDeliveryError for that structured failure. Resolve
template HTML/text before the provider call; a provider failure must not enter
a rendering fallback that sends a second message.

Suppression helpers are isSuppressed/getSuppressions/suppress/unsuppress.
Mail.send checks recipients against the configured suppression policy. Message
tag transactional/broadcast affects the transactional-allowed policy; do not tag
marketing as transactional merely to bypass an opt-out.

EmailMessage.idempotencyKey returns the cached prior successful result on a
retry, and only successful sends are recorded. The implementation looks up the
key before delivery and records after delivery, so do not call this exactly-once
concurrent provider sending or a transactional outbox. Missing table/connection
compatibility paths can warn and degrade controls; apply EmailSuppression,
EmailIdempotency and EmailWebhookEvent model migrations first. Inspect source
failure handling before treating a key as a guarantee.

Source: `email.ts`, `suppression.ts`, `idempotency.ts`. Evidence:
`tests/suppression.test.ts`, `email.test.ts`, `driver-credentials.test.ts`.

## Recipient unsubscribe

createUnsubscribeToken(email, ttlSeconds?, scope?), verifyUnsubscribeToken(token),
buildUnsubscribeUrl(email, ttlSeconds?, options?) and buildListUnsubscribeHeaders
are native signed helpers. APP_KEY must exist. Scope can distinguish an
application list/workspace policy; preserve it through verification and the
unsubscribe action. Tokens are expiring recipient grants, not arbitrary user
authentication or permission to read inbox data.

The default unsubscribe routes have their own exact GET/POST behavior. Read the
selected bundle rather than adding a second route with different token semantics.
Persist the resulting suppression before reporting opt-out completion.

Source: `unsubscribe.ts`, default email routes; evidence:
`tests/unsubscribe.test.ts` and `unsubscribe-scope.test.ts`.

## Provider webhooks

The high-level processors are handleMailgunWebhook, handleSendgridWebhook,
handleSesWebhook and handlePostmarkWebhook. Signature helpers include
verifyMailgunSignature, verifySendgridSignature, verifySesSnsSignature and
verifyPostmarkAuth. Read `webhook-handlers.ts` for each actual input/config shape.

Use exact provider raw-body bytes, headers and external callback URL as required
by the signature algorithm. The native pipeline validates, deduplicates the
provider event ID, classifies it, persists suppressions for hard bounces,
complaints/unsubscribe and emits the associated framework event. Soft bounces
are events rather than automatic permanent suppressions. A configured processor
does not mean its default route bundle is mounted or its credentials exist.

Source: `webhook-handlers.ts`, `webhook-signatures.ts`, `webhook-dedup.ts`,
`webhook-events.ts`; evidence: `tests/webhook-signatures.test.ts`.
Retained signature/request evidence is not a live provider delivery test.

## Rendering and preview

Email template names resolve application emails first, then framework defaults;
typed names and extensions are exposed by EmailTemplateReference. The renderer
escapes interpolated values; explicitly raw template HTML needs the same trust
boundary as a web template. inlineCss/shouldInlineByDefault provide native
inlining; media rules that cannot be inlined remain separate. HTML-to-text is
a mail rendering conversion, not a sanitization proof for arbitrary HTML.

Use typed Mailable and native make:mail/mail:preview for repeatable message
types and non-delivering reviews. See stacks-mail for those APIs. The preview
includes MIME/body/attachment inspection; keep it behind its development route
gates. Source: `template.ts`, `css-inliner.ts`, `mailable.ts`, `preview.ts`,
`mime-preview.ts`. Evidence: `tests/template-escaping.test.ts`,
`css-inliner.test.ts`, `html-to-text.test.ts`, `preview.test.ts` and
`mime-preview.test.ts`.
