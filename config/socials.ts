import type { SocialsConfig } from '@stacksjs/types'

/**
 * **Socials Configuration**
 *
 * This configuration defines which accounts this application posts as. Because
 * Stacks is fully-typed, you may hover any of the options below and the
 * definitions will be provided. In case you have any questions, feel free to
 * reach out via Discord or GitHub Discussions.
 *
 * Identities are named, because one application legitimately speaks as more
 * than one account: Stacks and Home are two identities on the same two
 * networks, and neither should be able to post as the other by accident.
 *
 * Credentials are not written here. Each one is read from the environment as
 * `SOCIALS_<IDENTITY>_<PLATFORM>_<FIELD>`, where `<IDENTITY>` is the key below
 * with non-alphanumerics removed:
 *
 *   SOCIALS_STACKS_BLUESKY_IDENTIFIER     SOCIALS_HOMELANG_BLUESKY_IDENTIFIER
 *   SOCIALS_STACKS_BLUESKY_PASSWORD       SOCIALS_HOMELANG_BLUESKY_PASSWORD
 *   SOCIALS_STACKS_TWITTER_CLIENT_ID      SOCIALS_HOMELANG_TWITTER_CLIENT_ID
 *   SOCIALS_STACKS_TWITTER_CLIENT_SECRET  SOCIALS_HOMELANG_TWITTER_CLIENT_SECRET
 *   SOCIALS_STACKS_TWITTER_ACCESS_TOKEN   SOCIALS_HOMELANG_TWITTER_ACCESS_TOKEN
 *
 * Bluesky's app password is generated in Settings, App Passwords. It is not
 * the account password and is revocable on its own, and the driver mints a
 * session from it per use, so there is nothing short-lived to store.
 *
 * X is different: posting needs a user-context OAuth 2.0 token, so only the
 * client id and secret are static. The access and refresh tokens come out of a
 * consent flow per identity and cannot be prepared ahead of time by pasting a
 * value into `.env`. Declaring the platform here is still right: an identity
 * that is not yet authorized reports exactly that, rather than looking ready.
 *
 * No default is set on purpose. With two identities configured, a call has to
 * name the one it means.
 */
export default {
  identities: {
    'stacks': {
      platforms: ['bluesky', 'twitter'],
    },

    'home-lang': {
      platforms: ['bluesky', 'twitter'],
    },
  },
} satisfies SocialsConfig
