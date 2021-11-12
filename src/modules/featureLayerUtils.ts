import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import Geometry from '@arcgis/core/geometry/Geometry';
import Graphic from '@arcgis/core/Graphic';
import Point from '@arcgis/core/geometry/Point';

export function updateGeometry(graphic: Graphic, newGeometry: Geometry) {
  graphic.graphic.geometry = newGeometry;
  (graphic.graphic.layer as FeatureLayer)
    .applyEdits({
      updateFeatures: [graphic.graphic],
    })
    .then((results) => {
      console.log('updateGeometry', results);
    });
}

export async function extractFeatureFromLayer(layer: FeatureLayer, location: Point) {
  const queryParams = layer.createQuery();
  queryParams.set({
    returnGeometry: true,
    geometry: location,
  });
  const featureSet = await layer.queryFeatures(queryParams);

  let feature = null;
  if (featureSet.features.length > 0) {
    feature = featureSet.features[0];
  }

  return feature;
}
