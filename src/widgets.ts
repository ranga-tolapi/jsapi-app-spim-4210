// Widgets
import Bookmarks from '@arcgis/core/widgets/Bookmarks';
import ButtonMenuItem from '@arcgis/core/widgets/FeatureTable/Grid/support/ButtonMenuItem';
import * as calciteUtils from './modules/calciteUtils';
import CoordinateConversion from '@arcgis/core/widgets/CoordinateConversion';
import CreateWorkflowData from '@arcgis/core/widgets/Editor/CreateWorkflowData';
import CustomContent from '@arcgis/core/popup/content/CustomContent';
import Editor from '@arcgis/core/widgets/Editor';
import esriRequest from '@arcgis/core/request';
import Expand from '@arcgis/core/widgets/Expand';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import * as featureLayerUtils from './modules/featureLayerUtils';
import FeatureTable from '@arcgis/core/widgets/FeatureTable';
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer';
import Home from '@arcgis/core/widgets/Home';
import LayerList from '@arcgis/core/widgets/LayerList';
import Legend from '@arcgis/core/widgets/Legend';
import { parseDxf } from './modules/dxfUtils';
import Polygon from '@arcgis/core/geometry/Polygon';
import PopupTemplate from '@arcgis/core/PopupTemplate';
import * as projection from '@arcgis/core/geometry/projection';
import Search from '@arcgis/core/widgets/Search';
import ScaleBar from '@arcgis/core/widgets/ScaleBar';
import Graphic from '@arcgis/core/Graphic';

let editor: Editor;

export function initWidgets(view: MapView): MapView {
  editor = new Editor({ view: view });

  view.ui.add(
    [
      new Search({
        view: view,
      }),
      new Expand({
        view: view,
        content: new LayerList({ view: view }),
        group: 'top-right',
      }),
      new Expand({
        view: view,
        content: new Legend({ view: view }),
        group: 'top-right',
      }),
      new Expand({
        view: view,
        content: editor,
        group: 'top-right',
      }),
    ],
    'top-right',
  );

  view.ui.add(
    [
      new CoordinateConversion({
        view: view,
        multipleConversions: false,
        visibleElements: {
          captureButton: false,
        },
      }),
      new ScaleBar({
        view: view,
        unit: 'metric',
      }),
    ],
    'bottom-left',
  );

  view.ui.add(
    [
      new Home({
        view: view,
      }),
      new Expand({
        view: view,
        content: new Bookmarks({ view: view }),
        group: 'top-left',
      }),
    ],
    'top-left',
  );

  return view;
}

// List of fields to exclude from Identify, FeatureTable
const fieldsToExclude = [
  'OBJECTID',
  'GlobalID',
  'Shape__Area',
  'Shape__Length',
  'CreationDate',
  'Creator',
  'EditDate',
  'Editor',
];

const customContent = new CustomContent({
  outFields: ['*'],
  creator: (graphic) => {
    const calciteBlock = document.createElement('calcite-block');
    calciteBlock.collapsible = true;
    calciteBlock.summary = 'Update Geometry';

    const calciteIcon = document.createElement('calcite-icon');
    calciteIcon.scale = 's';
    calciteIcon.slot = 'icon';
    calciteIcon.icon = 'polygon-vertices';
    calciteBlock.appendChild(calciteIcon);

    const inputFile = document.createElement('input');
    inputFile.type = 'file';
    inputFile.accept = '.dxf';
    calciteBlock.appendChild(inputFile);

    const calciteButton = document.createElement('calcite-button');
    calciteButton.textContent = 'Update';
    calciteBlock.appendChild(calciteButton);

    calciteButton.addEventListener('click', async (e) => {
      calciteButton.loading = true;

      if (!inputFile.files || inputFile.files.length === 0) {
        calciteButton.loading = false;
        calciteUtils.calciteAlert('Update Geometry', 'Select a .dxf file first', 'yellow');
        return;
      }

      const dxfFile = inputFile.files[0];
      if (!dxfFile.name.toLowerCase().endsWith('.dxf')) {
        calciteButton.loading = false;
        calciteUtils.calciteAlert('Update Geometry', 'Invalid .dxf file', 'yellow');
        return;
      }

      const dxfContent = await dxfFile.text();
      const entities = parseDxf(dxfContent, 'Polygon');
      if (entities.length === 0) {
        calciteButton.loading = false;
        calciteUtils.calciteAlert('Update Geometry', 'No Polygon geometries found in the .dxf file', 'yellow');
        return;
      }

      const rings = entities[0].vertices.map((n) => [n.x, n.y]);
      const polygon = new Polygon({
        rings,
        spatialReference: { wkid: 4326 },
      });

      // Update the geometry
      featureLayerUtils.updateGeometry(graphic, polygon);

      calciteButton.loading = false;
      calciteUtils.calciteAlert('Update Geometry', 'Geometry updated successfully!', 'green');
    });

    return calciteBlock;
  },
});

