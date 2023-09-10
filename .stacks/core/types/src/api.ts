/**
 * **API Options**
 *
 * This configuration defines all of your API options. Because Stacks is fully-typed, you
 * may hover any of the options below and the definitions will be provided. In case you
 * have any questions, feel free to reach out via Discord or GitHub Discussions.
 */
export interface ApiOptions {
  /**
   * **API Path**
   *
   * This is the path that will be used for all API routes. For example, if you set this
   * to `api`, then your routes will be `/api/user`, `/api/posts`, etc.
   *
   * @default string "api"
   * @example string "api"
   * @example string "api/v1"
   * @example string "api/v2/"
   * @example string "/api/v2"
   */
  path: string
}

export type ApiConfig = Partial<ApiOptions>
