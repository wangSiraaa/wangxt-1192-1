<template>
  <div class="layout-container">
    <header class="layout-header">
      <div class="system-title">
        <el-icon :size="24"><Position /></el-icon>
        长输天然气管道阴极保护巡检系统
      </div>
      <div class="user-info">
        <el-tag :type="userRoleType">{{ userRoleText }}</el-tag>
        <span>{{ authStore.user?.realName }}</span>
        <el-button type="primary" text @click="handleLogout">
          <el-icon><SwitchButton /></el-icon>
          退出
        </el-button>
      </div>
    </header>
    <div class="layout-body">
      <aside class="layout-sidebar">
        <el-menu
          :default-active="activeMenu"
          router
          background-color="#f8fafc"
          text-color="#334155"
          active-text-color="#2563eb"
        >
          <el-menu-item index="/dashboard">
            <el-icon><DataAnalysis /></el-icon>
            <span>首页概览</span>
          </el-menu-item>
          <el-menu-item index="/map">
            <el-icon><MapLocation /></el-icon>
            <span>地图监控</span>
          </el-menu-item>
          <template v-if="showInspectorMenu">
            <el-sub-menu index="inspector">
              <template #title>
                <el-icon><EditPen /></el-icon>
                <span>巡线员工作台</span>
              </template>
              <el-menu-item index="/measurement">数据采集</el-menu-item>
              <el-menu-item index="/recheck">复测任务</el-menu-item>
            </el-sub-menu>
          </template>
          <template v-if="showEngineerMenu">
            <el-sub-menu index="engineer">
              <template #title>
                <el-icon><TrendCharts /></el-icon>
                <span>工程师工作台</span>
              </template>
              <el-menu-item index="/analysis">异常分析</el-menu-item>
              <el-menu-item index="/recheck-plan">复测计划</el-menu-item>
            </el-sub-menu>
          </template>
          <template v-if="showDispatcherMenu">
            <el-sub-menu index="dispatcher">
              <template #title>
                <el-icon><Operation /></el-icon>
                <span>调控中心</span>
              </template>
              <el-menu-item index="/rectifier">整流器调整</el-menu-item>
              <el-menu-item index="/risk">风险管理</el-menu-item>
            </el-sub-menu>
          </template>
          <el-menu-item index="/points">
            <el-icon><SetUp /></el-icon>
            <span>测点管理</span>
          </el-menu-item>
          <el-menu-item index="/records">
            <el-icon><Document /></el-icon>
            <span>测量记录</span>
          </el-menu-item>
        </el-menu>
      </aside>
      <main class="layout-content">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </main>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Position, SwitchButton, DataAnalysis, MapLocation, EditPen, TrendCharts, Operation, SetUp, Document } from '@element-plus/icons-vue';
import { useAuthStore } from '../stores/auth';

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();

const activeMenu = computed(() => route.path);

const userRoleText = computed(() => {
  const roleMap = {
    INSPECTOR: '巡线员',
    ENGINEER: '腐蚀工程师',
    DISPATCHER: '调控中心',
  };
  return roleMap[authStore.user?.role] || '未知角色';
});

const userRoleType = computed(() => {
  const typeMap = {
    INSPECTOR: 'success',
    ENGINEER: 'warning',
    DISPATCHER: 'danger',
  };
  return typeMap[authStore.user?.role] || 'info';
});

const showInspectorMenu = computed(() => 
  ['INSPECTOR', 'ENGINEER'].includes(authStore.user?.role)
);

const showEngineerMenu = computed(() => 
  ['ENGINEER', 'DISPATCHER'].includes(authStore.user?.role)
);

const showDispatcherMenu = computed(() => 
  ['DISPATCHER', 'ENGINEER'].includes(authStore.user?.role)
);

const handleLogout = async () => {
  try {
    await ElMessageBox.confirm('确定要退出登录吗？', '提示', {
      type: 'warning',
    });
    authStore.logoutAction();
    ElMessage.success('已退出登录');
    router.push('/login');
  } catch {
    // User cancelled
  }
};
</script>
