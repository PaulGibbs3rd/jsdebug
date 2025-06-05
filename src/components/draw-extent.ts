import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";

@customElement("draw-extent")
export class DrawExtent extends LitElement {
  @property({ attribute: false }) view: any = null; // MapView or SceneView

  @state() private inputJson: string = "";
  @state() private error: string = "";
  @state() private drawing = false;

  private graphic: __esri.Graphic | null = null;
  private sketch: __esri.Sketch | null = null;
  private graphicsLayer: __esri.GraphicsLayer | null = null;

  static styles = css`
    :host {
      display: block;
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
    textarea {
      width: 100%;
      min-height: 60px;
      font-family: monospace;
      font-size: 12px;
      margin-bottom: 6px;
      border-radius: 4px;
      border: 1px solid #aaa;
      padding: 4px;
      resize: vertical;
    }
    button {
      font-size: 12px;
      padding: 3px 10px;
      border-radius: 4px;
      border: 1px solid #aaa;
      background: #f3f3f3;
      cursor: pointer;
      margin-right: 6px;
      margin-bottom: 6px;
    }
    .error {
      color: #b00;
      font-size: 12px;
      margin-bottom: 6px;
    }
    .section-label {
      font-weight: bold;
      margin-bottom: 4px;
      display: block;
    }
  `;

  async firstUpdated() {
    // Load Sketch and GraphicsLayer dynamically
    if (!this.view) return;
    const [GraphicsLayer, Sketch] = await Promise.all([
      import("@arcgis/core/layers/GraphicsLayer"),
      import("@arcgis/core/widgets/Sketch"),
    ]);
    this.graphicsLayer = new GraphicsLayer.default();
    this.view.map.add(this.graphicsLayer);
    this.sketch = new Sketch.default({
      view: this.view,
      layer: this.graphicsLayer,
      creationMode: "single",
      availableCreateTools: ["rectangle"],
      visibleElements: { createTools: { point: false, polyline: false, polygon: false, circle: false } }
    });
    this.sketch.on("create", async (evt: any) => {
      if (evt.state === "complete" && this.graphic === null) {
        this.clearGraphics();
        // Remove from Sketch widget's layer (edit mode) if present (for 3D)
        if (this.sketch && this.sketch.layer && evt.graphic && this.sketch.layer.graphics.includes(evt.graphic)) {
          this.sketch.layer.remove(evt.graphic);
        }
        // Hide the Sketch widget immediately after drawing
        this.sketch!.visible = false;
        // Add to our GraphicsLayer as a static graphic (ensure not in edit mode)
        if (this.graphicsLayer && evt.graphic && evt.graphic.geometry) {
          const [Graphic] = await Promise.all([
            import("@arcgis/core/Graphic"),
          ]);
          const staticGraphic = new Graphic.default({
            geometry: evt.graphic.geometry.clone(),
            symbol: evt.graphic.symbol,
            popupTemplate: {
              title: "Drawn Extent",
              content: `<pre>${JSON.stringify(evt.graphic.geometry.toJSON(), null, 2)}</pre>`
            }
          });
          this.graphicsLayer.add(staticGraphic);
          this.graphic = staticGraphic;
        }
        // Zoom to the drawn extent
        if (this.graphic && this.graphic.geometry && this.view) {
          if (this.view.type === "3d" && this.graphic.geometry.extent) {
            const extent = this.graphic.geometry.extent;
            await this.view.goTo({
              target: extent,
              tilt: 0,
              heading: 0
            });
          } else {
            await this.view.goTo(this.graphic.geometry);
          }
        }
        this.dispatchExtent();
        this.drawing = false;
        // Open popup (defensive: check for open function)
        if (this.view && this.view.popup && typeof this.view.popup.open === "function" && this.graphic) {
          this.view.popup.open({
            features: [this.graphic],
            location: this.graphic.geometry
          });
        }
      }
    });
    this.sketch.visible = false;
    this.view.ui.add(this.sketch, "top-right");
  }

