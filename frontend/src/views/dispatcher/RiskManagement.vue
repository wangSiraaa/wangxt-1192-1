<template>
  <div>
    <h2 class="page-title">风险管理</h2>
    
    <div class="page-container">
      <el-row :gutter="20">
        <el-col :span="6">
          <el-card class="stat-card">
            <div class="stat-content">
              <div class="stat-icon danger">
                <el-icon><WarningFilled /></el-icon>
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ riskStats.openHigh }}</div>
                <div class="stat-label">待处理高风险</div>
              </div>
            </div>
          </el-card>
        </el-col>
        <el-col :span="6">
          <el-card class="stat-card">
            <div class="stat-content">
              <div class="stat-icon warning">
                <el-icon><Warning /></el-icon>
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ riskStats.openMedium }}</div>
                <div class="stat-label">待处理中风险</div>
              </div>
            </div>
          </el-card>
        </el-col>
        <el-col :span="6">
          <el-card class="stat-card">
            <div class="stat-content">
              <div class="stat-icon info">
                <el-icon><Clock /></el-icon>
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ riskStats.pendingRecheck }}</div>
                <div class="stat-label">待复测风险</div>
              </div>
            </div>
          </el-card>
        </el-col>
        <el-col :span="6">
          <el-card class="stat-card">
            <div class="stat-content">
              <div class="stat-icon success">
                <el-icon><CircleCheck /></el-icon>
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ riskStats.closedThisWeek }}</div>
                <div class="stat-label">本周已关闭</div>
              </div>
            </div>
          </el-card>
        </el-col>
      </el-row>

      <el-card class="filter-card">
        <el-form :inline="true" :model="filterForm" @submit.prevent>
          <el-form-item label="风险状态">
            <el-select v-model="filterForm.status" placeholder="全部" clearable>
              <el-option label="待处理" value="OPEN" />
              <el-option label="处理中" value="IN_PROGRESS" />
              <el-option label="已关闭" value="CLOSED" />
            </el-select>
          </el-form-item>
          <el-form-item label="风险等级">
            <el-select v-model="filterForm.level" placeholder="全部" clearable>
              <el-option label="高" value="HIGH" />
              <el-option label="中" value="MEDIUM" />
              <el-option label="低" value="LOW" />
            </el-select>
          </el-form-item>
          <el-form-item label="创建时间">
            <el-date-picker
              v-model="filterForm.dateRange"
              type="daterange"
              range-separator="至"
              start-placeholder="开始日期"
              end-placeholder="结束日期"
              value-format="YYYY-MM-DD"
            />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="loadRisks">查询</el-button>
            <el-button @click="resetFilter">重置</el-button>
          </el-form-item>
        </el-form>
      </el-card>

      <el-card class="table-card">
        <template #header>
          <div class="card-header">
            <span>风险记录列表</span>
            <el-tag type="info">共 {{ total }} 条</el-tag>
          </div>
        </template>

        <el-table :data="tableData" v-loading="loading" stripe>
          <el-table-column prop="risk_code" label="风险编号" width="160" />
          <el-table-column label="风险等级" width="80">
            <template #default="{ row }">
              <el-tag :type="getLevelType(row.level)" size="small">
                {{ getLevelText(row.level) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="状态" width="100">
            <template #default="{ row }">
              <el-tag :type="getStatusType(row.status)" size="small">
                {{ getStatusText(row.status) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="description" label="风险描述" show-overflow-tooltip />
          <el-table-column label="关联测点" width="180">
            <template #default="{ row }">
              {{ row.point?.code }} - {{ row.point?.name }}
            </template>
          </el-table-column>
          <el-table-column label="关联整流器" width="160">
            <template #default="{ row }">
              {{ row.rectifier?.code ? row.rectifier.code + ' - ' + row.rectifier.name : '-' }}
            </template>
          </el-table-column>
          <el-table-column label="复测要求" width="100">
            <template #default="{ row }">
              <el-tag :type="row.recheck_required ? 'warning' : 'info'" size="small">
                {{ row.recheck_required ? '需复测' : '无需复测' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="复测状态" width="100">
            <template #default="{ row }">
              <el-tag v-if="row.recheck_required" :type="row.recheck_completed ? 'success' : 'warning'" size="small">
                {{ row.recheck_completed ? '已复测' : '待复测' }}
              </el-tag>
              <span v-else>-</span>
            </template>
          </el-table-column>
          <el-table-column prop="created_at" label="创建时间" width="160">
            <template #default="{ row }">
              {{ formatDate(row.created_at) }}
            </template>
          </el-table-column>
          <el-table-column label="操作" width="280" fixed="right">
            <template #default="{ row }">
              <el-button 
                v-if="row.status === 'OPEN'" 
                type="primary" 
                size="small" 
                @click="processRisk(row)"
              >
                处理
              </el-button>
              <el-button 
                v-if="row.status === 'IN_PROGRESS' && canClose(row)" 
                type="success" 
                size="small" 
                @click="openCloseDialog(row)"
              >
                关闭
              </el-button>
              <el-button 
                v-if="row.status === 'IN_PROGRESS' && !canClose(row)" 
                type="success" 
                size="small" 
                disabled
              >
                关闭
              </el-button>
              <el-button size="small" @click="viewDetail(row)">详情</el-button>
              <el-button size="small" @click="viewHistory(row)">处理记录</el-button>
            </template>
          </el-table-column>
        </el-table>

        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.pageSize"
          :total="total"
          :page-sizes="[10, 20, 50, 100]"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="handleSizeChange"
          @current-change="handlePageChange"
          style="margin-top: 16px; justify-content: flex-end; display: flex;"
        />
      </el-card>
    </div>

    <el-dialog v-model="processDialogVisible" title="处理风险" width="600px" :close-on-click-modal="false">
      <el-form ref="processFormRef" :model="processForm" :rules="processRules" label-width="100px">
        <div v-if="currentRisk" class="risk-info">
          <el-alert :title="`风险: ${currentRisk.risk_code} - ${currentRisk.description}`" type="warning" :closable="false" />
        </div>

        <el-form-item label="处理方案" prop="solution">
          <el-input v-model="processForm.solution" type="textarea" :rows="3" placeholder="请输入处理方案" />
        </el-form-item>

        <el-form-item label="责任人员">
          <el-input v-model="processForm.assignee" placeholder="请输入责任人员" />
        </el-form-item>

        <el-form-item label="计划完成时间">
          <el-date-picker
            v-model="processForm.planTime"
            type="datetime"
            placeholder="选择计划完成时间"
            style="width: 100%;"
            value-format="YYYY-MM-DD HH:mm:ss"
          />
        </el-form-item>

        <el-form-item label="是否安排整流器调整">
          <el-radio-group v-model="processForm.needRectifierAdjust">
            <el-radio :value="true">是</el-radio>
            <el-radio :value="false">否</el-radio>
          </el-radio-group>
        </el-form-item>

        <el-form-item v-if="processForm.needRectifierAdjust" label="整流器">
          <el-select v-model="processForm.rectifierId" placeholder="请选择整流器" style="width: 100%;">
            <el-option
              v-for="rectifier in rectifiers"
              :key="rectifier.id"
              :label="`${rectifier.code} - ${rectifier.name}`"
              :value="rectifier.id"
            />
          </el-select>
        </el-form-item>

        <el-form-item label="是否需要复测">
          <el-radio-group v-model="processForm.recheckRequired">
            <el-radio :value="true">是</el-radio>
            <el-radio :value="false">否</el-radio>
          </el-radio-group>
        </el-form-item>

        <el-form-item v-if="processForm.recheckRequired" label="复测时限">
          <el-date-picker
            v-model="processForm.recheckDeadline"
            type="datetime"
            placeholder="选择复测截止时间"
            style="width: 100%;"
            value-format="YYYY-MM-DD HH:mm:ss"
          />
        </el-form-item>
      </el-form>
      
      <template #footer>
        <el-button @click="processDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="processing" @click="submitProcess">确认处理</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="closeDialogVisible" title="关闭风险" width="500px" :close-on-click-modal="false">
      <el-form ref="closeFormRef" :model="closeForm" :rules="closeRules" label-width="100px">
        <div v-if="currentRisk" class="risk-info">
          <el-alert :title="`风险: ${currentRisk.risk_code}`" type="success" :closable="false" />
          <el-alert 
            v-if="currentRisk.recheck_required && currentRisk.recheck_completed" 
            title="已完成复测，可正常关闭" 
            type="success" 
            :closable="false"
            style="margin-top: 8px;"
          />
        </div>
        <el-form-item label="关闭原因" prop="closeReason">
          <el-input v-model="closeForm.closeReason" type="textarea" :rows="3" placeholder="请输入关闭原因" />
        </el-form-item>
      </el-form>
      
      <template #footer>
        <el-button @click="closeDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="closing" @click="submitClose">确认关闭</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="detailDialogVisible" title="风险详情" width="700px">
      <el-descriptions :column="2" border v-if="currentRisk">
        <el-descriptions-item label="风险编号">{{ currentRisk.risk_code }}</el-descriptions-item>
        <el-descriptions-item label="风险等级">
          <el-tag :type="getLevelType(currentRisk.level)">
            {{ getLevelText(currentRisk.level) }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="getStatusType(currentRisk.status)">
            {{ getStatusText(currentRisk.status) }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="创建时间">{{ formatDate(currentRisk.created_at) }}</el-descriptions-item>
        <el-descriptions-item label="风险描述" :span="2">{{ currentRisk.description }}</el-descriptions-item>
        <el-descriptions-item label="关联测点">{{ currentRisk.point?.code }} - {{ currentRisk.point?.name }}</el-descriptions-item>
        <el-descriptions-item label="关联整流器">
          {{ currentRisk.rectifier?.code ? currentRisk.rectifier.code + ' - ' + currentRisk.rectifier.name : '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="复测要求">
          {{ currentRisk.recheck_required ? '需要' : '不需要' }}
        </el-descriptions-item>
        <el-descriptions-item label="复测状态">
          {{ currentRisk.recheck_required ? (currentRisk.recheck_completed ? '已完成' : '待复测') : '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="处理方案" v-if="currentRisk.solution" :span="2">
          {{ currentRisk.solution }}
        </el-descriptions-item>
        <el-descriptions-item label="关闭原因" v-if="currentRisk.status === 'CLOSED'" :span="2">
          {{ currentRisk.close_reason }}
        </el-descriptions-item>
      </el-descriptions>
    </el-dialog>

    <el-dialog v-model="historyDialogVisible" title="风险处理记录" width="700px">
      <el-timeline>
        <el-timeline-item
          v-for="(item, index) in riskHistory"
          :key="index"
          :timestamp="formatDate(item.created_at)"
          :type="getHistoryType(item.action)"
        >
          <h4>{{ item.action_text }}</h4>
          <p>{{ item.description || '-' }}</p>
          <p class="text-muted">操作人: {{ item.operator?.name || '系统' }}</p>
        </el-timeline-item>
      </el-timeline>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { WarningFilled, Warning, Clock, CircleCheck } from '@element-plus/icons-vue';
import { getRisks, closeRisk } from '../../api/risk';
import { getRectifiers } from '../../api/rectifier';

const loading = ref(false);
const processing = ref(false);
const closing = ref(false);
const tableData = ref([]);
const total = ref(0);
const processDialogVisible = ref(false);
const closeDialogVisible = ref(false);
const detailDialogVisible = ref(false);
const historyDialogVisible = ref(false);
const processFormRef = ref();
const closeFormRef = ref();
const currentRisk = ref(null);
const rectifiers = ref([]);
const riskHistory = ref([]);

const riskStats = reactive({
  openHigh: 0,
  openMedium: 0,
  pendingRecheck: 0,
  closedThisWeek: 0,
});

const filterForm = reactive({
  status: '',
  level: '',
  dateRange: [],
});

const pagination = reactive({
  page: 1,
  pageSize: 10,
});

const processForm = reactive({
  solution: '',
  assignee: '',
  planTime: null,
  needRectifierAdjust: false,
  rectifierId: null,
  recheckRequired: true,
  recheckDeadline: null,
});

const closeForm = reactive({
  closeReason: '',
});

const processRules = {
  solution: [{ required: true, message: '请输入处理方案', trigger: 'blur' }],
};

const closeRules = {
  closeReason: [{ required: true, message: '请输入关闭原因', trigger: 'blur' }],
};

const canClose = (row) => {
  if (!row.recheck_required) return true;
  return row.recheck_completed;
};

const formatDate = (date) => {
  if (!date) return '-';
  return new Date(date).toLocaleString('zh-CN');
};

const getLevelType = (level) => {
  const map = { HIGH: 'danger', MEDIUM: 'warning', LOW: 'info' };
  return map[level] || 'info';
};

const getLevelText = (level) => {
  const map = { HIGH: '高', MEDIUM: '中', LOW: '低' };
  return map[level] || level;
};

const getStatusType = (status) => {
  const map = { OPEN: 'danger', IN_PROGRESS: 'warning', CLOSED: 'success' };
  return map[status] || 'info';
};

const getStatusText = (status) => {
  const map = { OPEN: '待处理', IN_PROGRESS: '处理中', CLOSED: '已关闭' };
  return map[status] || status;
};

const getHistoryType = (action) => {
  const map = { CREATE: 'danger', UPDATE: 'warning', CLOSE: 'success' };
  return map[action] || 'primary';
};

const loadRisks = async () => {
  loading.value = true;
  try {
    const params = {
      ...filterForm,
      page: pagination.page,
      pageSize: pagination.pageSize,
    };
    if (filterForm.dateRange && filterForm.dateRange.length === 2) {
      params.startDate = filterForm.dateRange[0];
      params.endDate = filterForm.dateRange[1];
    }
    delete params.dateRange;
    
    Object.keys(params).forEach(key => {
      if (params[key] === '' || params[key] === null || params[key] === undefined) {
        delete params[key];
      }
    });
    
    const res = await getRisks(params);
    tableData.value = res.data || [];
    total.value = res.total || 0;
    
    riskStats.openHigh = tableData.value.filter(r => r.status === 'OPEN' && r.level === 'HIGH').length;
    riskStats.openMedium = tableData.value.filter(r => r.status === 'OPEN' && r.level === 'MEDIUM').length;
    riskStats.pendingRecheck = tableData.value.filter(r => r.recheck_required && !r.recheck_completed && r.status !== 'CLOSED').length;
  } catch (err) {
    ElMessage.error('加载风险记录失败');
  } finally {
    loading.value = false;
  }
};

const loadRectifiers = async () => {
  try {
    const res = await getRectifiers({ status: 'RUNNING' });
    rectifiers.value = res.data || [];
  } catch (err) {
    console.error('加载整流器列表失败', err);
  }
};

const resetFilter = () => {
  filterForm.status = '';
  filterForm.level = '';
  filterForm.dateRange = [];
  pagination.page = 1;
  loadRisks();
};

const handleSizeChange = (size) => {
  pagination.pageSize = size;
  pagination.page = 1;
  loadRisks();
};

const handlePageChange = (page) => {
  pagination.page = page;
  loadRisks();
};

const processRisk = (row) => {
  currentRisk.value = row;
  Object.assign(processForm, {
    solution: '',
    assignee: '',
    planTime: null,
    needRectifierAdjust: false,
    rectifierId: null,
    recheckRequired: true,
    recheckDeadline: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' '),
  });
  loadRectifiers();
  processDialogVisible.value = true;
};

const openCloseDialog = async (row) => {
  try {
    const closeCheck = await canCloseRisk(row.id);
    if (!closeCheck.valid) {
      ElMessage.error(closeCheck.errors.join(', '));
      return;
    }
  } catch (err) {
    console.error('校验风险关闭条件失败', err);
  }
  
  currentRisk.value = row;
  closeForm.closeReason = '';
  closeDialogVisible.value = true;
};

const canCloseRisk = async (riskId) => {
  try {
    const risk = tableData.value.find(r => r.id === riskId) || currentRisk.value;
    if (risk && risk.recheck_required && !risk.recheck_completed) {
      return { valid: false, errors: ['整流器调整后未完成复测，不能关闭风险'] };
    }
    return { valid: true, errors: [] };
  } catch (err) {
    return { valid: true, errors: [] };
  }
};

const viewDetail = (row) => {
  currentRisk.value = row;
  detailDialogVisible.value = true;
};

const viewHistory = (row) => {
  currentRisk.value = row;
  riskHistory.value = [
    { action: 'CREATE', action_text: '风险创建', description: row.description, created_at: row.created_at, operator: row.created_by },
    ...(row.status !== 'OPEN' ? [{
      action: 'UPDATE',
      action_text: '风险处理',
      description: row.solution,
      created_at: row.updated_at,
      operator: row.updated_by
    }] : []),
    ...(row.status === 'CLOSED' ? [{
      action: 'CLOSE',
      action_text: '风险关闭',
      description: row.close_reason,
      created_at: row.closed_at,
      operator: row.closed_by
    }] : [])
  ];
  historyDialogVisible.value = true;
};

const submitProcess = async () => {
  try {
    await processFormRef.value.validate();
    processing.value = true;
    ElMessage.success('处理方案已提交');
    processDialogVisible.value = false;
    loadRisks();
  } catch (err) {
    ElMessage.error(err.response?.data?.error || '提交失败');
  } finally {
    processing.value = false;
  }
};

const submitClose = async () => {
  try {
    await closeFormRef.value.validate();
    
    const closeCheck = await canCloseRisk(currentRisk.value.id);
    if (!closeCheck.valid) {
      ElMessage.error(closeCheck.errors.join(', '));
      return;
    }

    closing.value = true;
    await closeRisk(currentRisk.value.id, {
      closeReason: closeForm.closeReason,
    });
    
    ElMessage.success('风险已关闭');
    closeDialogVisible.value = false;
    loadRisks();
  } catch (err) {
    ElMessage.error(err.response?.data?.error || '关闭失败');
  } finally {
    closing.value = false;
  }
};

onMounted(() => {
  loadRisks();
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

.stat-icon.danger {
  background: linear-gradient(135deg, #f44336, #d32f2f);
}

.stat-icon.warning {
  background: linear-gradient(135deg, #ff9800, #f57c00);
}

.stat-icon.info {
  background: linear-gradient(135deg, #2196f3, #1976d2);
}

.stat-icon.success {
  background: linear-gradient(135deg, #4caf50, #388e3c);
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

.text-muted {
  font-size: 12px;
  color: #909399;
}
</style>
