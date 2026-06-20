import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { login, getCurrentUser } from '../api/auth';

export const useAuthStore = defineStore('auth', () => {
  const token = ref(localStorage.getItem('token') || '');
  const user = ref(JSON.parse(localStorage.getItem('user') || 'null'));

  const isAuthenticated = computed(() => !!token.value);

  const loginAction = async (username, password) => {
    const response = await login(username, password);
    token.value = response.token;
    user.value = response.user;
    localStorage.setItem('token', response.token);
    localStorage.setItem('user', JSON.stringify(response.user));
    return response;
  };

  const logoutAction = () => {
    token.value = '';
    user.value = null;
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  const checkAuth = async () => {
    if (!token.value) return false;
    try {
      const response = await getCurrentUser();
      user.value = response.user;
      localStorage.setItem('user', JSON.stringify(response.user));
      return true;
    } catch (err) {
      logoutAction();
      return false;
    }
  };

  return {
    token,
    user,
    isAuthenticated,
    loginAction,
    logoutAction,
    checkAuth,
  };
});
