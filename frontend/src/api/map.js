import request from './index';

export const getMapLayers = () => {
  return request.get('/map/layers').then(res => res.data);
};

export const getMapPoints = (params) => {
  return request.get('/map/points', { params }).then(res => res.data);
};

export const getMapRectifiers = () => {
  return request.get('/map/rectifiers').then(res => res.data);
};

export const getPipelineRoute = () => {
  return request.get('/map/pipeline').then(res => res.data);
};
