# Verify source releases before adoption

Run each owning repository's existing `bun run release:patch`, wait for its
required CI and publication jobs, and retain the original archive SHA-512
identities from that release. Install those exact versions with a frozen
lockfile in the consumer. Then run:

```sh
./buddy release:verify release-plan.json --output release-receipt.json
```

This command verifies a release that already exists. It does not bump, tag,
publish, install, or replace an owning repository's release command. The plan
is trusted release policy: choose the actual required workflows and job names,
including publication, and use independently retained archive identities.

```json
{
  "schemaVersion": 1,
  "sources": [{
    "repository": "example/runtime",
    "commit": "1234567890abcdef1234567890abcdef12345678",
    "tag": "v1.2.3",
    "gates": [{
      "runId": 123,
      "workflow": ".github/workflows/release.yml",
      "requiredJobs": ["publish"]
    }],
    "packages": [{
      "name": "@example/runtime",
      "version": "1.2.3",
      "integrity": "COPY THE ORIGINAL sha512- ARCHIVE IDENTITY HERE"
    }]
  }],
  "checks": ["typecheck", "test"]
}
```

The example requires real source, workflow, archive and package identities.
Multiple sources can be verified together, with each installed package assigned
to exactly one owner. Package names refer to the consumer's direct installed
packages and Bun lock entries.

Verification reads the actual tag, the source's `release:patch` script, exact
workflow revisions and required job results. Pending, failed, missing, duplicate
or skipped required jobs block adoption. It then compares npm metadata and
complete downloaded archive bytes with the recorded SHA-512, checks installed
versions and lockfile integrity, compares installed package files with the
archive, and executes the consumer's named package scripts. Source links outside
installed node_modules, extra files, changed code, links and missing files are
rejected. Checks that fail, time out, are cancelled or change the verified
lockfile or package files block the receipt. Nested installed dependencies are
separate package identities; list their owners when they require verification.

Only a complete success writes the receipt, atomically. It records source
revisions, the existing release command, gate identities, package archive
identities, package file-inventory hashes, Bun version, lockfile SHA-256 and
executed check output hashes. Failures have a
nonzero exit code and leave an existing receipt untouched. Successful receipts
are historical evidence; rerun verification after changing a release plan or
consumer installation.

Downloads and gzip expansion have fixed byte budgets and refuse redirects.
Tar entry sizes, types and counts are bounded before parsing file contents.
Packages requiring generated install-time code need separate artifact evidence;
this verifier never treats generated or modified files as published archive bytes.
GitHub
authentication uses the existing token resolution and is never sent to npm.
Check output is hashed instead of copied into the receipt. Library consumers
can set cancellation and tighter budgets through
`@stacksjs/actions/release-evidence`.

Completed checks dispose their normal background descendants before a receipt
is issued. POSIX uses an owned process group and confirms its disappearance.
Windows calls the native Job Object APIs directly from its owned Bun host through
`bun:ffi`. Job Objects retain child ownership across intermediate process exits.
A command starts suspended, joins its job, then resumes. Missing ownership support or
failed cleanup blocks verification. This is process cleanup, not a sandbox for
deliberately escaping POSIX groups or privileged external services.

Windows cancellation uses Bun's separate IPC channel so the native owner can
terminate its job and confirm zero active members before the host is removed.
Consumer stdin remains closed. The host retains its native lifetime job until
the parent disposes it, and command output handles are inherited explicitly.
Command bytes are neither filtered nor rewritten.
The internal owner uses a private Bun configuration so application preload hooks
run in the checked command, after ownership is ready.
Library callers can observe those bytes with `runProjectScripts`' optional
synchronous `onOutput(chunk, stream)` callback. The verifier retains hashes by
default. An observer failure fails the check and triggers owned cleanup.

An integrity match proves archive identity against the plan. This command does
not validate registry signatures or SLSA attestations, establish redistribution
rights, prove native execution, or guarantee original-game fidelity. Include
the actual native and product acceptance scripts in the consumer checks and
retain their platform execution evidence separately.

## Retained adoption evidence

The [stx 0.2.663 plan](./receipts/stx-0.2.663-plan.json) and
[executed receipt](./receipts/stx-0.2.663-receipt.json) record six installed
packages against their original release-job archive identities. All four
release jobs passed, including native signing, exact source, npm and icons.
The consumer verifier checked complete archive bytes, installed file inventories,
lockfile compatibility and view types. This receipt applies to its recorded
lockfile hash; it does not establish native game execution or original-game parity.

