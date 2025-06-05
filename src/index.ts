// Restore the original MapView/SceneView/Expand/BasemapGallery widget logic and all related code
import MapView from "@arcgis/core/views/MapView";
import SceneView from "@arcgis/core/views/SceneView";
import WebMap from "@arcgis/core/WebMap";
import WebScene from "@arcgis/core/WebScene";
import BasemapGallery from "@arcgis/core/widgets/BasemapGallery";
import Portal from "@arcgis/core/portal/Portal";
import PortalBasemapsSource from "@arcgis/core/widgets/BasemapGallery/support/PortalBasemapsSource";
import Expand from "@arcgis/core/widgets/Expand";
import "./components/view-extent";
import "./components/draw-extent";
import "./components/view-switcher";
import "./components/layer-manager";
import "@esri/calcite-components/dist/components/calcite-panel";
import * as reactiveUtils from "@arcgis/core/core/reactiveUtils";

// Create the 2D MapView
export const mapView = new MapView({
  container: "mapViewContainer",
  map: new WebMap({
    portalItem: {
      id: "7ee3c8a93f254753a83ac0195757f137"
    }
  }),
  center: [-122.4376, 37.7728],
  zoom: 12
});

// Create the 3D SceneView
export const sceneView = new SceneView({
  container: "sceneViewContainer",
  map: new WebScene({
    portalItem: {
      id: "c8cf26d7acab4e45afcd5e20080983c1"
    }
  }),
  center: [-122.4376, 37.7728],
  zoom: 12
});

// Make both views globally accessible for layer-manager
(window as any).appViews = { mapView, sceneView };

// Add BasemapGallery with custom source (projections group)
const portal = new Portal();
const basemapSource = new PortalBasemapsSource({
  portal,
  query: {
    id: "bdb9d65e0b5c480c8dcc6916e7f4e099"
  }
});
const basemapGallery = new BasemapGallery({
  view: mapView,
  source: basemapSource,
  container: document.createElement("div")
});
const basemapExpand = new Expand({
  view: mapView,
  content: basemapGallery,
  expandIcon: "basemap",
  group: "top-left"
});
// Only add to mapView UI initially
mapView.ui.add(basemapExpand, "top-left");

// Create and add the view-extent widget
const viewExtent = document.createElement("view-extent") as any;
viewExtent.view = mapView;
mapView.ui.add(viewExtent, "bottom-right");

// Create and add the draw-extent widget
const drawExtent = document.createElement("draw-extent") as any;
drawExtent.view = mapView;
mapView.ui.add(drawExtent, "bottom-left");

// Create the Calcite spatial reference panel
const srPanel = document.createElement("calcite-panel");
srPanel.style.margin = "10px";
srPanel.heading = "Spatial Reference";
srPanel.id = "srPanel";
srPanel.innerHTML = `<div id="srPanelContent" style="font-size:16px;padding:4px 0;"></div>`;

function updateSRInfo(view: any) {
  const content = srPanel.querySelector("#srPanelContent");
  if (content) {
    content.innerHTML = `map.spatialReference.wkid = <b>${view.spatialReference?.wkid}</b>`;
  }
}
// Replace deprecated .watch with reactiveUtils.watch
reactiveUtils.watch(() => mapView.spatialReference, () => updateSRInfo(mapView));
reactiveUtils.watch(() => sceneView.spatialReference, () => updateSRInfo(sceneView));
mapView.on("layerview-create", () => updateSRInfo(mapView));
sceneView.on("layerview-create", () => updateSRInfo(sceneView));
updateSRInfo(mapView);

// Only add srPanel to the currently visible view
mapView.ui.add(srPanel, "top-right");
// Add the basemapExpand just after srPanel in the top-right stack
mapView.ui.add(basemapExpand, { position: "top-right", index: 1 });

// Create and add the view-switcher widget
const switcher = document.querySelector('view-switcher') as any;
switcher.setView(mapView);
mapView.ui.add(switcher, "top-left");
sceneView.ui.add(switcher, "top-left");

// Create and add the layer-manager widget
const layerManager = document.createElement("layer-manager") as any;
layerManager.view = mapView;
mapView.ui.add(layerManager, "manual");

