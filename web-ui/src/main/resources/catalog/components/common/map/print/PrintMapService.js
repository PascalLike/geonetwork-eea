(function() {
  goog.provide('gn_printmap_service');

  var module = angular.module('gn_printmap_service', []);

  module.service('gnPrint', function (){

    var self = this;

    this.encoders = {
      'layers': {
        'Layer': function(layer) {
          var enc = {
            layer: layer.bodId,
            opacity: layer.getOpacity()
          };
          return enc;
        },
        'Group': function(layer, proj) {
          var encs = [];
          var subLayers = layer.getLayers();
          subLayers.forEach(function(subLayer, idx, arr) {
            if (subLayer.visible) {
              var enc = self.encoders.
                  layers['Layer'].call(this, layer);
              var layerEnc = encodeLayer(subLayer, proj);
              if (layerEnc && layerEnc.layer) {
                $.extend(enc, layerEnc);
                encs.push(enc.layer);
              }
            }
          });
          return encs;
        },
        'Vector': function(layer, features) {
          var enc = self.encoders.
              layers['Layer'].call(this, layer);
          var format = new ol.format.GeoJSON();
          var encStyles = {};
          var encFeatures = [];
          var stylesDict = {};
          var styleId = 0;
          var hasLayerStyleFunction = !!(layer.getStyleFunction &&
              layer.getStyleFunction());

          angular.forEach(features, function(feature) {
            var encStyle = {
              id: styleId
            };
            var styles = (hasLayerStyleFunction) ?
                layer.getStyleFunction()(feature) :
                ol.feature.defaultStyleFunction(feature);


            var geometry = feature.getGeometry();

            // Transform an ol.geom.Circle to a ol.geom.Polygon
            if (geometry.getType() === 'Circle') {
              var polygon = circleToPolygon(geometry);
              feature = new ol.Feature(polygon);
            }

            var encJSON = format.writeFeature(feature);
            if (!encJSON.properties) {
              encJSON.properties = {};

            } else if (encJSON.properties.Style) {
              delete encJSON.properties.Style;
            }

            encJSON.properties._gx_style = styleId;
            encFeatures.push(encJSON);

            if (styles && styles.length > 0) {
              $.extend(encStyle, transformToPrintLiteral(feature, styles[0]));
            }

            encStyles[styleId] = encStyle;
            styleId++;
          });
          angular.extend(enc, {
            type: 'Vector',
            styles: encStyles,
            styleProperty: '_gx_style',
            geoJson: {
              type: 'FeatureCollection',
              features: encFeatures
            },
            name: layer.bodId,
            opacity: (layer.opacity != null) ? layer.opacity : 1.0
          });
          return enc;
        },
        'WMS': function(layer, config) {
          var enc = self.encoders.
              layers['Layer'].call(this, layer);
          var params = layer.getSource().getParams();
          var layers = params.LAYERS.split(',') || [];
          var styles = (params.STYLES !== undefined) ?
              params.STYLES.split(',') :
              new Array(layers.length).join(',').split(',');
          var url = layer instanceof ol.source.ImageWMS ? layer.getSource().getUrl() :
              layer.getSource().getUrls()[0];
          angular.extend(enc, {
            type: 'WMS',
            baseURL: config.wmsUrl || url,
            layers: layers,
            styles: styles,
            format: 'image/' + (config.format || 'png'),
            customParams: {
              'EXCEPTIONS': 'XML',
              'TRANSPARENT': 'true',
              'CRS': 'EPSG:3857',
              'TIME': params.TIME
            },
            singleTile: config.singleTile || false
          });
          return enc;
        },
        'OSM': function(layer, config) {
          var enc = self.encoders.
              layers['Layer'].call(this, layer);
          angular.extend(enc, {
            type: 'OSM',
            baseURL: 'http://a.tile.openstreetmap.org/',
            extension: 'png',
            maxExtent: layer.getSource().getExtent(),
            resolutions:  layer.getSource().tileGrid.getResolutions(),
            tileSize: [
              layer.getSource().tileGrid.getTileSize(),
              layer.getSource().tileGrid.getTileSize()]
          });
          return enc;
        },
        'WMTS': function(layer, config) {
          var enc = self.encoders.layers['Layer'].
              call(this, layer);
          var source = layer.getSource();
          var tileGrid = source.getTileGrid();
          angular.extend(enc, {
            type: 'WMTS',
            baseURL: location.protocol + '//wmts.geo.admin.ch',
            layer: config.serverLayerName,
            maxExtent: source.getExtent(),
            tileOrigin: tileGrid.getOrigin(),
            tileSize: [tileGrid.getTileSize(), tileGrid.getTileSize()],
            resolutions: tileGrid.getResolutions(),
            zoomOffset: tileGrid.getMinZoom(),
            version: '1.0.0',
            requestEncoding: 'REST',
            formatSuffix: config.format || 'jpeg',
            style: 'default',
            dimensions: ['TIME'],
            params: {'TIME': source.getDimensions().Time},
            matrixSet: '21781'
          });

          return enc;
        }
      },
      'legends' : {
        'ga_urllegend': function(layer, config) {
          var format = '.png';
          if ($scope.options.pdfLegendList.indexOf(layer.bodId) != -1) {
            format = pdfLegendString;
          }
          var enc = self.encoders.legends.base.call(this, config);
          enc.classes.push({
            name: '',
            icon: $scope.options.legendUrl +
                layer.bodId + '_' + $translate.uses() + format
          });
          return enc;
        },
        'base': function(config) {
          return {
            name: config.label,
            classes: []
          };
        }
      }
    };

    // Transform an ol.Color to an hexadecimal string
    var toHexa = function(olColor) {
      var hex = '#';
      for (var i = 0; i < 3; i++) {
        var part = olColor[i].toString(16);
        if (part.length === 1 && parseInt(part) < 10) {
          hex += '0';
        }
        hex += part;
      }
      return hex;
    };

    // Transform a ol.style.Style to a print literal object
    var transformToPrintLiteral = function(feature, style) {
      /**
       * ol.style.Style properties:
       *
       *  fill: ol.style.Fill :
       *    fill: String
       *  image: ol.style.Image:
       *    anchor: array[2]
       *    rotation
       *    size: array[2]
       *    src: String
       *  stroke: ol.style.Stroke:
       *    color: String
       *    lineCap
       *    lineDash
       *    lineJoin
       *    miterLimit
       *    width: Number
       *  text
       *  zIndex
       */

      /**
       * Print server properties:
       *
       * fillColor
       * fillOpacity
       * strokeColor
       * strokeOpacity
       * strokeWidth
       * strokeLinecap
       * strokeLinejoin
       * strokeDashstyle
       * pointRadius
       * label
       * fontFamily
       * fontSize
       * fontWeight
       * fontColor
       * labelAlign
       * labelOutlineColor
       * labelOutlineWidth
       * graphicHeight
       * graphicOpacity
       * graphicWidth
       * graphicXOffset
       * graphicYOffset
       * zIndex
       */

      var literal = {
        zIndex: style.getZIndex()
      };
      var type = feature.getGeometry().getType();
      var fill = style.getFill();
      var stroke = style.getStroke();
      var textStyle = style.getText();
      var imageStyle = style.getImage();

      if (imageStyle && type =='Point') {
        var size = imageStyle.getSize();
        var anchor = imageStyle.getAnchor();
        var scale = imageStyle.getScale();
        literal.rotation = imageStyle.getRotation();
        if (size) {
          literal.graphicWidth = size[0] * scale;
          literal.graphicHeight = size[1] * scale;
        }
        if (anchor) {
          literal.graphicXOffset = -anchor[0] * scale;
          literal.graphicYOffset = -anchor[1] * scale;
        }
        if (imageStyle instanceof ol.style.Icon) {
          literal.externalGraphic = imageStyle.getSrc();
          literal.fillOpacity = 1;
        } else { // ol.style.Circle
          fill = imageStyle.getFill();
          stroke = imageStyle.getStroke();
          literal.pointRadius = imageStyle.getRadius();
        }
      }

      if (fill) {
        var color = ol.color.asArray(fill.getColor());
        literal.fillColor = toHexa(color);
        literal.fillOpacity = color[3];
      } else if (!literal.fillOpacity) {
        literal.fillOpacity = 0; // No fill
      }

      if (stroke) {
        var color = ol.color.asArray(stroke.getColor());
        literal.strokeWidth = stroke.getWidth();
        literal.strokeColor = toHexa(color);
        literal.strokeOpacity = color[3];
        literal.strokeLinecap = stroke.getLineCap() || 'round';
        literal.strokeLinejoin = stroke.getLineJoin() || 'round';

        if (stroke.getLineDash()) {
          literal.strokeDashstyle = 'dash';
        }
        // TO FIX: Not managed by the print server
        // literal.strokeMiterlimit = stroke.getMiterLimit();
      } else {
        literal.strokeOpacity = 0; // No Stroke
      }

      if (textStyle) {
        var fillColor = ol.color.asArray(textStyle.getFill().getColor());
        var strokeColor = ol.color.asArray(textStyle.getStroke().getColor());
        var fontValues = textStyle.getFont().split(' ');
        literal.fontColor = toHexa(fillColor);
        // Fonts managed by print server: COURIER, HELVETICA, TIMES_ROMAN
        literal.fontFamily = fontValues[2].toUpperCase();
        literal.fontSize = parseInt(fontValues[1]);
        literal.fontWeight = fontValues[0];
        literal.label = textStyle.getText();
        literal.labelAlign = textStyle.getTextAlign();
        literal.labelOutlineColor = toHexa(strokeColor);
        literal.labelOutlineWidth = textStyle.getStroke().getWidth();
      }

      return literal;
    };

  });
})();
