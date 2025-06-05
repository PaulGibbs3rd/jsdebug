import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import "@esri/calcite-components/dist/components/calcite-button";
import "@esri/calcite-components/dist/components/calcite-input";
import "@esri/calcite-components/dist/components/calcite-list";
import "@esri/calcite-components/dist/components/calcite-list-item";
import "@esri/calcite-components/dist/components/calcite-notice";
import Graphic from "@arcgis/core/Graphic";
import Extent from "@arcgis/core/geometry/Extent";

@customElement("layer-manager")
export class LayerManager extends LitElement {
  @property({ attribute: false }) view: any = null; // MapView or SceneView
  @property({ attribute: false }) otherView: any = null; // The other view for sync

  @state() private layers: any[] = [];
  @state() private inputUrl: string = "";
  @state() private error: string = "";

  private _layersWatcher: IHandle | null = null;
  private _otherLayersWatcher: IHandle | null = null;

  static styles = css`
    :host {
      display: block;
      position: absolute;
      left: 50%;
      bottom: 30px;
      transform: translateX(-50%);
      z-index: 40;
      min-width: 350px;
      max-width: 600px;
      background: white;
      border: 1px solid #ccc;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      padding: 12px 18px 16px 18px;
      font-size: 14px;
      user-select: text;
    }
    .layer-list {
      max-height: 220px;
      overflow-y: auto;
      margin-bottom: 10px;
    }
    .layer-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 6px;
      border-bottom: 1px solid #eee;
      padding-bottom: 3px;
    }
    .layer-title {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      margin-right: 10px;
    }
    .remove-btn {
      background: #e74c3c;
      color: white;
      border: none;
      border-radius: 4px;
      padding: 2px 10px;
      cursor: pointer;
      font-size: 12px;
    }
    .add-row {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 10px;
    }
    input[type="text"] {
      flex: 1;
      padding: 5px 8px;
      font-size: 13px;
      border-radius: 4px;
      border: 1px solid #aaa;
    }
    .add-btn {
      background: #3498db;
      color: white;
      border: none;
      border-radius: 4px;
      padding: 5px 14px;
      cursor: pointer;
      font-size: 13px;
    }
    .error {
      color: #b00;
      font-size: 12px;
      margin-top: 4px;
    }
    .empty {
      color: #888;
      font-size: 13px;
      text-align: center;
      margin: 12px 0;
    }
  `;

