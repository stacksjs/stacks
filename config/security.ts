import type { SecurityConfig } from '@stacksjs/types'

/**
 * **Services**
 *
 * This configuration defines all of your services. Because Stacks is fully-typed, you may
 * hover any of the options below and the definitions will be provided. In case you
 * have any questions, feel free to reach out via Discord or GitHub Discussions.
 */
export default {
  api: {
    // What to do about a model whose generated store/update/destroy routes have
    // no row-level scoping - no `ownership` config, no `team_id` or `user_id`
    // column, and no explicit `ownership: false`.
    //
    // 'deny' (the default) does not register those routes; 'warn' registers
    // them and names the models at boot, which is the pre-0.75 behaviour. A
    // model restores its writes by saying who owns a row, or by declaring
    // `ownership: false` to say that nothing does. See #2375.
    rowScoping: 'deny',
  },

  firewall: {
    enabled: true,
    countryCodes: ['RU', 'IR'],
    ipAddresses: [],
    // Per-IP request ceiling. Kept low enough to blunt online brute force /
    // enumeration against auth, password-reset, and 2FA endpoints (the
    // per-account lockouts are the second line; this is the first). Raise it
    // for high-throughput public APIs — but 1000/min/IP let an attacker make
    // ~16 guesses/sec, which defeats the purpose of a firewall limit.
    rateLimitPerMinute: 100,
    useIpReputationLists: true,
    useKnownBadInputsRuleSet: true,
    queryString: [],
    httpHeaders: [],
  },
} satisfies SecurityConfig
