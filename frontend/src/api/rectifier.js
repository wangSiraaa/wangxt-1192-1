import request from './index';

export const getRectifiers = (params) => {
  return request.get('/rectifiers', { params }).then(res => res.data);
};

export const getRectifier = (id) => {
  return request.get(`/rectifiers/${id}`).then(res => res.data);
};

export const createRectifier = (data) => {
  return request.post('/rectifiers', data).then(res => res.data);
};

export const updateRectifier = (id, data) => {
  return request.put(`/rectifiers/${id}`, data).then(res => res.data);
};

export const getAdjustments = (params) => {
  return request.get('/rectifier-adjustments', { params }).then(res => res.data);
};

export const createAdjustment = (data) => {
  return request.post('/rectifier-adjustments', data).then(res => res.data);
};

export const getAdjustment = (id) => {
  return request.get(`/rectifier-adjustments/${id}`).then(res => res.data);
};
