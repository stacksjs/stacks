export interface UserOptions {
  /**
    * File paths will be resolved against this directory.
    *
    * @default process.cwd
    */
  root?: string

  /**
   * Build modes.
   *
   * - `vue-component` - inject generated CSS to Vue SFC's `<style scoped>` for isolation
   * - `web-component` - inject generated CSS to `Shadow DOM` css style block for each web component
   *
   * @default 'vue'
   */
  mode?: 'vue' | 'web-component'
}
