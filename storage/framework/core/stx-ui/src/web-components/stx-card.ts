/**
 * StxCard Web Component
 * A clean card with subtle shadows and vibrancy options - macOS style.
 */

export type CardVariant = 'default' | 'elevated' | 'outline' | 'ghost' | 'vibrancy'
export type CardPadding = 'none' | 'sm' | 'md' | 'lg' | 'xl'
export type CardRounded = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl'

export interface StxCardAttributes {
  variant?: CardVariant
  padding?: CardPadding
  rounded?: CardRounded
  hoverable?: boolean
  clickable?: boolean
}

const styles = `
  :host {
    display: block;
  }

  .stx-card {
    transition: all 150ms ease;
  }

  /* Variants */
  .stx-card--default {
    background: white;
    border: 1px solid rgba(0, 0, 0, 0.05);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  }

  .stx-card--elevated {
    background: white;
    border: 1px solid rgba(0, 0, 0, 0.05);
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1);
  }

  .stx-card--outline {
    background: transparent;
    border: 1px solid rgba(0, 0, 0, 0.1);
  }

  .stx-card--ghost {
    background: rgba(0, 0, 0, 0.03);
    border: 1px solid transparent;
  }

  .stx-card--vibrancy {
    background: rgba(255, 255, 255, 0.6);
    backdrop-filter: blur(24px) saturate(1.5);
    -webkit-backdrop-filter: blur(24px) saturate(1.5);
    border: 1px solid rgba(0, 0, 0, 0.05);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  }

  /* Padding */
  .stx-card--padding-none { padding: 0; }
  .stx-card--padding-sm { padding: 10px; }
  .stx-card--padding-md { padding: 16px; }
  .stx-card--padding-lg { padding: 20px; }
  .stx-card--padding-xl { padding: 24px; }

  /* Border radius */
  .stx-card--rounded-sm { border-radius: 6px; }
  .stx-card--rounded-md { border-radius: 8px; }
  .stx-card--rounded-lg { border-radius: 12px; }
  .stx-card--rounded-xl { border-radius: 16px; }
  .stx-card--rounded-2xl { border-radius: 20px; }
  .stx-card--rounded-3xl { border-radius: 24px; }

  /* Hoverable */
  .stx-card--hoverable:hover,
  .stx-card--clickable:hover {
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.08), 0 2px 4px -2px rgba(0, 0, 0, 0.05);
    border-color: rgba(0, 0, 0, 0.08);
  }

  /* Clickable */
  .stx-card--clickable {
    cursor: pointer;
  }
  .stx-card--clickable:active {
    transform: scale(0.98);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  }

  /* Header */
  .stx-card__header {
    margin-bottom: 16px;
  }

  /* Footer */
  .stx-card__footer {
    margin-top: 16px;
    padding-top: 12px;
    border-top: 1px solid rgba(0, 0, 0, 0.05);
  }

  /* Dark mode */
  @media (prefers-color-scheme: dark) {
    .stx-card--default {
      background: rgba(38, 38, 38, 0.9);
      border-color: rgba(255, 255, 255, 0.05);
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
    }

    .stx-card--elevated {
      background: #262626;
      border-color: rgba(255, 255, 255, 0.1);
      box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -4px rgba(0, 0, 0, 0.3);
    }

    .stx-card--outline {
      border-color: rgba(255, 255, 255, 0.1);
    }

    .stx-card--ghost {
      background: rgba(255, 255, 255, 0.05);
    }

    .stx-card--vibrancy {
      background: rgba(38, 38, 38, 0.6);
      border-color: rgba(255, 255, 255, 0.1);
    }

    .stx-card--hoverable:hover,
    .stx-card--clickable:hover {
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.25), 0 2px 4px -2px rgba(0, 0, 0, 0.2);
      border-color: rgba(255, 255, 255, 0.15);
    }

    .stx-card__footer {
      border-top-color: rgba(255, 255, 255, 0.05);
    }
  }
`

export class StxCard extends HTMLElement {
  static get observedAttributes() {
    return ['variant', 'padding', 'rounded', 'hoverable', 'clickable']
  }

  private _shadowRoot: ShadowRoot
  private _hasHeader = false
  private _hasFooter = false

  constructor() {
    super()
    this._shadowRoot = this.attachShadow({ mode: 'open' })
  }

  connectedCallback() {
    this.render()
    this.setupClickHandler()
    this.observeSlots()
  }

  attributeChangedCallback(_name: string, oldValue: string, newValue: string) {
    if (oldValue !== newValue) {
      this.render()
    }
  }

  private observeSlots() {
    const headerSlot = this._shadowRoot.querySelector('slot[name="header"]') as HTMLSlotElement
    const footerSlot = this._shadowRoot.querySelector('slot[name="footer"]') as HTMLSlotElement

    if (headerSlot) {
      headerSlot.addEventListener('slotchange', () => {
        this._hasHeader = headerSlot.assignedNodes().length > 0
        this.updateSlotVisibility()
      })
    }

    if (footerSlot) {
      footerSlot.addEventListener('slotchange', () => {
        this._hasFooter = footerSlot.assignedNodes().length > 0
        this.updateSlotVisibility()
      })
    }
  }

  private updateSlotVisibility() {
    const header = this._shadowRoot.querySelector('.stx-card__header') as HTMLElement
    const footer = this._shadowRoot.querySelector('.stx-card__footer') as HTMLElement

    if (header) header.style.display = this._hasHeader ? '' : 'none'
    if (footer) footer.style.display = this._hasFooter ? '' : 'none'
  }

  private setupClickHandler() {
    if (this.hasAttribute('clickable')) {
      this.addEventListener('click', (e) => {
        this.dispatchEvent(new CustomEvent('card-click', {
          detail: { originalEvent: e },
          bubbles: true,
          composed: true,
        }))
      })
    }
  }

  private render() {
    const variant = this.getAttribute('variant') || 'default'
    const padding = this.getAttribute('padding') || 'md'
    const rounded = this.getAttribute('rounded') || 'lg'
    const hoverable = this.hasAttribute('hoverable')
    const clickable = this.hasAttribute('clickable')

    const classes = [
      'stx-card',
      `stx-card--${variant}`,
      `stx-card--padding-${padding}`,
      `stx-card--rounded-${rounded}`,
      hoverable ? 'stx-card--hoverable' : '',
      clickable ? 'stx-card--clickable' : '',
    ].filter(Boolean).join(' ')

    this._shadowRoot.innerHTML = `
      <style>${styles}</style>
      <div class="${classes}">
        <div class="stx-card__header" style="display: none;">
          <slot name="header"></slot>
        </div>
        <slot></slot>
        <div class="stx-card__footer" style="display: none;">
          <slot name="footer"></slot>
        </div>
      </div>
    `

    this.observeSlots()
  }
}

// Register the custom element
if (typeof customElements !== 'undefined' && !customElements.get('stx-card')) {
  customElements.define('stx-card', StxCard)
}