The [stx 0.2.644 plan](./receipts/stx-0.2.644-plan.json) and
[executed receipt](./receipts/stx-0.2.644-receipt.json) retain the framework's
adoption of six published stx packages. Original archive identities came from
the successful release's npm job, not from a mutable latest version lookup.
The verifier checked the exact source tag and workflow, downloaded archives,
installed file inventories, Bun lock identities, the lockfile compatibility
check and the framework's stx view type checks.

This is a historical receipt for the recorded lockfile hash. Later framework
releases change that lockfile and need fresh consumer evidence. It establishes
neither native execution nor Settlers III fidelity or original-media rights.

The [DTSX 0.11.20 plan](./receipts/dtsx-0.11.20-plan.json) and
[executed receipt](./receipts/dtsx-0.11.20-receipt.json) retain the framework's
adoption of `@stacksjs/dtsx` and `bun-plugin-dtsx`. This release normalizes initial
source discovery before deduplication. A later Windows framework build exposed
another path spelling introduced by directory re-export resolution. The 0.11.20
receipt does not establish that this complete integration passed. Distinct
flat-output collisions still fail before cleaning the previous declarations.

Original archive identities came from the successful release's npm publication
step. Verification checked the exact tag, source CI including all three OS path
checks, release workflow, complete archives, installed files, lock compatibility
and framework type checks. The framework package build also passed locally using
the installed release. This is historical evidence for the recorded lockfile;
the framework's hosted Windows release-evidence job separately verifies its
complete build and subprocess contracts.

The [DTSX 0.11.21 plan](./receipts/dtsx-0.11.21-plan.json) and
[executed receipt](./receipts/dtsx-0.11.21-receipt.json) retain the follow-up
Windows fix for directory re-export identities. The source release passed its
Windows, macOS and Linux path checks and publication gates. Verification used
the declared Bun 1.4.2, compared complete published archives and installed files,
and passed lockfile compatibility and framework type checks. The actions package
also built successfully with the installed update. Hosted Windows evidence runs
against the complete consumer build separately.

The [DTSX 0.11.21 and Pantry 0.11.113 plan](./receipts/toolchain-2026-10-21-plan.json)
and [executed receipt](./receipts/toolchain-2026-10-21-receipt.json) retain the next
adoption. DTSX now normalizes graph entrypoints, absolute specifiers and directory
index resolution. Its public Bun plugin and graph cases passed on all three
operating systems. Pantry retries interrupted response bodies within the
existing bounded request budget, closing and restarting partial downloads.
Its source, native Windows runtime, native build and publication gates passed.

Both releases used their owning repository's existing `bun run release:patch`.
The receipt checks original publication SHA-512 identities, complete archives,
installed files, the frozen Bun lock, lock compatibility and framework types.
Stacks' three workflows pin Pantry's verified release commit and declared
version; all three runtime consumers declare the matching SDK range.
The [native archive readback](./receipts/toolchain-2026-10-21-native.json) records
all twelve DTSX and seven Pantry archive hashes and an actual macOS arm64 Pantry
version probe. Archive checks do not establish execution on other platforms.
The framework's hosted Windows build and process tests remain a separate gate.

The [native toolchain plan](./receipts/native-toolchain-2026-10-22-plan.json)
and [executed receipt](./receipts/native-toolchain-2026-10-22-receipt.json)
verify the installed Craft 0.0.296 SDK and six stx 0.2.667 packages against
their independently retained original archive identities. Craft's complete
release and all four required stx jobs passed. Installed package files, the
lockfile range gate, full framework types, application types and view types
passed verification. The [Craft native receipt](./receipts/craft-0.0.296-native.json)
records four original release archives and execution of the downloaded
Darwin arm64 CLI. This adoption does not include the newer Metal surface.

Initial stx icon publication failed while accepted archives remained pending.
Each pending package's metadata and complete bytes were compared with the
original SHA-512 and SHA-1 before retrying publication. The required icon job
then passed; an overall workflow success alone was not accepted as evidence.

The [STX 0.2.668 toolchain plan](./receipts/native-toolchain-2026-10-22-668-plan.json)
and [executed receipt](./receipts/native-toolchain-2026-10-22-668-receipt.json)
record a fresh installed-consumer verification in Stacks 0.75.271. All six
STX packages matched their original publication identities and installed
files. Craft 0.0.296, the lockfile range gate and all three type checks passed.
All four required STX release jobs passed, including icon publication and
native signing. The earlier receipt remains a historical verification of
0.2.667; neither receipt qualifies the newer native graphics surface.

The [Bumpx 0.2.26 plan](./receipts/bumpx-0.2.26-plan.json) and
[installed-consumer receipt](./receipts/bumpx-0.2.26-receipt.json) record the
release-history preflight correction used by Actions and Buddy. Exact-source
CI and publication passed. The installed package matches its original public
archive and complete file set. A shallow release now fails before release
files or refs change; fetching full history enables the ordinary release and
complete changelog. The framework lock and all three type checks passed.
Native graphics and game fidelity remain independent acceptance gates.

