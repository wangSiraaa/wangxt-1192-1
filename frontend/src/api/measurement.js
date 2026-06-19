import request from './index';

export const getPoints = (params) => {
  return request.get('/measurement-points', { params }).then(res => res.data);
};

export const getPoint = (id) => {
  return request.get(`/measurement-points/${id}`).then(res => res.data);
};

export const createPoint = (data) => {
  return request.post('/measurement-points', data).then(res => res.data);
};

export const updatePoint = (id, data) => {
  return request.put(`/measurement-points/${id}`, data).then(res => res.data);
};

export const getRecords = (params) => {
  return request.get('/measurement-records', { params }).then(res => res.data);
};

export const createRecord = (data) => {
  return request.post('/measurement-records', data).then(res => res.data);
};

export const getRecord = (id) => {
  return request.get(`/measurement-records/${id}`).then(res => res.data);
};
