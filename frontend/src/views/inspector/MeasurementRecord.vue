<template>
  <div>
    <h2 class="page-title">数据采集</h2>
    
    <div class="page-container">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="120px" class="form-container">
        <div class="detail-section">
          <div class="detail-section-title">基本信息</div>
          <el-row :gutter="20">
            <el-col :span="12">
              <el-form-item label="测点选择" prop="pointId">
                <el-select v-model="form.pointId" placeholder="请选择测点" style="width: 100%;" filterable>
                  <el-option
                    v-for="point in points"
                    :key="point.id"
                    :label="`${point.code} - ${point.name}`"
                    :value="point.id"
                  />
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="测量时间" prop="measureTime">
                <el-date-picker
                  v-model="form.measureTime"
                  type="datetime"
                  placeholder="选择测量时间"
                  style="width: 100%;"
                  value-format="YYYY-MM-DD HH:mm:ss"
                />
              </el-form-item>
            </el-col>
          </el-row>
        </div>

        <div class="detail-section">
          <div class="detail-section-title">位置信息 <span style="color: #ef4444;">*</span></div>
          <el-row :gutter="20">
            <el-col :span="12">
              <el-form-item label="经度坐标" prop="longitude">
                <el-input-number
                  v-model="form.longitude"
                  :precision="6"
                  :step="0.000001"
                  placeholder="自动获取或手动输入"
                  style="width: 100%;"
                />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="纬度坐标" prop="latitude">
                <el-input-number
                  v-model="form.latitude"
                  :precision="6"
                  :step="0.000001"
                  placeholder="自动获取或手动输入"
                  style="width: 100%;"
                />
              </el-form-item>
            </el-col>
          </el-row>
          <el-button type="primary" text @click="getLocation">
            <el-icon><Location /></el-icon>
            获取当前位置
          </el-button>
          <div v-if="form.pointId" style="margin-top: 12px;">
            <el-tag size="small" type="info">
              测点基准坐标: {{ selectedPoint?.longitude }}, {{ selectedPoint?.latitude }}
            </el-tag>
            <el-tag v-if="distanceToPoint" size="small" :type="distanceToPoint > 100 ? 'warning' : 'success'" style="margin-left: 8px;">
              距离偏差: {{ distanceToPoint.toFixed(1) }} 米
            </el-tag>
          </div>
        </div>

        <div class="detail-section">
          <div class="detail-section-title">测量数据</div>
          <el-row :gutter="20">
            <el-col :span="12">
              <el-form-item label="保护电位(V)" prop="protectionPotential">
                <el-input-number
                  v-model="form.protectionPotential"
                  :precision="4"
                  :step="0.0001"
                  placeholder="请输入保护电位"
                  style="width: 100%;"
                />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="土壤电阻率(Ω·m)">
                <el-input-number
                  v-model="form.soilResistivity"
                  :precision="2"
                  :step="0.1"
                  placeholder="请输入土壤电阻率"
                  style="width: 100%;"
                />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="自然电位(V)">
                <el-input-number
                  v-model="form.naturalPotential"
                  :precision="4"
                  :step="0.0001"
                  placeholder="请输入自然电位"
                  style="width: 100%;"
                />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="环境温度(℃)">
                <el-input-number
                  v-model="form.temperature"
                  :precision="1"
                  :step="0.5"
                  placeholder="请输入环境温度"
                  style="width: 100%;"
                />
              </el-form-item>
            </el-col>
          </el-row>
          <el-row :gutter="20">
            <el-col :span="12">
              <el-form-item label="天气状况">
                <el-select v-model="form.weather" placeholder="请选择天气" style="width: 100%;">
                  <el-option label="晴" value="晴" />
                  <el-option label="多云" value="多云" />
                  <el-option label="阴" value="阴" />
                  <el-option label="小雨" value="小雨" />
                  <el-option label="中雨" value="中雨" />
                  <el-option label="大雨" value="大雨" />
                  <el-option label="雪" value="雪" />
                </el-select>
              </el-form-item>
            </el-col>
          </el-row>
          <div v-if="form.pointId && form.protectionPotential !== null">
            <el-alert
              :title="potentialStatus.message"
              :type="potentialStatus.type"
              :closable="false"
              style="margin-top: 16px;"
            />
          </div>
        </div>

        <el-form-item label="备注">
          <el-input v-model="form.notes" type="textarea" :rows="3" placeholder="请输入备注信息" />
        </el-form-item>

        <el-form-item>
          <el-button type="primary" :loading="submitting" size="large" @click="handleSubmit">
            提交记录
          </el-button>
          <el-button size="large" @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Location } from '@element-plus/icons-vue';
import { getPoints, createRecord } from '../../api/measurement';

const formRef = ref();
const submitting = ref(false);
const points = ref([]);
const gettingLocation = ref(false);

