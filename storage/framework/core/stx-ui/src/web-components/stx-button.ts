/**
 * StxButton Web Component
 * A framework-agnostic button inspired by macOS design patterns.
 */

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success'
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg'

export interface StxButtonAttributes {
  variant?: ButtonVariant
  size?: ButtonSize
  disabled?: boolean
  loading?: boolean
  'full-width'?: boolean
  'icon-only'?: boolean
}

const styles = `
  :host {
    display: inline-block;
  }

  :host([full-width]) {
    display: block;
    width: 100%;
  }

  .stx-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-weight: 500;
    letter-spacing: -0.01em;
    transition: all 150ms ease;
    user-select: none;
    cursor: pointer;
    border: none;
    outline: none;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }

  .stx-button:focus-visible {
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.4);
  }

  .stx-button:disabled {
    opacity: 0.4;
    cursor: not-allowed;
    pointer-events: none;
  }

  .stx-button:active:not(:disabled) {
    transform: scale(0.98);
  }

  :host([full-width]) .stx-button {
    width: 100%;
  }

  /* Variants */
  .stx-button--primary {
    background: linear-gradient(to bottom, #3b82f6, #2563eb);
    color: white;
    box-shadow: 0 1px 2px rgba(37, 99, 235, 0.25);
  }
  .stx-button--primary:hover:not(:disabled) {
    background: linear-gradient(to bottom, #60a5fa, #3b82f6);
  }
  .stx-button--primary:active:not(:disabled) {
    background: linear-gradient(to bottom, #2563eb, #1d4ed8);
  }

  .stx-button--secondary {
    background: rgba(255, 255, 255, 0.8);
    color: #262626;
    border: 1px solid rgba(0, 0, 0, 0.1);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  }
  .stx-button--secondary:hover:not(:disabled) {
    background: white;
  }
  .stx-button--secondary:active:not(:disabled) {
    background: #f5f5f5;
  }

  .stx-button--outline {
    background: transparent;
    color: #404040;
    border: 1px solid rgba(0, 0, 0, 0.15);
  }
  .stx-button--outline:hover:not(:disabled) {
    background: rgba(0, 0, 0, 0.05);
  }
  .stx-button--outline:active:not(:disabled) {
    background: rgba(0, 0, 0, 0.1);
  }

  .stx-button--ghost {
    background: transparent;
    color: #525252;
    border: none;
  }
  .stx-button--ghost:hover:not(:disabled) {
    background: rgba(0, 0, 0, 0.05);
  }
  .stx-button--ghost:active:not(:disabled) {
    background: rgba(0, 0, 0, 0.1);
  }

  .stx-button--danger {
    background: linear-gradient(to bottom, #ef4444, #dc2626);
    color: white;
    box-shadow: 0 1px 2px rgba(220, 38, 38, 0.25);
  }
  .stx-button--danger:hover:not(:disabled) {
    background: linear-gradient(to bottom, #f87171, #ef4444);
  }
  .stx-button--danger:active:not(:disabled) {
    background: linear-gradient(to bottom, #dc2626, #b91c1c);
  }

  .stx-button--success {
    background: linear-gradient(to bottom, #22c55e, #16a34a);
    color: white;
    box-shadow: 0 1px 2px rgba(22, 163, 74, 0.25);
  }
  .stx-button--success:hover:not(:disabled) {
    background: linear-gradient(to bottom, #4ade80, #22c55e);
  }
  .stx-button--success:active:not(:disabled) {
    background: linear-gradient(to bottom, #16a34a, #15803d);
  }

  /* Sizes */
  .stx-button--xs {
    font-size: 11px;
    padding: 4px 8px;
    border-radius: 6px;
    gap: 4px;
    height: 24px;
  }
  .stx-button--sm {
    font-size: 12px;
    padding: 4px 10px;
    border-radius: 6px;
    gap: 6px;
    height: 28px;
  }
  .stx-button--md {
    font-size: 13px;
    padding: 6px 12px;
    border-radius: 8px;
    gap: 6px;
    height: 32px;
  }
  .stx-button--lg {
    font-size: 14px;
    padding: 8px 16px;
    border-radius: 8px;
    gap: 8px;
    height: 36px;
  }

  /* Icon-only sizes */
  .stx-button--icon-only.stx-button--xs {
    width: 24px;
    padding: 0;
  }
  .stx-button--icon-only.stx-button--sm {
    width: 28px;
    padding: 0;
  }
  .stx-button--icon-only.stx-button--md {
    width: 32px;
    padding: 0;
  }
  .stx-button--icon-only.stx-button--lg {
    width: 36px;
    padding: 0;
  }

  /* Loading spinner */
  .stx-button__spinner {
    animation: spin 1s linear infinite;
    width: 14px;
    height: 14px;
  }
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  /* Dark mode */
  @media (prefers-color-scheme: dark) {
    .stx-button--secondary {
      background: rgba(255, 255, 255, 0.1);
      color: #f5f5f5;
      border-color: rgba(255, 255, 255, 0.1);
    }
    .stx-button--secondary:hover:not(:disabled) {
      background: rgba(255, 255, 255, 0.15);
    }
    .stx-button--secondary:active:not(:disabled) {
      background: rgba(255, 255, 255, 0.05);
    }

    .stx-button--outline {
      color: #e5e5e5;
      border-color: rgba(255, 255, 255, 0.15);
    }
    .stx-button--outline:hover:not(:disabled) {
      background: rgba(255, 255, 255, 0.08);
    }
    .stx-button--outline:active:not(:disabled) {
      background: rgba(255, 255, 255, 0.1);
    }

    .stx-button--ghost {
      color: #d4d4d4;
    }
    .stx-button--ghost:hover:not(:disabled) {
      background: rgba(255, 255, 255, 0.08);
    }
    .stx-button--ghost:active:not(:disabled) {
      background: rgba(255, 255, 255, 0.12);
    }
  }
`