  updated(changedProps: Map<string, any>) {
    if (changedProps.has("view") && this.view) {
      // Set the otherView property if not already set
      if (!this.otherView) {
        // Try to find the other view from the global context
        const globalViews = (window as any).appViews;
        if (globalViews && (globalViews.mapView === this.view || globalViews.sceneView === this.view)) {
          this.otherView = globalViews.mapView === this.view ? globalViews.sceneView : globalViews.mapView;
        }
      }
      this.refreshLayers();
      // Add to UI if not already present
      if (!this.view.ui.find((w: any) => w === this)) {
        this.view.ui.add(this, "manual");
        this.style.position = "absolute";
        this.style.left = "50%";
        this.style.bottom = "30px";
        this.style.transform = "translateX(-50%)";
      }
      // Listen for view load to refresh layers if operational layers exist
      if (this.view.when) {
        this.view.when(() => {
          this.refreshLayers();
        });
      }
      // Listen for map's layers collection changes (add/remove)
      if (this.view.map && this.view.map.layers && !this._layersWatcher) {
        this._layersWatcher = this.view.map.layers.on("change", () => this.refreshLayers());
      }
      // Immediately refresh layers after setting up watchers
      setTimeout(() => this.refreshLayers(), 0);
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._layersWatcher?.remove?.();
    this._otherLayersWatcher?.remove?.();
  }

  refreshLayers() {
    if (!this.view || !this.view.map) {
      this.layers = [];
      return;
    }
    this.layers = this.view.map.layers.toArray();
  }

  async handleAddLayer() {
    this.error = "";
    const url = this.inputUrl.trim();
    if (!url) return;
    let serviceJson: any = null;
    try {
      const resp = await fetch(url + (url.includes("?") ? "&" : "?") + "f=json");
      if (!resp.ok) throw new Error("Service not found");
      serviceJson = await resp.json();
      if (serviceJson.error) throw new Error(serviceJson.error.message || "Service error");
    } catch (err: any) {
      this.error = "Could not load service: " + (err?.message || err);
      return;
    }
    let LayerClass: any;
    try {
      if (serviceJson.type === "Feature Layer" || /FeatureServer/i.test(url)) {
        LayerClass = (await import("@arcgis/core/layers/FeatureLayer")).default;
      } else if (serviceJson.type === "Map Service" || /MapServer/i.test(url)) {
        LayerClass = (await import("@arcgis/core/layers/MapImageLayer")).default;
      } else if (serviceJson.type === "Image Service" || /ImageServer/i.test(url)) {
        LayerClass = (await import("@arcgis/core/layers/ImageryLayer")).default;
      } else if (serviceJson.type === "Scene Service" || /SceneServer/i.test(url)) {
        LayerClass = (await import("@arcgis/core/layers/SceneLayer")).default;
      } else if (/VectorTileServer/i.test(url)) {
        LayerClass = (await import("@arcgis/core/layers/VectorTileLayer")).default;
      } else if (/TileServer/i.test(url) || /\/tiles\//i.test(url)) {
        LayerClass = (await import("@arcgis/core/layers/TileLayer")).default;
      } else {
        LayerClass = (await import("@arcgis/core/layers/FeatureLayer")).default;
      }
    } catch (err: any) {
      this.error = "Could not load layer type: " + (err?.message || err);
      return;
    }
    try {
      const layer = new LayerClass({ url });
      this.view.map.add(layer);
      // Add to the other view as well, if not present
      if (this.otherView && this.otherView.map && !this.otherView.map.layers.find((l: any) => l.url === url)) {
        const otherLayer = new LayerClass({ url });
        this.otherView.map.add(otherLayer);
      }
      layer.when(() => this.refreshLayers());
      this.inputUrl = "";
    } catch (err: any) {
      this.error = "Could not add layer: " + (err?.message || err);
    }
  }

  handleInput(e: Event) {
    this.inputUrl = (e.target as HTMLInputElement).value;
  }

  handleRemoveLayer(layer: any) {
    try {
      // Remove from both views by URL
      const url = layer.url;
      if (this.view && this.view.map && url) {
        const match = this.view.map.layers.find((l: any) => l.url === url);
        if (match) this.view.map.layers.remove(match);
      }
      if (this.otherView && this.otherView.map && url) {
        const match = this.otherView.map.layers.find((l: any) => l.url === url);
        if (match) this.otherView.map.layers.remove(match);
      }
      this.refreshLayers();
    } catch (err: any) {
      this.error = "Could not remove layer: " + (err?.message || err);
    }
  }

  // Remove unused srcView parameter to clean up warning
  async handleLayerChange(evt: any, tgtView: any) {
    if (!tgtView || !tgtView.map) return;
    // Added
    if (evt.added && evt.added.length) {
      for (const lyr of evt.added) {
        if (lyr.url && !tgtView.map.layers.find((l: any) => l.url === lyr.url)) {
          let LayerClass: any;
          try {
            LayerClass = lyr.declaredClass
              ? (await import(`@arcgis/core/layers/${lyr.declaredClass.split(".").pop()}`)).default
              : (await import("@arcgis/core/layers/FeatureLayer")).default;
          } catch {
            LayerClass = (await import("@arcgis/core/layers/FeatureLayer")).default;
          }
          try {
            const newLayer = new LayerClass({ url: lyr.url });
            tgtView.map.layers.add(newLayer);
          } catch (err: any) {
            this.error = "Could not sync added layer: " + (err?.message || err);
          }
        }
      }
    }
    // Removed
    if (evt.removed && evt.removed.length) {
      for (const lyr of evt.removed) {
        if (lyr.url) {
          const match = tgtView.map.layers.find((l: any) => l.url === lyr.url);
          if (match) tgtView.map.layers.remove(match);
        }
      }
    }
    this.refreshLayers();
  }

  // Helper: Show extent of a FeatureLayer's query result
  async showFeatureLayerExtent(layer: any) {
    if (!layer || !layer.queryExtent) return;
    try {
      const result = await layer.queryExtent();
      if (result && result.extent) {
        // Add a graphic for the extent
        const extentGraphic = new Graphic({
          geometry: Extent.fromJSON(result.extent.toJSON()),
          symbol: {
            type: "simple-fill",
            color: [0, 0, 255, 0.08],
            outline: { color: [0, 0, 255, 1], width: 2 }
          },
          popupTemplate: {
            title: "FeatureLayer Query Extent",
            content: `<pre>${JSON.stringify(result.extent.toJSON(), null, 2)}</pre>`
          }
        });
        // Add to a graphics layer (reuse draw-extent's if present)
        let graphicsLayer = this.view.map.findLayerById("feature-query-extent-layer");
        if (!graphicsLayer) {
          const [GraphicsLayer] = await Promise.all([
            import("@arcgis/core/layers/GraphicsLayer"),
          ]);
          graphicsLayer = new GraphicsLayer.default({ id: "feature-query-extent-layer" });
          this.view.map.add(graphicsLayer);
        }
        graphicsLayer.removeAll();
        graphicsLayer.add(extentGraphic);
        // Zoom to the extent
        await this.view.goTo(result.extent);
        // Open popup if possible
        if (this.view.popup && typeof this.view.popup.open === "function") {
          this.view.popup.open({ features: [extentGraphic], location: result.extent.center });
        }
      }
    } catch (err: any) {
      this.error = "Could not show query extent: " + (err?.message || err);
    }
  }

  render() {
    return html`
      <div class="layer-list">
        <calcite-list>
          ${this.layers.length === 0
            ? html`<calcite-list-item disabled><span slot="content"><div class="empty">No operational layers</div></span></calcite-list-item>`
            : this.layers.map(
                (layer) => html`
                  <calcite-list-item
                    label=${layer.title || layer.id || layer.url || "Layer"}
                    description=${layer.url || ""}
                    value=${layer.id || layer.url || ""}
                  >
                    ${layer.type === "feature" && layer.queryExtent
                      ? html`<calcite-button
                          slot="actions-end"
                          appearance="outline"
                          color="yellow"
                          scale="s"
                          icon-start="bounding-rectangle"
                          aria-label="Show Query Extent"
                          @click=${() => this.showFeatureLayerExtent(layer)}
                        >Extent</calcite-button>`
                      : ""}
                    <calcite-button
                      slot="actions-end"
                      appearance="outline"
                      color="blue"
                      scale="s"
                      icon-start="launch"
                      aria-label="Open REST URL"
                      @click=${() => window.open(layer.url, '_blank', 'noopener')}
                    >Open</calcite-button>
                    <calcite-button
                      slot="actions-end"
                      appearance="outline"
                      color="red"
                      scale="s"
                      icon-start="trash"
                      aria-label="Remove layer"
                      @click=${() => this.handleRemoveLayer(layer)}
                    >Remove</calcite-button>
                  </calcite-list-item>
                `
              )}
        </calcite-list>
      </div>
      <div class="add-row">
        <calcite-input
          type="text"
          placeholder="Add layer by REST URL"
          .value=${this.inputUrl}
          @input=${this.handleInput}
          @keydown=${(e: KeyboardEvent) => { if (e.key === "Enter") this.handleAddLayer(); }}
          aria-label="Layer URL"
          scale="m"
        ></calcite-input>
        <calcite-button
          appearance="solid"
          color="blue"
          scale="m"
          icon-start="plus"
          @click=${this.handleAddLayer}
          >Add</calcite-button>
      </div>
      ${this.error
        ? html`<calcite-notice open color="red" icon="exclamation-mark-triangle-f" scale="s">
            <div slot="message">${this.error}</div>
          </calcite-notice>`
        : ""}
    `;
  }
}

interface IHandle {
  remove?: () => void;
  removeAll?: () => void;
}

declare global {
  interface HTMLElementTagNameMap {
    "layer-manager": LayerManager;
  }
}