// Helper to sync layers and extent between views
function syncLayersAndExtentBetweenViews(sourceView: any, targetView: any) {
  if (!sourceView?.map || !targetView?.map) return;
  // --- Layer sync (as before) ---
  const sourceUrls = sourceView.map.layers.map((l: any) => l.url).filter((u: any) => !!u);
  targetView.map.layers
    .filter((l: any) => l.url && !sourceUrls.includes(l.url))
    .forEach((l: any) => targetView.map.layers.remove(l));
  sourceView.map.layers.forEach((l: any) => {
    if (l.url && !targetView.map.layers.find((tl: any) => tl.url === l.url)) {
      const LayerClass = l.declaredClass
        ? require(`@arcgis/core/layers/${l.declaredClass.split(".").pop()}`).default
        : require("@arcgis/core/layers/FeatureLayer").default;
      try {
        const newLayer = new LayerClass({ url: l.url });
        targetView.map.layers.add(newLayer);
      } catch {}
    }
  });
  // --- Extent sync ---
  if (sourceView.extent) {
    targetView.goTo(sourceView.extent).catch(() => {});
  }
}

// Listen for the view-switch event
switcher.addEventListener("view-switch", (e: any) => {
  const is3D = e.detail.is3D;
  const mapDiv = document.getElementById('mapViewContainer')!;
  const sceneDiv = document.getElementById('sceneViewContainer')!;
  if (is3D) {
    mapDiv.style.display = 'none';
    sceneDiv.style.display = '';
    switcher.setView(sceneView);
    // Remove from mapView UI, add to sceneView UI
    mapView.ui.remove(basemapExpand);
    sceneView.ui.add(basemapExpand, { position: "top-right", index: 1 });
    basemapExpand.view = sceneView;
    basemapGallery.view = sceneView;
    updateSRInfo(sceneView);
    mapView.ui.remove(srPanel);
    sceneView.ui.add(srPanel, "top-right");
    mapView.ui.remove(viewExtent);
    sceneView.ui.add(viewExtent, "bottom-right");
    viewExtent.view = sceneView;
    mapView.ui.remove(drawExtent);
    sceneView.ui.add(drawExtent, "bottom-left");
    drawExtent.view = sceneView;
    mapView.ui.remove(layerManager);
    sceneView.ui.add(layerManager, "manual");
    layerManager.view = sceneView;
    // Sync layers and extent from mapView to sceneView
    syncLayersAndExtentBetweenViews(mapView, sceneView);
  } else {
    sceneDiv.style.display = 'none';
    mapDiv.style.display = '';
    switcher.setView(mapView);
    // Remove from sceneView UI, add to mapView UI
    sceneView.ui.remove(basemapExpand);
    mapView.ui.add(basemapExpand, { position: "top-right", index: 1 });
    basemapExpand.view = mapView;
    basemapGallery.view = mapView;
    updateSRInfo(mapView);
    sceneView.ui.remove(srPanel);
    mapView.ui.add(srPanel, "top-right");
    sceneView.ui.remove(viewExtent);
    mapView.ui.add(viewExtent, "bottom-right");
    viewExtent.view = mapView;
    sceneView.ui.remove(drawExtent);
    mapView.ui.add(drawExtent, "bottom-left");
    drawExtent.view = mapView;
    sceneView.ui.remove(layerManager);
    mapView.ui.add(layerManager, "manual");
    layerManager.view = mapView;
    // Sync layers and extent from sceneView to mapView
    syncLayersAndExtentBetweenViews(sceneView, mapView);
  }
});

// Optionally, start with only the map visible
document.getElementById('sceneViewContainer')!.style.display = 'none';
document.getElementById('mapViewContainer')!.style.display = '';

// Optionally, set the CSS position for bottom center
layerManager.style.position = "absolute";
layerManager.style.left = "50%";
layerManager.style.bottom = "30px";
layerManager.style.transform = "translateX(-50%)";

// Helper to get the mapView and sceneView from the <arcgis-map> component
function getArcgisMapViews() {
  const arcgisMap = document.querySelector('arcgis-map') as any;
  if (!arcgisMap) return { mapView: null, sceneView: null };
  // The mapView and sceneView are available as properties on the arcgis-map element
  return {
    mapView: arcgisMap.mapView || null,
    sceneView: arcgisMap.sceneView || null
  };
}
// Example usage: const { mapView, sceneView } = getArcgisMapViews();
// You can now use mapView/sceneView for widgets, layer sync, etc.

// Remove all legacy mapView/sceneView/widget code below this line
// (delete everything after the web component logic)
