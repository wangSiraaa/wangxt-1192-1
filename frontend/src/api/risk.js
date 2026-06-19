import request from './index';

export const getRisks = (params) => {
  return request.get('/risks', { params }).then(res => res.data);
};

export const createRisk = (data) => {
  return request.post('/risks', data).then(res => res.data);
};

export const closeRisk = (id, data) => {
  return request.put(`/risks/${id}/close`, data).then(res => res.data);
};

export const getRisk = (id) => {
  return request.get(`/risks/${id}`).then(res => res.data);
};