const featureTableSelectedRows = {
  surveyRequests: [],
  workOrders: [],
};
const popupTemplateSurveyRequests = new PopupTemplate({});

let layerSurveyRequests: FeatureLayer;
let layerLandParcel: FeatureLayer;

export function initLayerPopupTemplates(view: MapView) {
  // View is ready
  view.when().then(function () {
    projection.load();

    // 'Work Orders' Layer of Web Map
    const layerWorkOrders = view.map.layers.find((layer) => {
      return layer.title === 'Work Orders';
    }) as FeatureLayer;

    // 'Survey Requests' Layer of Web Map
    layerSurveyRequests = view.map.layers.find((layer) => {
      return layer.title === 'Survey Requests';
    }) as FeatureLayer;

    // 'SLA Cadastral Land Parcel' Layer of Web Map
    layerLandParcel = view.map.layers.find((layer) => {
      return layer.title === 'SLA Cadastral Land Parcel';
    }) as FeatureLayer;

    // Layer is ready
    layerSurveyRequests.when(() => {
      // FieldInfos for PopupTemplate
      const fieldInfos = layerSurveyRequests.fields
        .filter((x) => !fieldsToExclude.includes(x.name))
        .map((x) => ({ fieldName: x.name, label: x.alias }));

      popupTemplateSurveyRequests.set({
        title: layerSurveyRequests.title,
        lastEditInfoEnabled: false,
        content: [
          {
            type: 'fields',
            fieldInfos: fieldInfos,
          },
        ],
      });

      layerSurveyRequests.popupTemplate = popupTemplateSurveyRequests.clone();

      // Catch the edits made to FeatureTable
      layerSurveyRequests.on('edits', async (events) => {
        if (events.addedFeatures.length === 0) {
          return;
        }

        // Cancel the workflow
        editor.viewModel.cancelWorkflow();

        const queryParams = layerSurveyRequests.createQuery();
        queryParams.set({
          outFields: ['*'],
          objectIds: [events.addedFeatures[0].objectId],
        });
        const featureSet = await layerSurveyRequests.queryFeatures(queryParams);

        if (featureSet.features.length > 0) {
          const addedFeature = featureSet.features[0];
          console.log('addedFeature', addedFeature);

          const crmUrl = `https://prod-13.southeastasia.logic.azure.com:443/workflows/75e35c787df74ae9803d8e831056c80d/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=ONDU3ghDL0BXpy23bJiqboBMs2uNRoWGI-X4W5_NfxY`;
          esriRequest(crmUrl, {
            headers: {
              'Content-Type': 'application/json',
            },
            body: `{"ObjectID": "${addedFeature.getObjectId()}", 
                      "CaseTitle": "${addedFeature.attributes.PLN_AREA_NAME}",
                      "Customer": "${addedFeature.attributes.SURVEYOR}",
                      "AreaName": "${addedFeature.attributes.PLN_AREA_NAME}",
                      "Description": "${addedFeature.attributes.DESCRIPTION}"
                    }`,
            responseType: 'text',
            method: 'post',
          })
            .then((response) => {
              console.log('response', response);
            })
            .catch((error) => {
              console.error('esriRequest for CRM failed', error);
            });
        }
      });
    });

    // Work Orders Layer ready
    layerWorkOrders.when(() => {
      // FieldInfos for PopupTemplate
      const fieldInfos = layerWorkOrders.fields
        .filter((x) => !fieldsToExclude.includes(x.name))
        .map((x) => ({ fieldName: x.name, label: x.alias }));

      layerWorkOrders.popupTemplate = new PopupTemplate({
        title: layerWorkOrders.title,
        lastEditInfoEnabled: false,
        content: [{ type: 'fields', fieldInfos: fieldInfos }],
      });
    });
  });

  // Control the visibility of "Create Request" action for Layer
  view.popup.watch('selectedFeature', (graphic) => {
    if (graphic && graphic.layer.title === 'Survey Requests') {
      const graphicTemplate = graphic.getEffectivePopupTemplate();
      if (graphic.attributes['STATUS'] === 'Completed') {
        const customPopupTemplate = popupTemplateSurveyRequests.clone();
        (customPopupTemplate.content as Content[]).push(customContent);
        graphic.layer.popupTemplate = customPopupTemplate;
      } else {
        graphic.layer.popupTemplate = popupTemplateSurveyRequests;
      }
    }
  });

  view.on('click', async (event) => {
    // Action for mouse right-click event
    if (event.button === 2) {
      const featureRef = await featureLayerUtils.extractFeatureFromLayer(layerLandParcel, view.toMap(event));
      if (featureRef) {
        console.log('geometry', featureRef);
        // layerSurveyRequests
        //   .applyEdits({
        //     addFeatures: [
        //       new Graphic({
        //         geometry: projection.project(
        //           feature.geometry.clone(),
        //           layerSurveyRequests.spatialReference,
        //         ) as Geometry,
        //         attributes: {
        //           PLN_AREA_NAME: `${feature.attributes.LOT_KEY}`,
        //           SURVEYOR: 'SLA',
        //           DESCRIPTION: 'Description',
        //         },
        //       }),
        //     ],
        //   })
        //   .then((response) => {
        //     console.log('response', response);
        //   })
        //   .catch((error) => {
        //     console.error('error', error);
        //   });

        const feature = new Graphic({
          geometry: projection.project(
            featureRef.geometry.clone(),
            layerSurveyRequests.spatialReference,
          ) as Geometry,
          attributes: {
            PLN_AREA_NAME: `${featureRef.attributes.LOT_KEY}`,
            SURVEYOR: 'SLA',
            DESCRIPTION: 'Description',
            STATUS: 'Open',
          },
          sourceLayer: layerSurveyRequests,
          symbol: editor.viewModel.sketchViewModel.polygonSymbol,
        });
        editor.viewModel.sketchViewModel.layer.add(feature);

        editor
          .startCreateWorkflowAtFeatureEdit(feature)
          // .startCreateWorkflowAtFeatureTypeSelection()
          // .startCreateWorkflowAtFeatureCreation({
          //   layer: layerSurveyRequests,
          //   template: layerSurveyRequests.templates[0]
          // })
          .then((response) => {
            console.log('response', response);
            (editor.activeWorkflow.data as CreateWorkflowData).creationInfo = {
              layer: layerSurveyRequests,
              template: layerSurveyRequests.templates[0],
            };
          })
          .catch((error) => {
            console.error('error', error);
          });
      }
    }
  });
}

