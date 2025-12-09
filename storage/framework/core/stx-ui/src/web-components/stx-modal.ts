/**
 * StxModal Web Component
 * A macOS-style modal dialog with backdrop blur and smooth animations.
 */

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full'

export interface StxModalAttributes {
  open?: boolean
  size?: ModalSize
  'close-on-backdrop'?: boolean
  'close-on-escape'?: boolean
  'show-close-button'?: boolean
}

const styles = `
  :host {
    display: contents;
  }

  .stx-modal-backdrop {
    position: fixed;
    inset: 0;
    z-index: 50;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.4);
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
    opacity: 0;
    visibility: hidden;
    transition: opacity 200ms ease, visibility 200ms ease;
  }

  .stx-modal-backdrop--open {
    opacity: 1;
    visibility: visible;
  }

  .stx-modal {
    position: relative;
    background: white;
    border-radius: 12px;
    box-shadow:
      0 25px 50px -12px rgba(0, 0, 0, 0.25),
      0 0 0 1px rgba(0, 0, 0, 0.05);
    max-height: calc(100vh - 64px);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    transform: scale(0.95) translateY(10px);
    opacity: 0;
    transition: transform 200ms ease, opacity 200ms ease;
  }

  .stx-modal-backdrop--open .stx-modal {
    transform: scale(1) translateY(0);
    opacity: 1;
  }

  /* Sizes */
  .stx-modal--sm { width: 384px; max-width: calc(100vw - 32px); }
  .stx-modal--md { width: 512px; max-width: calc(100vw - 32px); }
  .stx-modal--lg { width: 640px; max-width: calc(100vw - 32px); }
  .stx-modal--xl { width: 768px; max-width: calc(100vw - 32px); }
  .stx-modal--full {
    width: calc(100vw - 64px);
    height: calc(100vh - 64px);
    max-width: none;
    max-height: none;
  }

  /* Header */
  .stx-modal__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid rgba(0, 0, 0, 0.06);
    flex-shrink: 0;
  }

  .stx-modal__title {
    font-size: 15px;
    font-weight: 600;
    color: #171717;
    margin: 0;
    letter-spacing: -0.01em;
  }

  .stx-modal__close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 6px;
    border: none;
    background: transparent;
    color: #737373;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .stx-modal__close:hover {
    background: rgba(0, 0, 0, 0.06);
    color: #404040;
  }

  .stx-modal__close:active {
    background: rgba(0, 0, 0, 0.1);
  }

  /* Body */
  .stx-modal__body {
    padding: 20px;
    overflow-y: auto;
    flex: 1;
  }

  /* Footer */
  .stx-modal__footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
    padding: 16px 20px;
    border-top: 1px solid rgba(0, 0, 0, 0.06);
    flex-shrink: 0;
  }

  /* Hidden slots */
  .stx-modal__header:empty,
  .stx-modal__footer:empty {
    display: none;
  }

  /* Dark mode */
  @media (prefers-color-scheme: dark) {
    .stx-modal-backdrop {
      background: rgba(0, 0, 0, 0.6);
    }

    .stx-modal {
      background: #262626;
      box-shadow:
        0 25px 50px -12px rgba(0, 0, 0, 0.5),
        0 0 0 1px rgba(255, 255, 255, 0.1);
    }

    .stx-modal__header {
      border-bottom-color: rgba(255, 255, 255, 0.06);
    }

    .stx-modal__title {
      color: #fafafa;
    }

    .stx-modal__close {
      color: #a3a3a3;
    }

    .stx-modal__close:hover {
      background: rgba(255, 255, 255, 0.08);
      color: #e5e5e5;
    }

    .stx-modal__close:active {
      background: rgba(255, 255, 255, 0.12);
    }

    .stx-modal__footer {
      border-top-color: rgba(255, 255, 255, 0.06);
    }
  }
`

const closeSvg = `
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>
`

