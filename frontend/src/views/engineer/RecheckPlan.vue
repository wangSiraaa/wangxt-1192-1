<template>
  <div>
    <h2 class="page-title">复测计划管理</h2>
    
    <div class="page-container">
      <el-card class="filter-card">
        <el-form :inline="true" :model="filterForm" @submit.prevent>
          <el-form-item label="状态">
            <el-select v-model="filterForm.status" placeholder="全部" clearable>
              <el-option label="待复测" value="PENDING" />
              <el-option label="已完成" value="COMPLETED" />
              <el-option label="已取消" value="CANCELLED" />
            </el-select>
          </el-form-item>
          <el-form-item label="优先级">
            <el-select v-model="filterForm.priority" placeholder="全部" clearable>
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
            <el-button type="primary" @click="loadPlans">查询</el-button>
            <el-button @click="resetFilter">重置</el-button>
            <el-button type="success" @click="openCreateDialog">
              <el-icon><Plus /></el-icon>
              新建计划
            </el-button>
          </el-form-item>
        </el-form>
      </el-card>

      <el-card class="table-card">
        <template #header>
          <div class="card-header">
            <span>复测计划列表</span>
            <el-tag type="info">共 {{ total }} 条</el-tag>
          </div>
        </template>

        <el-table :data="tableData" v-loading="loading" stripe>
          <el-table-column prop="plan_code" label="计划编号" width="160" />
          <el-table-column label="测点信息" width="220">
            <template #default="{ row }">
              <div class="point-code">{{ row.point?.code }}</div>
              <div class="text-muted">{{ row.point?.name }}</div>
            </template>
          </el-table-column>
          <el-table-column prop="reason" label="复测原因" show-overflow-tooltip />
          <el-table-column label="优先级" width="80">
            <template #default="{ row }">
              <el-tag :type="getPriorityType(row.priority)" size="small">
                {{ getPriorityText(row.priority) }}
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
          <el-table-column prop="deadline" label="截止时间" width="160">
            <template #default="{ row }">
              {{ row.deadline ? formatDate(row.deadline) : '-' }}
            </template>
          </el-table-column>
          <el-table-column label="创建人" width="100">
            <template #default="{ row }">
              {{ row.created_by_user?.name || '-' }}
            </template>
          </el-table-column>
          <el-table-column prop="created_at" label="创建时间" width="160">
            <template #default="{ row }">
              {{ formatDate(row.created_at) }}
            </template>
          </el-table-column>
          <el-table-column label="操作" width="240" fixed="right">
            <template #default="{ row }">
              <el-button 
                v-if="row.status === 'PENDING'" 
                type="primary" 
                size="small" 
                @click="openCompleteDialog(row)"
              >
                完成复测
              </el-button>
              <el-button 
                v-if="row.status === 'PENDING'" 
                size="small" 
                type="danger"
                @click="cancelPlan(row)"
              >
                取消
              </el-button>
              <el-button size="small" @click="viewDetail(row)">详情</el-button>
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

    <el-dialog v-model="createDialogVisible" title="新建复测计划" width="600px" :close-on-click-modal="false">
      <el-form ref="createFormRef" :model="createForm" :rules="createRules" label-width="120px">
        <el-form-item label="测点选择" prop="pointId">
          <el-select v-model="createForm.pointId" placeholder="请选择测点" style="width: 100%;" filterable>
            <el-option
              v-for="point in points"
              :key="point.id"
              :label="`${point.code} - ${point.name}`"
              :value="point.id"
            />
          </el-select>
        </el-form-item>

        <el-form-item label="复测原因" prop="reason">
          <el-input v-model="createForm.reason" type="textarea" :rows="3" placeholder="请输入复测原因" />
        </el-form-item>

        <el-form-item label="优先级" prop="priority">
          <el-radio-group v-model="createForm.priority">
            <el-radio value="HIGH">高</el-radio>
            <el-radio value="MEDIUM">中</el-radio>
            <el-radio value="LOW">低</el-radio>
          </el-radio-group>
        </el-form-item>

        <el-form-item label="截止时间" prop="deadline">
          <el-date-picker
            v-model="createForm.deadline"
            type="datetime"
            placeholder="选择截止时间"
            style="width: 100%;"
            value-format="YYYY-MM-DD HH:mm:ss"
          />
        </el-form-item>

        <el-form-item label="备注">
          <el-input v-model="createForm.notes" type="textarea" :rows="2" placeholder="请输入备注信息" />
        </el-form-item>
      </el-form>
      
      <template #footer>
        <el-button @click="createDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="creating" @click="submitCreate">创建</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="completeDialogVisible" title="完成复测" width="600px" :close-on-click-modal="false">
      <el-form ref="completeFormRef" :model="completeForm" :rules="completeRules" label-width="120px">
        <div v-if="currentPlan" class="plan-info">
          <el-alert :title="`测点: ${currentPlan.point?.code} - ${currentPlan.point?.name}`" type="info" :closable="false" />
        </div>

        <el-form-item label="复测时间" prop="recheckTime">
          <el-date-picker
            v-model="completeForm.recheckTime"
            type="datetime"
            placeholder="选择复测时间"
            style="width: 100%;"
            value-format="YYYY-MM-DD HH:mm:ss"
          />
        </el-form-item>

        <el-form-item label="经度坐标" prop="longitude">
          <el-input-number
            v-model="completeForm.longitude"
            :precision="6"
            :step="0.000001"
            placeholder="请输入经度"
            style="width: 100%;"
          />
        </el-form-item>

        <el-form-item label="纬度坐标" prop="latitude">
          <el-input-number
            v-model="completeForm.latitude"
            :precision="6"
            :step="0.000001"
            placeholder="请输入纬度"
            style="width: 100%;"
          />
        </el-form-item>

        <el-form-item label="复测电位(V)" prop="protectionPotential">
          <el-input-number
            v-model="completeForm.protectionPotential"
            :precision="4"
            :step="0.0001"
            placeholder="请输入保护电位"
            style="width: 100%;"
          />
        </el-form-item>

        <el-form-item label="土壤电阻率(Ω·m)">
          <el-input-number
            v-model="completeForm.soilResistivity"
            :precision="2"
            :step="0.1"
            placeholder="请输入土壤电阻率"
            style="width: 100%;"
          />
        </el-form-item>

        <el-form-item label="复测结论" prop="result">
          <el-radio-group v-model="completeForm.result">
            <el-radio value="NORMAL">已恢复正常</el-radio>
            <el-radio value="STILL_ABNORMAL">仍异常</el-radio>
          </el-radio-group>
        </el-form-item>

        <el-form-item label="处理说明" prop="notes">
          <el-input v-model="completeForm.notes" type="textarea" :rows="3" placeholder="请输入处理说明" />
        </el-form-item>
      </el-form>
      
      <template #footer>
        <el-button @click="completeDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="completing" @click="submitComplete">提交</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="detailDialogVisible" title="复测计划详情" width="700px">
      <el-descriptions :column="2" border v-if="currentPlan">
        <el-descriptions-item label="计划编号">{{ currentPlan.plan_code }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="getStatusType(currentPlan.status)">
            {{ getStatusText(currentPlan.status) }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="测点">{{ currentPlan.point?.code }} - {{ currentPlan.point?.name }}</el-descriptions-item>
        <el-descriptions-item label="优先级">{{ getPriorityText(currentPlan.priority) }}</el-descriptions-item>
        <el-descriptions-item label="复测原因" :span="2">{{ currentPlan.reason }}</el-descriptions-item>
        <el-descriptions-item label="截止时间">{{ formatDate(currentPlan.deadline) }}</el-descriptions-item>
        <el-descriptions-item label="创建时间">{{ formatDate(currentPlan.created_at) }}</el-descriptions-item>
        <el-descriptions-item label="创建人">{{ currentPlan.created_by_user?.name || '-' }}</el-descriptions-item>
        <el-descriptions-item label="备注" :span="2">{{ currentPlan.notes || '-' }}</el-descriptions-item>
        <template v-if="currentPlan.status === 'COMPLETED'">
          <el-descriptions-item label="复测时间">{{ formatDate(currentPlan.recheck_time) }}</el-descriptions-item>
          <el-descriptions-item label="复测电位">{{ currentPlan.recheck_protection_potential }}V</el-descriptions-item>
          <el-descriptions-item label="复测坐标">
            {{ currentPlan.recheck_longitude }}, {{ currentPlan.recheck_latitude }}
          </el-descriptions-item>
          <el-descriptions-item label="土壤电阻率">{{ currentPlan.recheck_soil_resistivity || '-' }}Ω·m</el-descriptions-item>
          <el-descriptions-item label="复测结论" :span="2">
            {{ currentPlan.result === 'NORMAL' ? '已恢复正常' : '仍异常' }}
          </el-descriptions-item>
          <el-descriptions-item label="处理说明" :span="2">{{ currentPlan.notes || '-' }}</el-descriptions-item>
        </template>
      </el-descriptions>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus } from '@element-plus/icons-vue';
import { getPoints } from '../../api/measurement';
import { getRecheckPlans, createRecheckPlan, completeRecheckPlan } from '../../api/recheck';

const loading = ref(false);
const creating = ref(false);
const completing = ref(false);
const tableData = ref([]);
const total = ref(0);
const createDialogVisible = ref(false);
const completeDialogVisible = ref(false);
const detailDialogVisible = ref(false);
const createFormRef = ref();
const completeFormRef = ref();
const currentPlan = ref(null);
const points = ref([]);

const filterForm = reactive({
  status: '',
  priority: '',
  dateRange: [],
});

const pagination = reactive({
  page: 1,
  pageSize: 10,
});

const createForm = reactive({
  pointId: null,
  reason: '',
  priority: 'MEDIUM',
  deadline: null,
  notes: '',
});

const completeForm = reactive({
  recheckTime: new Date(),
  longitude: null,
  latitude: null,
  protectionPotential: null,
  soilResistivity: null,
  result: 'NORMAL',
  notes: '',
});

const createRules = {
  pointId: [{ required: true, message: '请选择测点', trigger: 'change' }],
  reason: [{ required: true, message: '请输入复测原因', trigger: 'blur' }],
  priority: [{ required: true, message: '请选择优先级', trigger: 'change' }],
  deadline: [{ required: true, message: '请选择截止时间', trigger: 'change' }],
};

const completeRules = {
  recheckTime: [{ required: true, message: '请选择复测时间', trigger: 'change' }],
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
  result: [{ required: true, message: '请选择复测结论', trigger: 'change' }],
  notes: [{ required: true, message: '请输入处理说明', trigger: 'blur' }],
};

const formatDate = (date) => {
  if (!date) return '-';
  return new Date(date).toLocaleString('zh-CN');
};

const getPriorityType = (priority) => {
  const map = { HIGH: 'danger', MEDIUM: 'warning', LOW: 'info' };
  return map[priority] || 'info';
};

const getPriorityText = (priority) => {
  const map = { HIGH: '高', MEDIUM: '中', LOW: '低' };
  return map[priority] || priority;
};

const getStatusType = (status) => {
  const map = { PENDING: 'warning', COMPLETED: 'success', CANCELLED: 'info' };
  return map[status] || 'info';
};

const getStatusText = (status) => {
  const map = { PENDING: '待复测', COMPLETED: '已完成', CANCELLED: '已取消' };
  return map[status] || status;
};

const loadPlans = async () => {
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
    
    const res = await getRecheckPlans(params);
    tableData.value = res.data || [];
    total.value = res.total || 0;
  } catch (err) {
    ElMessage.error('加载复测计划失败');
  } finally {
    loading.value = false;
  }
};

