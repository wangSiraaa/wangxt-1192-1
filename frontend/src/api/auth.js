import request from './index';

export const login = (username, password) => {
  return request.post('/auth/login', { username, password }).then(res => res.data);
};

export const getCurrentUser = () => {
  return request.get('/auth/me').then(res => res.data);
};