export class StxModal extends HTMLElement {
  static get observedAttributes() {
    return ['open', 'size', 'close-on-backdrop', 'close-on-escape', 'show-close-button']
  }

  private _shadowRoot: ShadowRoot
  private _escapeHandler: ((e: KeyboardEvent) => void) | null = null

  constructor() {
    super()
    this._shadowRoot = this.attachShadow({ mode: 'open' })
  }

  connectedCallback() {
    this.render()
    this.setupEventListeners()
  }

  disconnectedCallback() {
    this.removeEscapeHandler()
  }

  attributeChangedCallback(name: string, oldValue: string, newValue: string) {
    if (oldValue !== newValue) {
      if (name === 'open') {
        this.handleOpenChange()
      } else {
        this.render()
      }
    }
  }

  private handleOpenChange() {
    const backdrop = this._shadowRoot.querySelector('.stx-modal-backdrop')
    if (backdrop) {
      if (this.open) {
        backdrop.classList.add('stx-modal-backdrop--open')
        this.setupEscapeHandler()
        document.body.style.overflow = 'hidden'
        this.dispatchEvent(new CustomEvent('modal-open', { bubbles: true, composed: true }))
      } else {
        backdrop.classList.remove('stx-modal-backdrop--open')
        this.removeEscapeHandler()
        document.body.style.overflow = ''
        this.dispatchEvent(new CustomEvent('modal-close', { bubbles: true, composed: true }))
      }
    }
  }

  private setupEscapeHandler() {
    if (this.closeOnEscape) {
      this._escapeHandler = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          this.close()
        }
      }
      document.addEventListener('keydown', this._escapeHandler)
    }
  }

  private removeEscapeHandler() {
    if (this._escapeHandler) {
      document.removeEventListener('keydown', this._escapeHandler)
      this._escapeHandler = null
    }
  }

  private setupEventListeners() {
    // Backdrop click
    const backdrop = this._shadowRoot.querySelector('.stx-modal-backdrop')
    backdrop?.addEventListener('click', (e) => {
      if (e.target === backdrop && this.closeOnBackdrop) {
        this.close()
      }
    })

    // Close button
    const closeBtn = this._shadowRoot.querySelector('.stx-modal__close')
    closeBtn?.addEventListener('click', () => this.close())
  }

  private render() {
    const size = this.getAttribute('size') || 'md'
    const showCloseButton = this.getAttribute('show-close-button') !== 'false'

    this._shadowRoot.innerHTML = `
      <style>${styles}</style>
      <div class="stx-modal-backdrop ${this.open ? 'stx-modal-backdrop--open' : ''}">
        <div class="stx-modal stx-modal--${size}" role="dialog" aria-modal="true">
          <div class="stx-modal__header">
            <slot name="header">
              <h2 class="stx-modal__title"><slot name="title"></slot></h2>
            </slot>
            ${showCloseButton ? `<button class="stx-modal__close" aria-label="Close">${closeSvg}</button>` : ''}
          </div>
          <div class="stx-modal__body">
            <slot></slot>
          </div>
          <div class="stx-modal__footer">
            <slot name="footer"></slot>
          </div>
        </div>
      </div>
    `

    this.setupEventListeners()
    if (this.open) {
      this.setupEscapeHandler()
    }
  }

  // Public API
  get open(): boolean {
    return this.hasAttribute('open')
  }

  set open(value: boolean) {
    if (value) {
      this.setAttribute('open', '')
    } else {
      this.removeAttribute('open')
    }
  }

  get closeOnBackdrop(): boolean {
    return this.getAttribute('close-on-backdrop') !== 'false'
  }

  get closeOnEscape(): boolean {
    return this.getAttribute('close-on-escape') !== 'false'
  }

  show() {
    this.open = true
  }

  close() {
    this.open = false
  }

  toggle() {
    this.open = !this.open
  }
}

// Register the custom element
if (typeof customElements !== 'undefined' && !customElements.get('stx-modal')) {
  customElements.define('stx-modal', StxModal)
}
