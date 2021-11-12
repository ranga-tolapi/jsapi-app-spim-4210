import esriConfig from '@arcgis/core/config';
import MapView from '@arcgis/core/views/MapView';
import { initFeatureTables, initLayerPopupTemplates, initWidgets } from './widgets';
import WebMap from '@arcgis/core/WebMap';
import { applyPolyfills, defineCustomElements } from '@esri/calcite-components/dist/loader';

applyPolyfills().then(() => {
  defineCustomElements(window);
});

esriConfig.assetsPath = './assets';

const map = new WebMap({
  portalItem: {
    id: '34e9370cb7b94c9589d36ba5fddacea4',
  },
});

const view = new MapView({
  map: map,
  ui: {
    components: ['zoom'],
  },
  center: [103.82, 1.35],
  zoom: 12,
  container: 'viewDiv',
});

view.when(() => {
  initWidgets(view);
  initLayerPopupTemplates(view as MapView);

  const tablesContainer = document.querySelector('div[data-app-tables]') as HTMLDivElement;
  const calciteTabs = initFeatureTables(view as MapView);
  tablesContainer.appendChild(calciteTabs);
});
