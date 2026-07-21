# Conformance reports

A report is an attributable observation about one implementation revision, suite
revision, runtime, platform, and driver set. It is not a timeless certification.

The JSON Schema validates structure. `scripts/report.ts` adds semantic checks that
JSON Schema cannot express: exact requirement coverage, unique results, profile
inheritance, pass-only profile satisfaction, exception expiry, and driver evidence.

## Publication

Implementations publish both JSON and the generated Markdown summary. CI retains
the JSON artifact, records its SHA-256 digest, and links the exact run. The source
revision and suite revision must be immutable commit identifiers rather than a
moving branch. A stale report must never be copied forward to a new revision.

`profileClaim: null` is the required honest result when the implementation has not
passed every inherited requirement. Skipped, unsupported, exception, failed, and
experimental results remain visible in the summary.

