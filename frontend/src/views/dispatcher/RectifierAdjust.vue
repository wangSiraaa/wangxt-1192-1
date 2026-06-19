<template>
  <div>
    <h2 class="page-title">整流器调整</h2>
    
    <div class="page-container">
      <el-row :gutter="20">
        <el-col :span="8">
          <el-card class="stat-card">
            <div class="stat-content">
              <div class="stat-icon success">
                <el-icon><Setting /></el-icon>
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ rectifierStats.total }}</div>
                <div class="stat-label">整流器总数</div>
              </div>
            </div>
          </el-card>
        </el-col>
        <el-col :span="8">
          <el-card class="stat-card">
            <div class="stat-content">
              <div class="stat-icon warning">
                <el-icon><Operation /></el-icon>
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ rectifierStats.running }}</div>
                <div class="stat-label">运行中</div>
              </div>
            </div>
          </el-card>
        </el-col>
        <el-col :span="8">
          <el-card class="stat-card">
            <div class="stat-content">
              <div class="stat-icon info">
                <el-icon><Document /></el-icon>
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ rectifierStats.pendingAdjust }}</div>
                <div class="stat-label">待调整</div>
              </div>
            </div>
          </el-card>
        </el-col>
      </el-row>

      <el-card class="table-card">
        <template #header>
          <div class="card-header">
            <span>整流器列表</span>
            <div>
              <el-select v-model="filterStatus" placeholder="运行状态" clearable style="width: 120px; margin-right: 10px;" @change="loadRectifiers">
                <el-option label="运行中" value="RUNNING" />
                <el-option label="停运" value="STOPPED" />
                <el-option label="故障" value="FAULT" />
              </el-select>
              <el-button type="success" @click="openCreateDialog">
                <el-icon><Plus /></el-icon>
                新建调整
              </el-button>
            </div>
          </div>
        </template>

        <el-table :data="rectifiers" v-loading="loading" stripe>
          <el-table-column prop="code" label="设备编号" width="140" />
          <el-table-column prop="name" label="设备名称" width="160" />
          <el-table-column prop="model" label="型号" width="140" />
          <el-table-column label="额定参数" width="160">
            <template #default="{ row }">
              {{ row.rated_voltage }}V / {{ row.rated_current }}A
            </template>
          </el-table-column>
          <el-table-column label="当前输出" width="160">
            <template #default="{ row }">
              {{ row.output_voltage || '-' }}V / {{ row.output_current || '-' }}A
            </template>
          </el-table-column>
          <el-table-column label="运行状态" width="100">
            <template #default="{ row }">
              <el-tag :type="getStatusType(row.status)" size="small">
                {{ getStatusText(row.status) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="install_location" label="安装位置" show-overflow-tooltip />
          <el-table-column label="关联测点" width="120">
            <template #default="{ row }">
              {{ row.associated_points || 0 }} 个
            </template>
          </el-table-column>
          <el-table-column label="最近调整" width="160">
            <template #default="{ row }">
              {{ row.last_adjust_time ? formatDate(row.last_adjust_time) : '-' }}
            </template>
          </el-table-column>
          <el-table-column label="操作" width="220" fixed="right">
            <template #default="{ row }">
              <el-button type="primary" size="small" @click="openAdjustDialog(row)">参数调整</el-button>
              <el-button size="small" @click="viewDetail(row)">详情</el-button>
              <el-button size="small" @click="viewAdjustHistory(row)">调整记录</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-card>

      <el-card class="table-card">
        <template #header>
          <span>调整记录</span>
        </template>
        <el-table :data="adjustmentHistory" v-loading="loadingHistory" size="small" stripe>
          <el-table-column prop="adjustment_code" label="调整单号" width="160" />
          <el-table-column label="整流器" width="160">
            <template #default="{ row }">
              {{ row.rectifier?.code }} - {{ row.rectifier?.name }}
            </template>
          </el-table-column>
          <el-table-column label="调整前参数" width="160">
            <template #default="{ row }">
              {{ row.before_voltage }}V / {{ row.before_current }}A
            </template>
          </el-table-column>
          <el-table-column label="调整后参数" width="160">
            <template #default="{ row }">
              {{ row.after_voltage }}V / {{ row.after_current }}A
            </template>
          </el-table-column>
          <el-table-column label="调整原因" show-overflow-tooltip />
          <el-table-column label="复测状态" width="100">
            <template #default="{ row }">
              <el-tag :type="row.recheck_completed ? 'success' : 'warning'" size="small">
                {{ row.recheck_completed ? '已复测' : '待复测' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作人" width="100">
            <template #default="{ row }">
              {{ row.operator?.name || '-' }}
            </template>
          </el-table-column>
          <el-table-column label="调整时间" width="160">
            <template #default="{ row }">
              {{ formatDate(row.created_at) }}
            </template>
          </el-table-column>
        </el-table>
      </el-card>
    </div>

    <el-dialog v-model="adjustDialogVisible" title="整流器参数调整" width="600px" :close-on-click-modal="false">
      <el-form ref="adjustFormRef" :model="adjustForm" :rules="adjustRules" label-width="120px">
        <div v-if="currentRectifier" class="rectifier-info">
          <el-alert :title="`设备: ${currentRectifier.code} - ${currentRectifier.name}`" type="info" :closable="false" />
        </div>

        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="调整前电压(V)">
              <el-input-number
                v-model="adjustForm.beforeVoltage"
                :precision="2"
                :step="0.1"
                placeholder="当前电压"
                style="width: 100%;"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="调整前电流(A)">
              <el-input-number
                v-model="adjustForm.beforeCurrent"
                :precision="2"
                :step="0.1"
                placeholder="当前电流"
                style="width: 100%;"
              />
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="调整后电压(V)" prop="afterVoltage">
              <el-input-number
                v-model="adjustForm.afterVoltage"
                :precision="2"
                :step="0.1"
                placeholder="目标电压"
                style="width: 100%;"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="调整后电流(A)" prop="afterCurrent">
              <el-input-number
                v-model="adjustForm.afterCurrent"
                :precision="2"
                :step="0.1"
                placeholder="目标电流"
                style="width: 100%;"
              />
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="调整原因" prop="reason">
          <el-input v-model="adjustForm.reason" type="textarea" :rows="3" placeholder="请输入调整原因" />
        </el-form-item>

        <el-form-item label="关联风险" prop="riskId">
          <el-select v-model="adjustForm.riskId" placeholder="关联风险记录（可选）" style="width: 100%;" clearable>
            <el-option
              v-for="risk in relatedRisks"
              :key="risk.id"
              :label="`${risk.risk_code} - ${risk.description}`"
              :value="risk.id"
            />
          </el-select>
        </el-form-item>

        <el-form-item label="备注">
          <el-input v-model="adjustForm.notes" type="textarea" :rows="2" placeholder="请输入备注信息" />
        </el-form-item>
      </el-form>
      
      <template #footer>
        <el-button @click="adjustDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submitAdjust">确认调整</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="detailDialogVisible" title="整流器详情" width="600px">
      <el-descriptions :column="2" border v-if="currentRectifier">
        <el-descriptions-item label="设备编号">{{ currentRectifier.code }}</el-descriptions-item>
        <el-descriptions-item label="设备名称">{{ currentRectifier.name }}</el-descriptions-item>
        <el-descriptions-item label="型号">{{ currentRectifier.model }}</el-descriptions-item>
        <el-descriptions-item label="出厂编号">{{ currentRectifier.serial_number || '-' }}</el-descriptions-item>
        <el-descriptions-item label="额定电压(V)">{{ currentRectifier.rated_voltage }}</el-descriptions-item>
        <el-descriptions-item label="额定电流(A)">{{ currentRectifier.rated_current }}</el-descriptions-item>
        <el-descriptions-item label="当前电压(V)">{{ currentRectifier.output_voltage || '-' }}</el-descriptions-item>
        <el-descriptions-item label="当前电流(A)">{{ currentRectifier.output_current || '-' }}</el-descriptions-item>
        <el-descriptions-item label="运行状态">
          <el-tag :type="getStatusType(currentRectifier.status)">
            {{ getStatusText(currentRectifier.status) }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="安装日期">{{ formatDate(currentRectifier.install_date) }}</el-descriptions-item>
        <el-descriptions-item label="安装位置" :span="2">{{ currentRectifier.install_location }}</el-descriptions-item>
        <el-descriptions-item label="经纬度">
          {{ currentRectifier.longitude }}, {{ currentRectifier.latitude }}
        </el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="currentRectifier.status === 'ACTIVE' ? 'success' : 'info'">
            {{ currentRectifier.status === 'ACTIVE' ? '启用' : '停用' }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="最近调整时间" :span="2">
          {{ currentRectifier.last_adjust_time ? formatDate(currentRectifier.last_adjust_time) : '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="备注" :span="2">{{ currentRectifier.notes || '-' }}</el-descriptions-item>
      </el-descriptions>
    </el-dialog>

    <el-dialog v-model="historyDialogVisible" title="调整记录历史" width="800px">
      <el-table :data="rectifierHistory" v-loading="loadingRectifierHistory" size="small" stripe>
        <el-table-column prop="adjustment_code" label="调整单号" width="140" />
        <el-table-column label="调整前" width="140">
          <template #default="{ row }">
            {{ row.before_voltage }}V / {{ row.before_current }}A
          </template>
        </el-table-column>
        <el-table-column label="调整后" width="140">
          <template #default="{ row }">
            {{ row.after_voltage }}V / {{ row.after_current }}A
          </template>
        </el-table-column>
        <el-table-column label="调整原因" show-overflow-tooltip />
        <el-table-column label="复测状态" width="80">
          <template #default="{ row }">
            <el-tag :type="row.recheck_completed ? 'success' : 'warning'" size="small">
              {{ row.recheck_completed ? '已' : '待' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作人" width="80">
          <template #default="{ row }">
            {{ row.operator?.name || '-' }}
          </template>
        </el-table-column>
        <el-table-column label="调整时间" width="140">
          <template #default="{ row }">
            {{ formatDate(row.created_at) }}
          </template>
        </el-table-column>
      </el-table>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { Setting, Operation, Document, Plus } from '@element-plus/icons-vue';
import { getRectifiers, createAdjustment, getAdjustments } from '../../api/rectifier';
import { getRisks } from '../../api/risk';

const loading = ref(false);
const loadingHistory = ref(false);
const loadingRectifierHistory = ref(false);
const submitting = ref(false);
const rectifiers = ref([]);
const adjustmentHistory = ref([]);
const rectifierHistory = ref([]);
const relatedRisks = ref([]);
const filterStatus = ref('');
const adjustDialogVisible = ref(false);
const detailDialogVisible = ref(false);
const historyDialogVisible = ref(false);
const adjustFormRef = ref();
const currentRectifier = ref(null);

const rectifierStats = reactive({
  total: 0,
  running: 0,
  pendingAdjust: 0,
});

const adjustForm = reactive({
  rectifierId: null,
  beforeVoltage: null,
  beforeCurrent: null,
  afterVoltage: null,
  afterCurrent: null,
  reason: '',
  riskId: null,
  notes: '',
});

const adjustRules = {
  afterVoltage: [{ required: true, message: '请输入调整后电压', trigger: 'blur' }],
  afterCurrent: [{ required: true, message: '请输入调整后电流', trigger: 'blur' }],
  reason: [{ required: true, message: '请输入调整原因', trigger: 'blur' }],
};

const formatDate = (date) => {
  if (!date) return '-';
  return new Date(date).toLocaleString('zh-CN');
};

const getStatusType = (status) => {
  const map = { RUNNING: 'success', STOPPED: 'info', FAULT: 'danger' };
  return map[status] || 'info';
};

const getStatusText = (status) => {
  const map = { RUNNING: '运行中', STOPPED: '停运', FAULT: '故障' };
  return map[status] || status;
};

const loadRectifiers = async () => {
  loading.value = true;
  try {
    const params = {};
    if (filterStatus.value) {
      params.status = filterStatus.value;
    }
    const res = await getRectifiers(params);
    rectifiers.value = res.data || [];
    
    rectifierStats.total = rectifiers.value.length;
    rectifierStats.running = rectifiers.value.filter(r => r.status === 'RUNNING').length;
    rectifierStats.pendingAdjust = rectifiers.value.filter(r => r.need_adjust).length;
  } catch (err) {
    ElMessage.error('加载整流器列表失败');
  } finally {
    loading.value = false;
  }
};

const loadAdjustmentHistory = async () => {
  loadingHistory.value = true;
  try {
    const res = await getAdjustments({ pageSize: 10 });
    adjustmentHistory.value = res.data || [];
  } catch (err) {
    ElMessage.error('加载调整记录失败');
  } finally {
    loadingHistory.value = false;
  }
};

const loadRelatedRisks = async () => {
  try {
    const res = await getRisks({ status: 'OPEN' });
    relatedRisks.value = res.data || [];
  } catch (err) {
    console.error('加载风险列表失败', err);
  }
};

const openCreateDialog = () => {
  currentRectifier.value = null;
  resetAdjustForm();
  loadRelatedRisks();
  adjustDialogVisible.value = true;
};

const openAdjustDialog = (row) => {
  currentRectifier.value = row;
  resetAdjustForm();
  adjustForm.rectifierId = row.id;
  adjustForm.beforeVoltage = row.output_voltage;
  adjustForm.beforeCurrent = row.output_current;
  loadRelatedRisks();
  adjustDialogVisible.value = true;
};

const viewDetail = (row) => {
  currentRectifier.value = row;
  detailDialogVisible.value = true;
};

const viewAdjustHistory = async (row) => {
  currentRectifier.value = row;
  loadingRectifierHistory.value = true;
  try {
    const res = await getAdjustments({ rectifierId: row.id, pageSize: 20 });
    rectifierHistory.value = res.data || [];
    historyDialogVisible.value = true;
  } catch (err) {
    ElMessage.error('加载调整历史失败');
  } finally {
    loadingRectifierHistory.value = false;
  }
};

const resetAdjustForm = () => {
  Object.assign(adjustForm, {
    rectifierId: null,
    beforeVoltage: null,
    beforeCurrent: null,
    afterVoltage: null,
    afterCurrent: null,
    reason: '',
    riskId: null,
    notes: '',
  });
};

const submitAdjust = async () => {
  try {
    await adjustFormRef.value.validate();
    
    if (!adjustForm.rectifierId && rectifiers.value.length > 0) {
      ElMessage.error('请选择要调整的整流器');
      return;
    }

    submitting.value = true;
    await createAdjustment({
      rectifierId: adjustForm.rectifierId,
      beforeVoltage: adjustForm.beforeVoltage,
      beforeCurrent: adjustForm.beforeCurrent,
      afterVoltage: adjustForm.afterVoltage,
      afterCurrent: adjustForm.afterCurrent,
      reason: adjustForm.reason,
      riskId: adjustForm.riskId,
      notes: adjustForm.notes,
    });
    
    ElMessage.success('调整记录已创建');
    adjustDialogVisible.value = false;
    loadRectifiers();
    loadAdjustmentHistory();
  } catch (err) {
    ElMessage.error(err.response?.data?.error || '提交失败');
  } finally {
    submitting.value = false;
  }
};

onMounted(() => {
  loadRectifiers();
  loadAdjustmentHistory();
});
</script>

<style scoped>
.stat-card {
  margin-bottom: 20px;
}

.stat-content {
  display: flex;
  align-items: center;
}

.stat-icon {
  width: 50px;
  height: 50px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  color: #fff;
  margin-right: 15px;
}

.stat-icon.success {
  background: linear-gradient(135deg, #4caf50, #388e3c);
}

.stat-icon.warning {
  background: linear-gradient(135deg, #ff9800, #f57c00);
}

.stat-icon.info {
  background: linear-gradient(135deg, #2196f3, #1976d2);
}

.stat-info .stat-value {
  font-size: 28px;
  font-weight: bold;
  color: #303133;
}

.stat-info .stat-label {
  font-size: 14px;
  color: #909399;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>
