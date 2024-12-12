/**
 * **API Options**
 *
 * This configuration defines all of your API options. Because Stacks is fully-typed, you
 * may hover any of the options below and the definitions will be provided. In case you
 * have any questions, feel free to reach out via Discord or GitHub Discussions.
 */
export interface ApiOptions {
  /**
   * **API Description**
   *
   * This value defines the description for your API.
   *
   * @default "Stacks API"
   */
  description: string

  /**
   * **API Prefix**
   *
   * This value defines the prefix for all of your API routes. For example, if you set
   * this value to `api`, all of your API routes will be prefixed with `/api`. This
   * value is useful for when you want to version your API.
   *
   * @default string "api"
   * @example string "api/v1"
   */
  prefix: string

  middleware: string[]

  routes:
    | {
      index: boolean
      show: boolean
      store: boolean
      update: boolean
      destroy: boolean
    }
    | boolean

  /**
   * **API Prewarm**
   *
   * This configuration determines the prewarming behavior of your API. Prewarming eliminates
   * cold starts in your API. If this value is set to `true`, the API will be prewarmed
   * every 5 minutes. If you provide a number, Stacks will prewarm the
   * specified number of containers every 5 minutes.
   *
   * @default true
   * @example false
   * @example 10
   */
  prewarm: boolean | number

  /**
   * **API Memory Size**
   *
   * This value defines the memory size for your API.
   *
   * @default 512
   */
  memorySize: number

  /**
   * **API Timeout**
   *
   * This value defines the timeout for your API.
   *
   * @default 30
   */
  timeout: number

  deploy: boolean
}

export type ApiConfig = Partial<ApiOptions>
