import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import * as reactiveUtils from "@arcgis/core/core/reactiveUtils";

@customElement('view-extent')
export class ViewExtent extends LitElement {
  @property({ attribute: false }) view: any = null; // MapView or SceneView

  @state() private extentJson: string = '';
  @state() private scale: number | null = null;

  private extentHandle: IHandle | null = null;
  private scaleHandle: IHandle | null = null;

  static styles = css`
    :host {
      position: absolute;
      bottom: 20px;
      right: 20px;
      z-index: 30;
      background: white;
      border: 1px solid #ccc;
      border-radius: 6px;
      padding: 12px 16px;
      font-size: 13px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
      min-width: 260px;
      max-width: 350px;
      user-select: text;
    }
    .extent-label {
      font-weight: bold;
      margin-bottom: 4px;
      display: block;
    }
    .extent-json {
      font-family: monospace;
      font-size: 12px;
      background: #f7f7f7;
      padding: 4px 6px;
      border-radius: 4px;
      margin-bottom: 6px;
      word-break: break-all;
      white-space: pre-wrap;
    }
    button {
      font-size: 12px;
      padding: 3px 10px;
      border-radius: 4px;
      border: 1px solid #aaa;
      background: #f3f3f3;
      cursor: pointer;
      margin-top: 4px;
    }
    .scale {
      margin-top: 6px;
      color: #555;
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    this.setupWatchers();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.cleanupWatchers();
  }

  updated(changedProps: Map<string, any>) {
    if (changedProps.has('view')) {
      this.cleanupWatchers();
      this.setupWatchers();
      this.updateExtentAndScale();
    }
  }

  setupWatchers() {
    if (!this.view) return;
    // Use reactiveUtils.watch instead of deprecated .watch
    this.extentHandle = reactiveUtils.watch(() => this.view.extent, () => this.updateExtentAndScale());
    this.scaleHandle = reactiveUtils.watch(() => this.view.scale, () => this.updateExtentAndScale());
    this.updateExtentAndScale();
  }

  cleanupWatchers() {
    this.extentHandle?.remove?.();
    this.scaleHandle?.remove?.();
    this.extentHandle = null;
    this.scaleHandle = null;
  }

  updateExtentAndScale() {
    if (!this.view) return;
    const extent = this.view.extent;
    if (extent) {
      // Only include basic properties for clarity
      const { xmin, ymin, xmax, ymax, spatialReference } = extent;
      this.extentJson = JSON.stringify({ xmin, ymin, xmax, ymax, spatialReference }, null, 2);
    }
    this.scale = this.view.scale ?? null;
  }

  async copyExtent() {
    try {
      await navigator.clipboard.writeText(this.extentJson);
    } catch {
      // fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = this.extentJson;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
  }

  render() {
    return html`
      <span class="extent-label">Current Extent</span>
      <div class="extent-json">${this.extentJson}</div>
      <button @click=${this.copyExtent}>Copy as JSON</button>
      <div class="scale">Scale: <b>${this.scale ? Math.round(this.scale) : 'N/A'}</b></div>
    `;
  }
}

interface IHandle {
  remove: () => void;
}
