<template>
  <div>
    <h2 class="page-title">测量记录</h2>
    
    <div class="page-container">
      <el-card class="filter-card">
        <el-form :inline="true" :model="filterForm" @submit.prevent>
          <el-form-item label="测点编号">
            <el-select v-model="filterForm.pointId" placeholder="全部测点" style="width: 200px;" filterable clearable>
              <el-option
                v-for="point in points"
                :key="point.id"
                :label="`${point.code} - ${point.name}`"
                :value="point.id"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="是否异常">
            <el-select v-model="filterForm.isAbnormal" placeholder="全部" clearable>
              <el-option label="正常" :value="false" />
              <el-option label="异常" :value="true" />
            </el-select>
          </el-form-item>
          <el-form-item label="测量时间">
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
            <el-button type="primary" @click="loadRecords">查询</el-button>
            <el-button @click="resetFilter">重置</el-button>
            <el-button type="success" @click="exportRecords">
              <el-icon><Download /></el-icon>
              导出
            </el-button>
          </el-form-item>
        </el-form>
      </el-card>

      <el-row :gutter="16" style="margin-bottom: 16px;">
        <el-col :span="6">
          <el-card class="stat-card">
            <div class="stat-content">
              <div class="stat-icon stat-icon-total">
                <el-icon><DataLine /></el-icon>
              </div>
              <div class="stat-info">
                <div class="stat-label">总记录数</div>
                <div class="stat-value">{{ stats.total }}</div>
              </div>
            </div>
          </el-card>
        </el-col>
        <el-col :span="6">
          <el-card class="stat-card">
            <div class="stat-content">
              <div class="stat-icon stat-icon-normal">
                <el-icon><CircleCheck /></el-icon>
              </div>
              <div class="stat-info">
                <div class="stat-label">正常记录</div>
                <div class="stat-value">{{ stats.normal }}</div>
              </div>
            </div>
          </el-card>
        </el-col>
        <el-col :span="6">
          <el-card class="stat-card">
            <div class="stat-content">
              <div class="stat-icon stat-icon-abnormal">
                <el-icon><Warning /></el-icon>
              </div>
              <div class="stat-info">
                <div class="stat-label">异常记录</div>
                <div class="stat-value">{{ stats.abnormal }}</div>
              </div>
            </div>
          </el-card>
        </el-col>
        <el-col :span="6">
          <el-card class="stat-card">
            <div class="stat-content">
              <div class="stat-icon stat-icon-today">
                <el-icon><Calendar /></el-icon>
              </div>
              <div class="stat-info">
                <div class="stat-label">今日采集</div>
                <div class="stat-value">{{ stats.today }}</div>
              </div>
            </div>
          </el-card>
        </el-col>
      </el-row>

      <el-card class="table-card">
        <template #header>
          <div class="card-header">
            <span>测量记录列表</span>
            <el-tag type="info">共 {{ total }} 条</el-tag>
          </div>
        </template>

        <el-table :data="tableData" v-loading="loading" stripe>
          <el-table-column prop="measurement_time" label="测量时间" width="160">
            <template #default="{ row }">
              {{ formatDate(row.measurement_time) }}
            </template>
          </el-table-column>
          <el-table-column label="测点信息" width="200">
            <template #default="{ row }">
              <div class="point-code">{{ row.point?.code || '-' }}</div>
              <div class="text-muted">{{ row.point?.name || '-' }}</div>
            </template>
          </el-table-column>
          <el-table-column label="坐标位置" width="200">
            <template #default="{ row }">
              <div>经度: {{ row.longitude?.toFixed(6) || '-' }}</div>
              <div>纬度: {{ row.latitude?.toFixed(6) || '-' }}</div>
            </template>
          </el-table-column>
          <el-table-column label="保护电位(V)" width="120">
            <template #default="{ row }">
              <span :class="{ 'text-danger': row.is_abnormal }">
                {{ row.protection_potential?.toFixed(4) || '-' }}
              </span>
            </template>
          </el-table-column>
          <el-table-column prop="soil_resistivity" label="土壤电阻率(Ω·m)" width="140">
            <template #default="{ row }">
              {{ row.soil_resistivity?.toFixed(2) || '-' }}
            </template>
          </el-table-column>
          <el-table-column prop="natural_potential" label="自然电位(V)" width="120">
            <template #default="{ row }">
              {{ row.natural_potential?.toFixed(4) || '-' }}
            </template>
          </el-table-column>
          <el-table-column prop="temperature" label="温度(℃)" width="100">
            <template #default="{ row }">
              {{ row.temperature || '-' }}
            </template>
          </el-table-column>
          <el-table-column label="天气" width="80">
            <template #default="{ row }">
              {{ getWeatherText(row.weather) }}
            </template>
          </el-table-column>
          <el-table-column label="状态" width="80">
            <template #default="{ row }">
              <el-tag :type="row.is_abnormal ? 'danger' : 'success'" size="small">
                {{ row.is_abnormal ? '异常' : '正常' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="采集人" width="100">
            <template #default="{ row }">
              {{ row.created_by_user?.name || '-' }}
            </template>
          </el-table-column>
          <el-table-column label="操作" width="100" fixed="right">
            <template #default="{ row }">
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

    <el-dialog v-model="detailDialogVisible" title="测量记录详情" width="700px">
      <el-descriptions :column="2" border v-if="currentRecord">
        <el-descriptions-item label="测量时间" :span="2">
          {{ formatDate(currentRecord.measurement_time) }}
        </el-descriptions-item>
        <el-descriptions-item label="测点编号">
          {{ currentRecord.point?.code || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="测点名称">
          {{ currentRecord.point?.name || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="经度">
          {{ currentRecord.longitude?.toFixed(8) || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="纬度">
          {{ currentRecord.latitude?.toFixed(8) || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="保护电位(V)">
          <span :class="{ 'text-danger': currentRecord.is_abnormal }">
            {{ currentRecord.protection_potential?.toFixed(4) || '-' }}
          </span>
        </el-descriptions-item>
        <el-descriptions-item label="土壤电阻率(Ω·m)">
          {{ currentRecord.soil_resistivity?.toFixed(2) || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="自然电位(V)">
          {{ currentRecord.natural_potential?.toFixed(4) || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="温度(℃)">
          {{ currentRecord.temperature || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="天气">
          {{ getWeatherText(currentRecord.weather) }}
        </el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="currentRecord.is_abnormal ? 'danger' : 'success'" size="small">
            {{ currentRecord.is_abnormal ? '异常' : '正常' }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="采集人">
          {{ currentRecord.created_by_user?.name || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="管道编号">
          {{ currentRecord.point?.pipeline_code || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="桩号">
          {{ currentRecord.point?.pile_number || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="保护范围">
          {{ currentRecord.point?.min_potential || '-1.5' }} ~ 
          {{ currentRecord.point?.max_potential || '-0.85' }} V
        </el-descriptions-item>
        <el-descriptions-item label="备注" :span="2">
          {{ currentRecord.remarks || '-' }}
        </el-descriptions-item>
      </el-descriptions>
      <template #footer>
        <el-button type="primary" @click="detailDialogVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue';
import { ElMessage } from 'element-plus';
import { Download, DataLine, CircleCheck, Warning, Calendar } from '@element-plus/icons-vue';
import { getRecords, getRecord, getPoints } from '../api/measurement';

const loading = ref(false);
const tableData = ref([]);
const total = ref(0);
const currentRecord = ref(null);
const points = ref([]);

const stats = reactive({
  total: 0,
  normal: 0,
  abnormal: 0,
  today: 0
});

const filterForm = reactive({
  pointId: '',
  isAbnormal: '',
  dateRange: []
});

const pagination = reactive({
  page: 1,
  pageSize: 10
});

const detailDialogVisible = ref(false);

const abnormalRatio = computed(() => {
  if (stats.total === 0) return '0%';
  return ((stats.abnormal / stats.total) * 100).toFixed(1) + '%';
});

const loadRecords = async () => {
  loading.value = true;
  try {
    const params = {
      page: pagination.page,
      pageSize: pagination.pageSize,
      point_id: filterForm.pointId,
      is_abnormal: filterForm.isAbnormal === '' ? undefined : filterForm.isAbnormal
    };
    if (filterForm.dateRange && filterForm.dateRange.length === 2) {
      params.start_date = filterForm.dateRange[0];
      params.end_date = filterForm.dateRange[1];
    }
    const result = await getRecords(params);
    tableData.value = result.data || result || [];
    total.value = result.total || tableData.value.length;
    calculateStats();
  } catch (error) {
    ElMessage.error('加载测量记录失败');
    console.error(error);
  } finally {
    loading.value = false;
  }
};

const loadPoints = async () => {
  try {
    const result = await getPoints({ pageSize: 1000 });
    points.value = result.data || result || [];
  } catch (error) {
    console.error('加载测点列表失败', error);
  }
};

const calculateStats = () => {
  stats.total = total.value;
  stats.abnormal = tableData.value.filter(r => r.is_abnormal).length;
  stats.normal = tableData.value.filter(r => !r.is_abnormal).length;
  
  const today = new Date().toDateString();
  stats.today = tableData.value.filter(r => {
    if (!r.measurement_time) return false;
    return new Date(r.measurement_time).toDateString() === today;
  }).length;
};

const resetFilter = () => {
  filterForm.pointId = '';
  filterForm.isAbnormal = '';
  filterForm.dateRange = [];
  pagination.page = 1;
  loadRecords();
};

const handleSizeChange = (size) => {
  pagination.pageSize = size;
  pagination.page = 1;
  loadRecords();
};

const handlePageChange = (page) => {
  pagination.page = page;
  loadRecords();
};

const viewDetail = async (row) => {
  try {
    const result = await getRecord(row.id);
    currentRecord.value = result.data || result;
    detailDialogVisible.value = true;
  } catch (error) {
    ElMessage.error('获取记录详情失败');
    console.error(error);
  }
};

const exportRecords = () => {
  ElMessage.info('导出功能开发中...');
};

const getWeatherText = (weather) => {
  const map = {
    SUNNY: '晴天',
    CLOUDY: '多云',
    RAINY: '雨天',
    SNOWY: '雪天',
    WINDY: '大风',
    FOGGY: '雾霾'
  };
  return map[weather] || weather || '-';
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
  loadRecords();
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

.stat-card {
  padding: 0;
}

.stat-content {
  display: flex;
  align-items: center;
  gap: 16px;
}

.stat-icon {
  width: 56px;
  height: 56px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  color: #fff;
}

.stat-icon-total {
  background: linear-gradient(135deg, #409EFF 0%, #66b1ff 100%);
}

.stat-icon-normal {
  background: linear-gradient(135deg, #67C23A 0%, #85ce61 100%);
}

.stat-icon-abnormal {
  background: linear-gradient(135deg, #F56C6C 0%, #f78989 100%);
}

.stat-icon-today {
  background: linear-gradient(135deg, #E6A23C 0%, #ebb563 100%);
}

.stat-info {
  flex: 1;
}

.stat-label {
  font-size: 14px;
  color: #909399;
  margin-bottom: 4px;
}

.stat-value {
  font-size: 24px;
  font-weight: 600;
  color: #303133;
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

.text-danger {
  color: #F56C6C;
  font-weight: 500;
}
</style>