const spinnerSvg = `
  <svg class="stx-button__spinner" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle style="opacity: 0.25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
    <path style="opacity: 0.75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
`

export class StxButton extends HTMLElement {
  static get observedAttributes() {
    return ['variant', 'size', 'disabled', 'loading', 'full-width', 'icon-only']
  }

  private _button: HTMLButtonElement | null = null
  private _shadowRoot: ShadowRoot

  constructor() {
    super()
    this._shadowRoot = this.attachShadow({ mode: 'open' })
  }

  connectedCallback() {
    this.render()
  }

  attributeChangedCallback(_name: string, oldValue: string, newValue: string) {
    if (oldValue !== newValue) {
      this.render()
    }
  }

  private render() {
    const variant = this.getAttribute('variant') || 'primary'
    const size = this.getAttribute('size') || 'md'
    const disabled = this.hasAttribute('disabled')
    const loading = this.hasAttribute('loading')
    const iconOnly = this.hasAttribute('icon-only')

    const classes = [
      'stx-button',
      `stx-button--${variant}`,
      `stx-button--${size}`,
      iconOnly ? 'stx-button--icon-only' : '',
    ].filter(Boolean).join(' ')

    this._shadowRoot.innerHTML = `
      <style>${styles}</style>
      <button class="${classes}" ${disabled || loading ? 'disabled' : ''}>
        ${loading ? spinnerSvg : ''}
        <slot name="icon-left"></slot>
        <slot></slot>
        <slot name="icon-right"></slot>
      </button>
    `

    this._button = this._shadowRoot.querySelector('button')
  }

  // Public API
  get disabled(): boolean {
    return this.hasAttribute('disabled')
  }

  set disabled(value: boolean) {
    if (value) {
      this.setAttribute('disabled', '')
    } else {
      this.removeAttribute('disabled')
    }
  }

  get loading(): boolean {
    return this.hasAttribute('loading')
  }

  set loading(value: boolean) {
    if (value) {
      this.setAttribute('loading', '')
    } else {
      this.removeAttribute('loading')
    }
  }

  focus() {
    this._button?.focus()
  }

  blur() {
    this._button?.blur()
  }
}

// Register the custom element
if (typeof customElements !== 'undefined' && !customElements.get('stx-button')) {
  customElements.define('stx-button', StxButton)
}
