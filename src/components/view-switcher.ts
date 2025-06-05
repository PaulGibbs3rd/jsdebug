import { LitElement, html, css } from 'lit';
import { customElement, state, property } from 'lit/decorators.js';

@customElement('view-switcher')
export class ViewSwitcher extends LitElement {
  @property({ attribute: false }) view: any = null; // MapView or SceneView
  @state() private is3D = false;

  static styles = css`
    :host {
      display: block;
    }
    button {
      /* Remove absolute positioning, let ArcGIS UI handle it */
      background: white;
      border: 1px solid #999;
      padding: 0.5rem 1rem;
      font-size: 14px;
      cursor: pointer;
    }
  `;

  updated(changedProps: Map<string, any>) {
    if (changedProps.has('view') && this.view) {
      // Add this element (the button) to the ArcGIS UI
      this.view.ui.add(this, "top-left");
    }
  }

  setView(view: any) {
    this.view = view;
  }

  toggleView() {
    this.is3D = !this.is3D;
    this.dispatchEvent(new CustomEvent('view-switch', {
      detail: { is3D: this.is3D },
      bubbles: true,
      composed: true
    }));
  }

  render() {
    return html`
      <button @click=${this.toggleView}>
        Switch to ${this.is3D ? '2D' : '3D'}
      </button>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'view-switcher': ViewSwitcher;
  }
}