import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('../views/Login.vue'),
    meta: { requiresAuth: false },
  },
  {
    path: '/',
    component: () => import('../layout/MainLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      {
        path: '',
        redirect: '/dashboard',
      },
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('../views/Dashboard.vue'),
        meta: { title: '首页概览' },
      },
      {
        path: 'map',
        name: 'Map',
        component: () => import('../views/MapView.vue'),
        meta: { title: '地图监控' },
      },
      {
        path: 'measurement',
        name: 'Measurement',
        component: () => import('../views/inspector/MeasurementRecord.vue'),
        meta: { title: '数据采集', roles: ['INSPECTOR', 'ENGINEER'] },
      },
      {
        path: 'recheck',
        name: 'Recheck',
        component: () => import('../views/inspector/RecheckTask.vue'),
        meta: { title: '复测任务', roles: ['INSPECTOR', 'ENGINEER'] },
      },
      {
        path: 'analysis',
        name: 'Analysis',
        component: () => import('../views/engineer/AbnormalAnalysis.vue'),
        meta: { title: '异常分析', roles: ['ENGINEER'] },
      },
      {
        path: 'recheck-plan',
        name: 'RecheckPlan',
        component: () => import('../views/engineer/RecheckPlan.vue'),
        meta: { title: '复测计划', roles: ['ENGINEER', 'DISPATCHER'] },
      },
      {
        path: 'rectifier',
        name: 'Rectifier',
        component: () => import('../views/dispatcher/RectifierAdjust.vue'),
        meta: { title: '整流器调整', roles: ['DISPATCHER', 'ENGINEER'] },
      },
      {
        path: 'risk',
        name: 'Risk',
        component: () => import('../views/dispatcher/RiskManagement.vue'),
        meta: { title: '风险管理', roles: ['ENGINEER', 'DISPATCHER'] },
      },
      {
        path: 'points',
        name: 'Points',
        component: () => import('../views/MeasurementPoints.vue'),
        meta: { title: '测点管理', roles: ['ENGINEER', 'DISPATCHER'] },
      },
      {
        path: 'records',
        name: 'Records',
        component: () => import('../views/MeasurementRecords.vue'),
        meta: { title: '测量记录' },
      },
    ],
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach((to, from, next) => {
  const authStore = useAuthStore();
  const isAuthenticated = authStore.isAuthenticated;
  const userRole = authStore.user?.role;

  if (to.meta.requiresAuth && !isAuthenticated) {
    next('/login');
  } else if (to.path === '/login' && isAuthenticated) {
    next('/dashboard');
  } else if (to.meta.roles && userRole && !to.meta.roles.includes(userRole)) {
    next('/dashboard');
  } else {
    next();
  }
});

export default router;