export function initFeatureTables(view: MapView) {
  const calciteTabs = document.createElement('calcite-tabs');
  calciteTabs.style.width = '100%';

  const calciteTabNav = document.createElement('calcite-tab-nav');
  calciteTabNav.slot = 'tab-nav';

  const layers = view.map.layers.toArray();

  let isFirstTab = true;
  layers.forEach((layer) => {
    if (layer.type === 'feature') {
      const calciteTabTitle = document.createElement('calcite-tab-title');
      if (isFirstTab) {
        calciteTabTitle.active = true;
        isFirstTab = false;
      }
      calciteTabTitle.textContent = layer.title;
      calciteTabNav.appendChild(calciteTabTitle);
    }
  });
  calciteTabs.appendChild(calciteTabNav);

  isFirstTab = true;
  layers.forEach((layer) => {
    if (layer.type === 'feature') {
      // layer.when(() => {
      const calciteTab = document.createElement('calcite-tab');
      calciteTab.style.width = '100%';
      if (isFirstTab) {
        calciteTab.active = true;
        isFirstTab = false;
      }
      const tableDiv = document.createElement('div');
      tableDiv.className = 'app--table';

      // FieldConfigs for FeatureTable
      // const fieldConfigs = (layer as FeatureLayer).fields
      //   .filter((x) => !fieldsToExclude.includes(x.name))
      //   .map((x) => ({ name: x.name, label: x.alias }));

      const featureTable = new FeatureTable({
        view: view,
        layer: layer as FeatureLayer,
        container: tableDiv,
        // fieldConfigs: fieldConfigs,
        menuConfig: {
          items: [
            new ButtonMenuItem({
              label: 'Zoom to feature',
              iconClass: 'esri-icon-zoom-in-magnifying-glass',
              clickFunction: (event) => {
                const features =
                  layer.title === 'Survey Requests'
                    ? featureTableSelectedRows.surveyRequests
                    : featureTableSelectedRows.workOrders;
                if (features.length > 0) {
                  view.goTo(features.map((x) => x.feature));
                }
              },
            }),
          ],
        },
      });

      featureTable.when(() => {
        featureTable.on('selection-change', (changes) => {
          const features =
            featureTable.layer.title === 'Survey Requests'
              ? featureTableSelectedRows.surveyRequests
              : featureTableSelectedRows.workOrders;

          // If the selection is removed, remove the feature from the array
          changes.removed.forEach((item) => {
            const data = features.find((data) => {
              return data.feature === item.feature;
            });
            if (data) {
              features.splice(features.indexOf(data), 1);
            }
          });

          // If the selection is added, push all added selections to array
          changes.added.forEach((item) => {
            const feature = item.feature;
            features.push({
              feature: feature,
            });
          });
        });
      });

      calciteTab.appendChild(tableDiv);
      calciteTabs.appendChild(calciteTab);
      // });
    }
  });

  return calciteTabs;
}
