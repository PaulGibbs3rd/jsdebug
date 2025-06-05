import MapView from "@arcgis/core/views/MapView";
import SceneView from "@arcgis/core/views/SceneView";
import * as reactiveUtils from "@arcgis/core/core/reactiveUtils";

export function synchronizeViews(view1: MapView | SceneView, view2: MapView | SceneView) {
  const views = [view1, view2];
  let active: MapView | SceneView | null = null;

  function sync(source: MapView | SceneView) {
    if (!active || !active.viewpoint || active !== source) return;
    for (const view of views) {
      if (view !== active) {
        const activeViewpoint = active.viewpoint.clone();
        const latitude = active.center.latitude ?? 0;
        const scaleConversionFactor = Math.cos((latitude * Math.PI) / 180.0);
        if (active.type === "3d") {
          activeViewpoint.scale /= scaleConversionFactor;
        } else {
          activeViewpoint.scale *= scaleConversionFactor;
        }
        view.viewpoint = activeViewpoint;
      }
    }
  }

  for (const view of views) {
    reactiveUtils.watch(
      () => [view.interacting, view.viewpoint],
      ([interacting, viewpoint]) => {
        if (interacting) {
          active = view;
          sync(active);
        }
        if (viewpoint) {
          sync(view);
        }
      }
    );
  }
}
