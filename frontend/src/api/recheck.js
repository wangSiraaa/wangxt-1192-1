import request from './index';

export const getRecheckPlans = (params) => {
  return request.get('/recheck-plans', { params }).then(res => res.data);
};

export const createRecheckPlan = (data) => {
  return request.post('/recheck-plans', data).then(res => res.data);
};

export const completeRecheckPlan = (id, data) => {
  return request.put(`/recheck-plans/${id}/complete`, data).then(res => res.data);
};

export const getRecheckPlan = (id) => {
  return request.get(`/recheck-plans/${id}`).then(res => res.data);
};