const form = reactive({
  pointId: null,
  measureTime: new Date(),
  longitude: null,
  latitude: null,
  protectionPotential: null,
  soilResistivity: null,
  naturalPotential: null,
  temperature: null,
  weather: '',
  notes: '',
});

const rules = {
  pointId: [{ required: true, message: '请选择测点', trigger: 'change' }],
  measureTime: [{ required: true, message: '请选择测量时间', trigger: 'change' }],
  longitude: [
    { required: true, message: '请输入经度坐标', trigger: 'blur' },
    { type: 'number', min: -180, max: 180, message: '经度范围-180到180', trigger: 'blur' },
  ],
  latitude: [
    { required: true, message: '请输入纬度坐标', trigger: 'blur' },
    { type: 'number', min: -90, max: 90, message: '纬度范围-90到90', trigger: 'blur' },
  ],
  protectionPotential: [
    { required: true, message: '请输入保护电位', trigger: 'blur' },
    { type: 'number', message: '请输入有效数值', trigger: 'blur' },
  ],
};

const selectedPoint = computed(() => {
  return points.value.find(p => p.id === form.pointId);
});

const distanceToPoint = computed(() => {
  if (!selectedPoint.value || form.longitude === null || form.latitude === null) return null;
  const R = 6371000;
  const dLat = (form.latitude - selectedPoint.value.latitude) * Math.PI / 180;
  const dLon = (form.longitude - selectedPoint.value.longitude) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(selectedPoint.value.latitude * Math.PI / 180) * Math.cos(form.latitude * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
});

const potentialStatus = computed(() => {
  if (!selectedPoint.value || form.protectionPotential === null) {
    return { type: 'info', message: '请选择测点并输入电位值' };
  }
  const { min_protection_potential, max_protection_potential } = selectedPoint.value;
  if (form.protectionPotential < min_protection_potential) {
    return { type: 'error', message: `电位过低，低于保护下限 ${min_protection_potential}V` };
  }
  if (form.protectionPotential > max_protection_potential) {
    return { type: 'error', message: `电位过高，高于保护上限 ${max_protection_potential}V` };
  }
  return { type: 'success', message: '电位在正常保护范围内' };
});

const loadPoints = async () => {
  try {
    const res = await getPoints({ status: 'ACTIVE' });
    points.value = res.data || [];
  } catch (err) {
    ElMessage.error('加载测点列表失败');
  }
};

const getLocation = () => {
  gettingLocation.value = true;
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        form.longitude = position.coords.longitude;
        form.latitude = position.coords.latitude;
        gettingLocation.value = false;
        ElMessage.success('位置获取成功');
      },
      (error) => {
        gettingLocation.value = false;
        ElMessage.error('位置获取失败，请手动输入');
      },
      { enableHighAccuracy: true }
    );
  } else {
    gettingLocation.value = false;
    ElMessage.error('浏览器不支持定位功能');
  }
};

const handleSubmit = async () => {
  try {
    await formRef.value.validate();
    
    const coordValidation = validateCoordinates(form.longitude, form.latitude);
    if (!coordValidation.valid) {
      ElMessage.error(coordValidation.errors.join(', '));
      return;
    }

    if (form.protectionPotential !== null && 
        (form.protectionPotential < -1.5 || form.protectionPotential > -0.7)) {
      await ElMessageBox.confirm(
        '电位值超出常规范围，是否确认提交？',
        '电位异常确认',
        { type: 'warning' }
      );
    }

    submitting.value = true;
    const res = await createRecord({
      pointId: form.pointId,
      measureTime: form.measureTime,
      longitude: form.longitude,
      latitude: form.latitude,
      protectionPotential: form.protectionPotential,
      soilResistivity: form.soilResistivity,
      naturalPotential: form.naturalPotential,
      temperature: form.temperature,
      weather: form.weather,
      notes: form.notes,
    });

    let message = res.message || '提交成功';
    if (res.recheckPlan) {
      message += `，已自动生成复测计划：${res.recheckPlan.plan_code}`;
    }
    if (res.risk) {
      message += `，已生成风险记录：${res.risk.risk_code}`;
    }

    ElMessage.success(message);
    handleReset();
  } catch (err) {
    if (err !== 'cancel') {
      ElMessage.error(err.response?.data?.error || '提交失败');
    }
  } finally {
    submitting.value = false;
  }
};

const validateCoordinates = (longitude, latitude) => {
  const errors = [];
  if (longitude === null || longitude === undefined || isNaN(longitude)) {
    errors.push('测点经度坐标缺失');
  }
  if (latitude === null || latitude === undefined || isNaN(latitude)) {
    errors.push('测点纬度坐标缺失');
  }
  return { valid: errors.length === 0, errors };
};

const handleReset = () => {
  formRef.value?.resetFields();
  form.measureTime = new Date();
};

onMounted(() => {
  loadPoints();
});
</script>