The [Pantry 0.11.119 plan](./receipts/pantry-0.11.119-plan.json) and
[installed-consumer receipt](./receipts/pantry-0.11.119-receipt.json) record the
earlier published dependency required by Buddy. The original npm archive, complete
installed files, framework lock and all three type checks passed. Its
[publication record](./receipts/pantry-0.11.119-publication.json) also retains
all seven original native archive hashes and execution of the downloaded Mac
CLI, including the quiet provider-path check that failed on 0.11.118.

On Windows, the SDK and Action select the complete official MinGit bundle,
verify the publisher digest and retained original 2.53.0 identities, preserve
its runtime resources and activate a relative executable alias. Owning source
CI passed real Windows Git, submodules, HTTPS, relocation and cache restore.
A fresh published SDK consumer on macOS independently matched all 384 original
Windows bundle files. That target-data check does not claim Windows execution.
The generic native CLI Windows Git dependency graph remains separate from the
verified SDK and Action route. These toolchain checks do not establish native
game presentation or original-game fidelity.

The [Pantry 0.11.120 plan](./receipts/pantry-0.11.120-plan.json) and
[installed-consumer receipt](./receipts/pantry-0.11.120-receipt.json) record the
current SDK, normal lock validation and all three framework type checks. The
[publication record](./receipts/pantry-0.11.120-publication.json) verifies all
seven original native archives, executable architectures, the normal Mac CLI
installation, and the original npm archive. The released CLI recovers two safe
lookup transport failures before publishing and passes ambiguous-upload and
redirect checks with one upload per case. The registry now computes Zig package
hashes with its provisioned native compiler and retains archive SHA-256 separately.

The [rejected 0.75.280 release](./receipts/stacks-0.75.280-rejected.json) retains
its [44 original accepted npm receipts](./receipts/stacks-0.75.280-original-npm-receipts.json).
Its CI uploader was Pantry 0.11.113 while Buddy required SDK 0.11.119. A TLS
initialization failure stopped the logging package before upload and left the
framework release incomplete. CI and release jobs now pin verified Pantry
0.11.120, and publication checks the actual `pantry` on `PATH` against Buddy's
SDK range immediately before uploads. A local-release `PANTRY_BIN` override
cannot make a different CI publisher pass that check.

The [combined tooling plan](./receipts/upstream-tooling-2026-10-23-plan.json)
and [installed-consumer receipt](./receipts/upstream-tooling-2026-10-23-receipt.json)
verify Pantry 0.11.120, Pickier 0.1.77, and the three consumed STX 0.2.671
packages against their original accepted archives and every installed file.
The current Bun 1.4.4 lock, framework and application type checks, view checks,
and lint all passed. `@stacksjs/lint` requires Pickier 0.1.77 at runtime, so a
normal app upgrade receives its compiler-cache classification even when an
older compatible linter was already locked. The [STX publication record](./receipts/stx-0.2.671-publication.json)
retains the independent source, release and native-signing gates. Unchanged
0.2.669 packages retain their earlier original publication identities.

## Framework publication requires exact source CI

The framework Releaser now waits for a successful Main push CI run at the exact release commit before registry publication. It requires completed lint, type, compile, artifact, scaffold, test-shard, deployment and all three platform release-evidence jobs. Missing, skipped, cancelled, failed or duplicate required jobs block publication. An older green run for another commit or a pull request cannot authorize the release. The generated-document bypass does not bypass this source gate.

This closes the publication gap observed with 0.75.275: its npm release succeeded while Windows source CI failed during timeout cleanup. The source gate rejects that existing run and accepts the independently green 0.75.274 run. This gate does not claim to repair the separate Windows cleanup failure.

## Verified Craft 0.0.301 adoption

The framework desktop and mobile dependencies and Actions' optional peer now require Craft 0.0.301 or later. The [adoption plan](./receipts/craft-0.0.301-plan.json) and [installed-consumer receipt](./receipts/craft-0.0.301-receipt.json) verify the SDK against its original archive and execute the committed graph, framework and application type checks. The [publication record](./receipts/craft-0.0.301-publication.json) retains the original CI artifact identity, all eight npm archives, four native archives, successful source/mobile/release gates, and a separate clean consumer that resolved and executed the native ARM64 CLI through the public SDK.

The earlier 0.0.300 native acceptance failures remain recorded separately. A successful later release does not explain those failures or establish complete native game presentation. The published Zig module archive still requires its own clean-consumer qualification.
