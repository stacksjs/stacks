/**
 * The Meta Graph API version the Facebook and Instagram drivers talk to.
 *
 * Meta guarantees a Graph API version for about two years, but the clock starts
 * when the *next* version ships rather than when that version is released, so a
 * pinned version ages faster than it looks. v18.0 shipped 2023-09-12 and
 * expired 2026-01-26.
 *
 * What makes an expired pin hard to notice: a call to an unusable version is
 * not rejected. Meta serves it from the oldest version still supported, so the
 * request succeeds and the behaviour is whatever that version does - the
 * version in the URL and the version answering have simply stopped agreeing.
 * Probing bears this out: `graph.facebook.com/v18.0/me` answers exactly as
 * `v26.0/me` does, while `v27.0` (which does not exist) reports an unknown path
 * component instead.
 *
 * So the two drivers share one version here rather than each carrying its own.
 * Override it per application with `config.services.facebook.graphVersion` or
 * the driver's own `graphVersion` option; this is only the default.
 */
export const META_GRAPH_VERSION = 'v24.0'
