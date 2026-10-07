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
 * Six platforms are supported, and what each needs differs more than it
 * looks. Every one of these is read off its driver rather than its docs:
 *
 *   bluesky    IDENTIFIER, PASSWORD                (SERVICE for another PDS)
 *   twitter    CLIENT_ID, CLIENT_SECRET, ACCESS_TOKEN  (+ REFRESH_TOKEN)
 *   linkedin   ACCESS_TOKEN, MEMBER_URN            (+ CLIENT_ID, CLIENT_SECRET, API_VERSION)
 *   mastodon   ACCESS_TOKEN, INSTANCE_URL
 *   instagram  ACCESS_TOKEN, ACCOUNT_ID            (+ CLIENT_ID, CLIENT_SECRET)
 *   threads    ACCESS_TOKEN, USER_ID               (+ CLIENT_ID, CLIENT_SECRET)
 *
 * Four of them need a second value beside the token, because a token alone
 * does not say WHERE or AS WHOM to post: LinkedIn wants the member URN,
 * Mastodon the instance that issued the token, Instagram the Business account
 * id, Threads the user id. Each driver refuses without it. The client id and
 * secret in brackets are only for refreshing, so an identity holding a live
 * token posts without them.
 *
 * Bluesky's app password is generated in Settings, App Passwords. It is not
 * the account password and is revocable on its own, and the driver mints a
 * session from it per use, so there is nothing short-lived to store. Mastodon
 * is the other one that can be set up entirely by pasting: its token comes
 * from the instance's own Preferences, Development.
 *
 * X is different: posting needs a user-context OAuth 2.0 token, so only the
 * client id and secret are static. The access and refresh tokens come out of a
 * consent flow per identity and cannot be prepared ahead of time by pasting a
 * value into `.env`. Declaring the platform here is still right: an identity
 * that is not yet authorized reports exactly that, rather than looking ready.
 * LinkedIn, Instagram and Threads have the same property.
 *
 * Instagram is worth one more line: its driver refuses a text-only post and
 * requires a publicly reachable image URL, so an identity on Instagram alone
 * cannot post what the others can.
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