  updated(changedProps: Map<string, any>) {
    if (changedProps.has("view") && this.view) {
      // Remove old graphics/sketch if view changes
      this.clearGraphics();
      if (this.graphicsLayer) {
        this.view.map.add(this.graphicsLayer);
      }
      if (this.sketch) {
        this.sketch.view = this.view;
        this.view.ui.add(this.sketch, "top-right");
      }
      // Ensure this widget is added to the view UI
      if (!this.view.ui.find((w: any) => w === this)) {
        this.view.ui.add(this, "bottom-left");
      }
    }
  }

  connectedCallback() {
    super.connectedCallback();
    // If view is already set, add to UI on connect
    if (this.view && this.view.ui && !this.view.ui.find((w: any) => w === this)) {
      this.view.ui.add(this, "bottom-left");
    }
  }

  clearGraphics() {
    if (this.graphicsLayer) {
      this.graphicsLayer.removeAll();
    }
    this.graphic = null;
  }

  async handleDraw() {
    this.error = "";
    this.drawing = true;
    if (this.sketch) {
      this.sketch.visible = true;
      this.sketch.create("rectangle");
    }
  }

  handleInput(e: Event) {
    this.inputJson = (e.target as HTMLTextAreaElement).value;
  }

  async handlePasteExtent() {
    this.error = "";
    this.clearGraphics();
    let extentObj;
    try {
      extentObj = JSON.parse(this.inputJson);
      if (
        typeof extentObj.xmin !== "number" ||
        typeof extentObj.ymin !== "number" ||
        typeof extentObj.xmax !== "number" ||
        typeof extentObj.ymax !== "number" ||
        !extentObj.spatialReference
      ) {
        throw new Error("Invalid extent JSON");
      }
    } catch (err) {
      this.error = "Invalid extent JSON";
      return;
    }
    const [Graphic, Extent] = await Promise.all([
      import("@arcgis/core/Graphic"),
      import("@arcgis/core/geometry/Extent"),
    ]);
    // Ensure the spatialReference is an object, not just a number
    let sr = extentObj.spatialReference;
    if (typeof sr === "number") {
      sr = { wkid: sr };
    }
    const extent = new Extent.default({
      xmin: extentObj.xmin,
      ymin: extentObj.ymin,
      xmax: extentObj.xmax,
      ymax: extentObj.ymax,
      spatialReference: sr
    });
    this.graphic = new Graphic.default({
      geometry: extent,
      symbol: {
        type: "simple-fill",
        color: [0, 0, 0, 0.1],
        outline: { color: [0, 0, 0, 1], width: 2 }
      },
      popupTemplate: {
        title: "Extent from JSON",
        content: `<pre>${JSON.stringify(extent.toJSON(), null, 2)}</pre>`
      }
    });
    this.graphicsLayer!.add(this.graphic);
    // Zoom to the extent
    if (this.view) {
      await this.view.goTo(extent);
      // Open popup
      if (this.view.popup) {
        this.view.popup.open({
          features: [this.graphic],
          location: extent
        });
      }
    }
    this.dispatchExtent();
  }

  dispatchExtent() {
    if (!this.graphic) return;
    this.dispatchEvent(new CustomEvent("extent-drawn", {
      detail: { extent: this.graphic!.geometry!.toJSON() },
      bubbles: true,
      composed: true
    }));
  }

  render() {
    return html`
      <span class="section-label">Draw or Paste Extent</span>
      <textarea
        placeholder="Paste extent JSON here"
        .value=${this.inputJson}
        @input=${this.handleInput}
      ></textarea>
      <div>
        <button @click=${this.handlePasteExtent}>Draw from JSON</button>
        <button @click=${this.handleDraw} ?disabled=${this.drawing}>Draw on Map</button>
        <button @click=${this.clearGraphics.bind(this)}>Clear</button>
      </div>
      ${this.error ? html`<div class="error">${this.error}</div>` : ""}
    `;
  }
}
