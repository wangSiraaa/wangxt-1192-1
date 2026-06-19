<template>
  <div class="login-container">
    <div class="login-box">
      <h2 class="login-title">
        <el-icon :size="32" color="#667eea"><Position /></el-icon>
        阴极保护巡检系统
      </h2>
      <el-form ref="loginForm" :model="form" :rules="rules" label-width="80px">
        <el-form-item label="用户名" prop="username">
          <el-input v-model="form.username" placeholder="请输入用户名" size="large" :prefix-icon="User" />
        </el-form-item>
        <el-form-item label="密码" prop="password">
          <el-input v-model="form.password" type="password" placeholder="请输入密码" size="large" :prefix-icon="Lock" show-password />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="loading" size="large" style="width: 100%" @click="handleLogin">
            登 录
          </el-button>
        </el-form-item>
      </el-form>
      <div style="margin-top: 20px; padding: 12px; background: #f1f5f9; border-radius: 6px; font-size: 12px; color: #64748b;">
        <div style="margin-bottom: 4px;"><strong>测试账号：</strong></div>
        <div>巡线员：inspector01 / password123</div>
        <div>工程师：engineer01 / password123</div>
        <div>调度员：dispatcher01 / password123</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { User, Lock, Position } from '@element-plus/icons-vue';
import { useAuthStore } from '../stores/auth';

const router = useRouter();
const authStore = useAuthStore();
const loginForm = ref();
const loading = ref(false);

const form = reactive({
  username: '',
  password: '',
});

const rules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
};

const handleLogin = async () => {
  try {
    await loginForm.value.validate();
    loading.value = true;
    await authStore.loginAction(form.username, form.password);
    ElMessage.success('登录成功');
    router.push('/dashboard');
  } catch (err) {
    ElMessage.error(err.response?.data?.error || '登录失败');
  } finally {
    loading.value = false;
  }
};
</script>