const resetFilter = () => {
  filterForm.status = '';
  filterForm.priority = '';
  filterForm.dateRange = [];
  pagination.page = 1;
  loadPlans();
};

const handleSizeChange = (size) => {
  pagination.pageSize = size;
  pagination.page = 1;
  loadPlans();
};

const handlePageChange = (page) => {
  pagination.page = page;
  loadPlans();
};

const openCreateDialog = () => {
  Object.assign(createForm, {
    pointId: null,
    reason: '',
    priority: 'MEDIUM',
    deadline: null,
    notes: '',
  });
  createDialogVisible.value = true;
};

const openCompleteDialog = (row) => {
  currentPlan.value = row;
  Object.assign(completeForm, {
    recheckTime: new Date(),
    longitude: null,
    latitude: null,
    protectionPotential: null,
    soilResistivity: null,
    result: 'NORMAL',
    notes: '',
  });
  completeDialogVisible.value = true;
};

const viewDetail = (row) => {
  currentPlan.value = row;
  detailDialogVisible.value = true;
};

const submitCreate = async () => {
  try {
    await createFormRef.value.validate();
    creating.value = true;
    await createRecheckPlan(createForm);
    ElMessage.success('复测计划创建成功');
    createDialogVisible.value = false;
    loadPlans();
  } catch (err) {
    ElMessage.error(err.response?.data?.error || '创建失败');
  } finally {
    creating.value = false;
  }
};

const submitComplete = async () => {
  try {
    await completeFormRef.value.validate();
    
    const coordValidation = validateCoordinates(completeForm.longitude, completeForm.latitude);
    if (!coordValidation.valid) {
      ElMessage.error(coordValidation.errors.join(', '));
      return;
    }

    completing.value = true;
    await completeRecheckPlan(currentPlan.value.id, completeForm);
    ElMessage.success('复测完成');
    completeDialogVisible.value = false;
    loadPlans();
  } catch (err) {
    ElMessage.error(err.response?.data?.error || '提交失败');
  } finally {
    completing.value = false;
  }
};

const cancelPlan = async (row) => {
  try {
    await ElMessageBox.confirm(
      `确定取消复测计划 ${row.plan_code} 吗？`,
      '取消确认',
      { type: 'warning' }
    );
    ElMessage.success('已取消');
    loadPlans();
  } catch (err) {
    if (err !== 'cancel') {
      ElMessage.error(err.response?.data?.error || '操作失败');
    }
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

onMounted(async () => {
  const res = await getPoints({ status: 'ACTIVE' });
  points.value = res.data || [];
  loadPlans();
});
</script>
