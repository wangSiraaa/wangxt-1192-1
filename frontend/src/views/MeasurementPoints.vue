<template>
  <div>
    <h2 class="page-title">测点管理</h2>
    
    <div class="page-container">
      <el-card class="filter-card">
        <el-form :inline="true" :model="filterForm" @submit.prevent>
          <el-form-item label="管道编号">
            <el-input v-model="filterForm.pipelineCode" placeholder="请输入管道编号" clearable />
          </el-form-item>
          <el-form-item label="测点编号">
            <el-input v-model="filterForm.pointCode" placeholder="请输入测点编号" clearable />
          </el-form-item>
          <el-form-item label="运行状态">
            <el-select v-model="filterForm.status" placeholder="全部" clearable>
              <el-option label="正常运行" value="ACTIVE" />
              <el-option label="维护中" value="MAINTENANCE" />
              <el-option label="已停用" value="INACTIVE" />
            </el-select>
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="loadPoints">查询</el-button>
            <el-button @click="resetFilter">重置</el-button>
            <el-button type="success" @click="openCreateDialog">
              <el-icon><Plus /></el-icon>
              新增测点
            </el-button>
          </el-form-item>
        </el-form>
      </el-card>

      <el-card class="table-card">
        <template #header>
          <div class="card-header">
            <span>测点列表</span>
            <el-tag type="info">共 {{ total }} 条</el-tag>
          </div>
        </template>

        <el-table :data="tableData" v-loading="loading" stripe>
          <el-table-column prop="code" label="测点编号" width="140" />
          <el-table-column prop="name" label="测点名称" width="160" />
          <el-table-column prop="pipeline_code" label="管道编号" width="140" />
          <el-table-column prop="pile_number" label="桩号" width="120" />
          <el-table-column label="坐标位置" width="200">
            <template #default="{ row }">
              <div>经度: {{ row.longitude?.toFixed(6) || '-' }}</div>
              <div>纬度: {{ row.latitude?.toFixed(6) || '-' }}</div>
            </template>
          </el-table-column>
          <el-table-column label="保护电位范围" width="160">
            <template #default="{ row }">
              <div>{{ row.min_potential || '-1.5' }} ~ {{ row.max_potential || '-0.85' }} V</div>
            </template>
          </el-table-column>
          <el-table-column prop="rectifier_code" label="关联整流器" width="140">
            <template #default="{ row }">
              {{ row.rectifier_code || '-' }}
            </template>
          </el-table-column>
          <el-table-column label="运行状态" width="100">
            <template #default="{ row }">
              <el-tag :type="getStatusType(row.status)" size="small">
                {{ getStatusText(row.status) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="created_at" label="创建时间" width="160">
            <template #default="{ row }">
              {{ formatDate(row.created_at) }}
            </template>
          </el-table-column>
          <el-table-column label="操作" width="180" fixed="right">
            <template #default="{ row }">
              <el-button type="primary" size="small" @click="openEditDialog(row)">编辑</el-button>
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

    <el-dialog v-model="pointDialogVisible" :title="dialogTitle" width="700px" :close-on-click-modal="false">
      <el-form ref="pointFormRef" :model="pointForm" :rules="pointRules" label-width="120px">
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="测点编号" prop="code">
              <el-input v-model="pointForm.code" placeholder="请输入测点编号" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="测点名称" prop="name">
              <el-input v-model="pointForm.name" placeholder="请输入测点名称" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="管道编号" prop="pipeline_code">
              <el-input v-model="pointForm.pipeline_code" placeholder="请输入管道编号" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="桩号" prop="pile_number">
              <el-input v-model="pointForm.pile_number" placeholder="请输入桩号" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="经度" prop="longitude">
              <el-input-number 
                v-model="pointForm.longitude" 
                :precision="8" 
                :min="-180" 
                :max="180"
                style="width: 100%;"
                placeholder="请输入经度"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="纬度" prop="latitude">
              <el-input-number 
                v-model="pointForm.latitude" 
                :precision="8" 
                :min="-90" 
                :max="90"
                style="width: 100%;"
                placeholder="请输入纬度"
              />
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="最小保护电位(V)">
              <el-input-number 
                v-model="pointForm.min_potential" 
                :precision="4" 
                :step="0.01"
                style="width: 100%;"
                placeholder="默认-1.5"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="最大保护电位(V)">
              <el-input-number 
                v-model="pointForm.max_potential" 
                :precision="4" 
                :step="0.01"
                style="width: 100%;"
                placeholder="默认-0.85"
              />
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="关联整流器">
              <el-select v-model="pointForm.rectifier_id" placeholder="请选择整流器" style="width: 100%;" filterable clearable>
                <el-option
                  v-for="rectifier in rectifiers"
                  :key="rectifier.id"
                  :label="`${rectifier.code} - ${rectifier.name}`"
                  :value="rectifier.id"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="运行状态" prop="status">
              <el-radio-group v-model="pointForm.status">
                <el-radio value="ACTIVE">正常运行</el-radio>
                <el-radio value="MAINTENANCE">维护中</el-radio>
                <el-radio value="INACTIVE">已停用</el-radio>
              </el-radio-group>
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="备注">
          <el-input v-model="pointForm.remarks" type="textarea" :rows="3" placeholder="请输入备注信息" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="pointDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="savePoint" :loading="submitting">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="detailDialogVisible" title="测点详情" width="600px">
      <el-descriptions :column="2" border v-if="currentPoint">
        <el-descriptions-item label="测点编号">{{ currentPoint.code }}</el-descriptions-item>
        <el-descriptions-item label="测点名称">{{ currentPoint.name }}</el-descriptions-item>
        <el-descriptions-item label="管道编号">{{ currentPoint.pipeline_code || '-' }}</el-descriptions-item>
        <el-descriptions-item label="桩号">{{ currentPoint.pile_number || '-' }}</el-descriptions-item>
        <el-descriptions-item label="经度">{{ currentPoint.longitude?.toFixed(8) || '-' }}</el-descriptions-item>
        <el-descriptions-item label="纬度">{{ currentPoint.latitude?.toFixed(8) || '-' }}</el-descriptions-item>
        <el-descriptions-item label="最小保护电位">{{ currentPoint.min_potential || '-' }} V</el-descriptions-item>
        <el-descriptions-item label="最大保护电位">{{ currentPoint.max_potential || '-' }} V</el-descriptions-item>
        <el-descriptions-item label="关联整流器">{{ currentPoint.rectifier_code || '-' }}</el-descriptions-item>
        <el-descriptions-item label="运行状态">
          <el-tag :type="getStatusType(currentPoint.status)" size="small">
            {{ getStatusText(currentPoint.status) }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="创建时间">{{ formatDate(currentPoint.created_at) }}</el-descriptions-item>
        <el-descriptions-item label="更新时间">{{ formatDate(currentPoint.updated_at) }}</el-descriptions-item>
        <el-descriptions-item label="备注" :span="2">{{ currentPoint.remarks || '-' }}</el-descriptions-item>
      </el-descriptions>
      <template #footer>
        <el-button type="primary" @click="detailDialogVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus } from '@element-plus/icons-vue';
import { getPoints, getPoint, createPoint, updatePoint } from '../api/measurement';
import { getRectifiers } from '../api/rectifier';

const loading = ref(false);
const submitting = ref(false);
const tableData = ref([]);
const total = ref(0);
const currentPoint = ref(null);
const rectifiers = ref([]);

const filterForm = reactive({
  pipelineCode: '',
  pointCode: '',
  status: ''
});

const pagination = reactive({
  page: 1,
  pageSize: 10
});

const pointDialogVisible = ref(false);
const detailDialogVisible = ref(false);
const isEdit = ref(false);
const pointFormRef = ref(null);

const pointForm = reactive({
  id: '',
  code: '',
  name: '',
  pipeline_code: '',
  pile_number: '',
  longitude: null,
  latitude: null,
  min_potential: -1.5,
  max_potential: -0.85,
  rectifier_id: '',
  status: 'ACTIVE',
  remarks: ''
});

const pointRules = {
  code: [{ required: true, message: '请输入测点编号', trigger: 'blur' }],
  name: [{ required: true, message: '请输入测点名称', trigger: 'blur' }],
  longitude: [{ required: true, message: '请输入经度', trigger: 'blur' }],
  latitude: [{ required: true, message: '请输入纬度', trigger: 'blur' }],
  status: [{ required: true, message: '请选择运行状态', trigger: 'change' }]
};

const dialogTitle = computed(() => isEdit.value ? '编辑测点' : '新增测点');

const loadPoints = async () => {
  loading.value = true;
  try {
    const params = {
      page: pagination.page,
      pageSize: pagination.pageSize,
      pipeline_code: filterForm.pipelineCode,
      code: filterForm.pointCode,
      status: filterForm.status
    };
    const result = await getPoints(params);
    tableData.value = result.data || result || [];
    total.value = result.total || tableData.value.length;
  } catch (error) {
    ElMessage.error('加载测点列表失败');
    console.error(error);
  } finally {
    loading.value = false;
  }
};

const loadRectifiers = async () => {
  try {
    const result = await getRectifiers({ pageSize: 1000 });
    rectifiers.value = result.data || result || [];
  } catch (error) {
    console.error('加载整流器列表失败', error);
  }
};

const resetFilter = () => {
  filterForm.pipelineCode = '';
  filterForm.pointCode = '';
  filterForm.status = '';
  pagination.page = 1;
  loadPoints();
};

const handleSizeChange = (size) => {
  pagination.pageSize = size;
  pagination.page = 1;
  loadPoints();
};

const handlePageChange = (page) => {
  pagination.page = page;
  loadPoints();
};

const openCreateDialog = () => {
  isEdit.value = false;
  Object.assign(pointForm, {
    id: '',
    code: '',
    name: '',
    pipeline_code: '',
    pile_number: '',
    longitude: null,
    latitude: null,
    min_potential: -1.5,
    max_potential: -0.85,
    rectifier_id: '',
    status: 'ACTIVE',
    remarks: ''
  });
  pointDialogVisible.value = true;
};

const openEditDialog = async (row) => {
  isEdit.value = true;
  try {
    const result = await getPoint(row.id);
    const data = result.data || result;
    Object.assign(pointForm, {
      id: data.id,
      code: data.code,
      name: data.name,
      pipeline_code: data.pipeline_code || '',
      pile_number: data.pile_number || '',
      longitude: data.longitude,
      latitude: data.latitude,
      min_potential: data.min_potential || -1.5,
      max_potential: data.max_potential || -0.85,
      rectifier_id: data.rectifier_id || '',
      status: data.status || 'ACTIVE',
      remarks: data.remarks || ''
    });
    pointDialogVisible.value = true;
  } catch (error) {
    ElMessage.error('获取测点详情失败');
    console.error(error);
  }
};

const viewDetail = async (row) => {
  try {
    const result = await getPoint(row.id);
    currentPoint.value = result.data || result;
    detailDialogVisible.value = true;
  } catch (error) {
    ElMessage.error('获取测点详情失败');
    console.error(error);
  }
};

const savePoint = async () => {
  if (!pointFormRef.value) return;
  await pointFormRef.value.validate(async (valid) => {
    if (!valid) return;
    submitting.value = true;
    try {
      if (isEdit.value) {
        await updatePoint(pointForm.id, pointForm);
        ElMessage.success('更新测点成功');
      } else {
        await createPoint(pointForm);
        ElMessage.success('新增测点成功');
      }
      pointDialogVisible.value = false;
      loadPoints();
    } catch (error) {
      ElMessage.error(isEdit.value ? '更新测点失败' : '新增测点失败');
      console.error(error);
    } finally {
      submitting.value = false;
    }
  });
};

const getStatusType = (status) => {
  const map = {
    ACTIVE: 'success',
    MAINTENANCE: 'warning',
    INACTIVE: 'danger'
  };
  return map[status] || 'info';
};

const getStatusText = (status) => {
  const map = {
    ACTIVE: '正常运行',
    MAINTENANCE: '维护中',
    INACTIVE: '已停用'
  };
  return map[status] || status;
};

const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}`;
};

onMounted(() => {
  loadPoints();
  loadRectifiers();
});
</script>

<style scoped>
.page-title {
  font-size: 20px;
  font-weight: 600;
  margin: 0 0 16px 0;
  color: #303133;
}

.page-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.filter-card {
  margin-bottom: 0;
}

.table-card {
  margin-top: 0;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.point-code {
  font-weight: 500;
  color: #303133;
}

.text-muted {
  color: #909399;
  font-size: 12px;
}
</style>
