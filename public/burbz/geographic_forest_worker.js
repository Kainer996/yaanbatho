/* Dedicated local worker: geographic validation and placement stay off the UI
 * thread. The controller owns request generations and ignores stale replies.
 * Only this fixed same-origin core is loaded; messages cannot select a URL.
 */
'use strict';
importScripts('geographic_forest_core.js?v=living-map-v373-20260908');
self.onmessage = function(event) {
  const request = event && event.data;
  const id = request && request.id;
  if (!(typeof id === 'string' && id.length <= 128) &&
      !(typeof id === 'number' && Number.isFinite(id))) return;
  try {
    const core = self.BurbzGeographicForestCore;
    const features = request.features;
    const list = Array.isArray(features) ? features : features &&
      features.type === 'FeatureCollection' && Array.isArray(features.features) ? features.features : null;
    if (!list || list.length > core.LIMITS.maxFeatures) throw new Error('Forest feature budget exceeded or invalid request.');
    const options = request.options || {};
    if (options.routeSegments != null && (!Array.isArray(options.routeSegments) ||
        options.routeSegments.length > core.LIMITS.maxRouteSegments)) throw new Error('Forest route budget exceeded or invalid request.');
    const result=core.placeTrees(features,request.view,options);
    if(request.timberView)result.timber=core.timber(features,request.timberView);
    self.postMessage({id,result});
  } catch (error) {
    self.postMessage({id, error:error && typeof error.message === 'string' ? error.message.slice(0,240) : 'Forest placement failed.'});
  }
};
