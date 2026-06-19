<template>
  <div>
    <h2 class="page-title">异常分析</h2>
    
    <div class="page-container">
      <el-row :gutter="20">
        <el-col :span="6">
          <el-card class="stat-card">
            <div class="stat-content">
              <div class="stat-icon warning">
                <el-icon><Warning /></el-icon>
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ abnormalStats.totalAbnormal }}</div>
                <div class="stat-label">异常记录</div>
              </div>
            </div>
          </el-card>
        </el-col>
        <el-col :span="6">
          <el-card class="stat-card">
            <div class="stat-content">
              <div class="stat-icon danger">
                <el-icon><TrendCharts /></el-icon>
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ abnormalStats.consecutiveAbnormal }}</div>
                <div class="stat-label">连续异常测点</div>
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
                <div class="stat-value">{{ abnormalStats.pendingRecheck }}</div>
                <div class="stat-label">待复测</div>
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
                <div class="stat-value">{{ abnormalStats.resolvedToday }}</div>
                <div class="stat-label">今日已处理</div>
              </div>
            </div>
          </el-card>
        </el-col>
      </el-row>

      <el-card class="chart-card">
        <template #header>
          <div class="card-header">
            <span>电位趋势分析</span>
            <el-select v-model="selectedPointId" placeholder="选择测点" style="width: 200px;" @change="loadPotentialTrend">
              <el-option
                v-for="point in points"
                :key="point.id"
                :label="`${point.code} - ${point.name}`"
                :value="point.id"
              />
            </el-select>
          </div>
        </template>
        <div ref="chartRef" style="height: 350px;"></div>
      </el-card>

      <el-card class="table-card">
        <template #header>
          <div class="card-header">
            <span>异常测点列表</span>
            <el-radio-group v-model="filterType" size="default" @change="loadAbnormalPoints">
              <el-radio-button value="all">全部</el-radio-button>
              <el-radio-button value="consecutive">连续异常</el-radio-button>
              <el-radio-button value="pending">待处理</el-radio-button>
            </el-radio-group>
          </div>
        </template>

        <el-table :data="abnormalPoints" v-loading="loading" stripe>
          <el-table-column label="测点信息" width="220">
            <template #default="{ row }">
              <div class="point-code">{{ row.code }}</div>
              <div class="text-muted">{{ row.name }}</div>
            </template>
          </el-table-column>
          <el-table-column label="管道位置" prop="pipeline_location" show-overflow-tooltip />
          <el-table-column label="当前电位(V)" width="120">
            <template #default="{ row }">
              <span :class="{ 'text-danger': row.latest_potential < row.min_protection_potential }">
                {{ row.latest_potential }}
              </span>
            </template>
          </el-table-column>
          <el-table-column label="保护范围(V)" width="140">
            <template #default="{ row }">
              {{ row.min_protection_potential }} ~ {{ row.max_protection_potential }}
            </template>
          </el-table-column>
          <el-table-column label="连续异常次数" width="120">
            <template #default="{ row }">
              <el-tag v-if="row.consecutive_abnormal_count >= 3" type="danger" size="small">
                {{ row.consecutive_abnormal_count }} 次
              </el-tag>
              <el-tag v-else-if="row.consecutive_abnormal_count >= 2" type="warning" size="small">
                {{ row.consecutive_abnormal_count }} 次
              </el-tag>
              <span v-else>{{ row.consecutive_abnormal_count || 0 }} 次</span>
            </template>
          </el-table-column>
          <el-table-column label="土壤电阻率(Ω·m)" width="140" prop="latest_soil_resistivity" />
          <el-table-column label="最近测量时间" width="160">
            <template #default="{ row }">
              {{ row.latest_measure_time ? formatDate(row.latest_measure_time) : '-' }}
            </template>
          </el-table-column>
          <el-table-column label="状态" width="100">
            <template #default="{ row }">
              <el-tag :type="row.consecutive_abnormal_count >= 3 ? 'danger' : 'warning'" size="small">
                {{ row.consecutive_abnormal_count >= 3 ? '高风险' : '异常' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="200" fixed="right">
            <template #default="{ row }">
              <el-button type="primary" size="small" @click="viewPointDetail(row)">详情</el-button>
              <el-button size="small" @click="generateRecheckPlan(row)">生成复测</el-button>
              <el-button v-if="row.rectifier_id" size="small" @click="viewRectifier(row.rectifier_id)">
                关联整流器
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-card>

      <el-card class="table-card">
        <template #header>
          <span>最近异常记录</span>
        </template>
        <el-table :data="recentAbnormalRecords" v-loading="loadingRecords" size="small" stripe>
          <el-table-column label="测点" width="140">
            <template #default="{ row }">
              {{ row.point?.code }} - {{ row.point?.name }}
            </template>
          </el-table-column>
          <el-table-column label="保护电位(V)" prop="protection_potential" width="120" />
          <el-table-column label="保护范围(V)" width="140">
            <template #default="{ row }">
              {{ row.point?.min_protection_potential }} ~ {{ row.point?.max_protection_potential }}
            </template>
          </el-table-column>
          <el-table-column label="土壤电阻率(Ω·m)" prop="soil_resistivity" width="140" />
          <el-table-column label="温度(℃)" prop="temperature" width="100" />
          <el-table-column label="天气" prop="weather" width="80" />
          <el-table-column label="测量时间" width="160">
            <template #default="{ row }">
              {{ formatDate(row.measure_time) }}
            </template>
          </el-table-column>
          <el-table-column label="异常判定" width="100">
            <template #default="{ row }">
              <el-tag type="danger" size="small">
                {{ row.protection_potential < (row.point?.min_protection_potential || -1.5) ? '欠保护' : '过保护' }}
              </el-tag>
            </template>
          </el-table-column>
        </el-table>
      </el-card>
    </div>

    <el-dialog v-model="detailDialogVisible" title="测点详情" width="700px">
      <el-descriptions :column="2" border v-if="selectedPoint">
        <el-descriptions-item label="测点编号">{{ selectedPoint.code }}</el-descriptions-item>
        <el-descriptions-item label="测点名称">{{ selectedPoint.name }}</el-descriptions-item>
        <el-descriptions-item label="管道位置" :span="2">{{ selectedPoint.pipeline_location }}</el-descriptions-item>
        <el-descriptions-item label="基准坐标">
          {{ selectedPoint.longitude }}, {{ selectedPoint.latitude }}
        </el-descriptions-item>
        <el-descriptions-item label="保护范围(V)">
          {{ selectedPoint.min_protection_potential }} ~ {{ selectedPoint.max_protection_potential }}
        </el-descriptions-item>
        <el-descriptions-item label="关联整流器">
          {{ selectedPoint.rectifier?.name || '未关联' }}
        </el-descriptions-item>
        <el-descriptions-item label="连续异常次数">
          <el-tag :type="selectedPoint.consecutive_abnormal_count >= 3 ? 'danger' : 'warning'" size="small">
            {{ selectedPoint.consecutive_abnormal_count || 0 }} 次
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="当前电位(V)">
          <span :class="{ 'text-danger': selectedPoint.latest_potential < selectedPoint.min_protection_potential }">
            {{ selectedPoint.latest_potential || '-' }}
          </span>
        </el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="selectedPoint.status === 'ACTIVE' ? 'success' : 'info'">
            {{ selectedPoint.status === 'ACTIVE' ? '启用' : '停用' }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="最近测量时间" :span="2">
          {{ selectedPoint.latest_measure_time ? formatDate(selectedPoint.latest_measure_time) : '-' }}
        </el-descriptions-item>
      </el-descriptions>
    </el-dialog>

    <el-dialog v-model="rectifierDialogVisible" title="关联整流器信息" width="600px">
      <el-descriptions :column="2" border v-if="rectifierInfo">
        <el-descriptions-item label="整流器编号">{{ rectifierInfo.code }}</el-descriptions-item>
        <el-descriptions-item label="整流器名称">{{ rectifierInfo.name }}</el-descriptions-item>
        <el-descriptions-item label="型号">{{ rectifierInfo.model }}</el-descriptions-item>
        <el-descriptions-item label="额定电流(A)">{{ rectifierInfo.rated_current }}</el-descriptions-item>
        <el-descriptions-item label="额定电压(V)">{{ rectifierInfo.rated_voltage }}</el-descriptions-item>
        <el-descriptions-item label="输出电流(A)">{{ rectifierInfo.output_current }}</el-descriptions-item>
        <el-descriptions-item label="输出电压(V)">{{ rectifierInfo.output_voltage }}</el-descriptions-item>
        <el-descriptions-item label="运行状态">
          <el-tag :type="rectifierInfo.status === 'RUNNING' ? 'success' : 'warning'">
            {{ rectifierInfo.status === 'RUNNING' ? '运行中' : '停运' }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="安装位置" :span="2">{{ rectifierInfo.install_location }}</el-descriptions-item>
      </el-descriptions>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, nextTick } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Warning, TrendCharts, Clock, CircleCheck } from '@element-plus/icons-vue';
import { getPoints, getRecords } from '../../api/measurement';
import { getRectifier } from '../../api/rectifier';
import { createRecheckPlan } from '../../api/recheck';
import * as echarts from 'echarts';

const loading = ref(false);
const loadingRecords = ref(false);
const detailDialogVisible = ref(false);
const rectifierDialogVisible = ref(false);
const selectedPointId = ref('');
const filterType = ref('all');
const abnormalPoints = ref([]);
const recentAbnormalRecords = ref([]);
const points = ref([]);
const selectedPoint = ref(null);
const rectifierInfo = ref(null);
const chartRef = ref(null);
let chartInstance = null;

const abnormalStats = reactive({
  totalAbnormal: 0,
  consecutiveAbnormal: 0,
  pendingRecheck: 0,
  resolvedToday: 0,
});

const formatDate = (date) => {
  if (!date) return '-';
  return new Date(date).toLocaleString('zh-CN');
};

const loadStats = async () => {
  try {
    const res = await getPoints({ status: 'ACTIVE' });
    const allPoints = res.data || [];
    
    abnormalStats.totalAbnormal = allPoints.filter(p => 
      p.latest_potential !== null && 
      (p.latest_potential < p.min_protection_potential || p.latest_potential > p.max_protection_potential)
    ).length;
    
    abnormalStats.consecutiveAbnormal = allPoints.filter(p => 
      p.consecutive_abnormal_count && p.consecutive_abnormal_count >= 2
    ).length;
    
    abnormalStats.pendingRecheck = allPoints.filter(p => 
      p.consecutive_abnormal_count && p.consecutive_abnormal_count >= 2
    ).length;
  } catch (err) {
    console.error('加载统计数据失败', err);
  }
};

const loadAbnormalPoints = async () => {
  loading.value = true;
  try {
    const res = await getPoints({ status: 'ACTIVE' });
    let data = res.data || [];
    
    data = data.filter(p => 
      p.latest_potential !== null && 
      (p.latest_potential < p.min_protection_potential || p.latest_potential > p.max_protection_potential)
    );
    
    if (filterType.value === 'consecutive') {
      data = data.filter(p => p.consecutive_abnormal_count && p.consecutive_abnormal_count >= 2);
    } else if (filterType.value === 'pending') {
      data = data.filter(p => p.consecutive_abnormal_count && p.consecutive_abnormal_count >= 2);
    }
    
    data.sort((a, b) => (b.consecutive_abnormal_count || 0) - (a.consecutive_abnormal_count || 0));
    
    abnormalPoints.value = data;
  } catch (err) {
    ElMessage.error('加载异常测点失败');
  } finally {
    loading.value = false;
  }
};

const loadRecentAbnormalRecords = async () => {
  loadingRecords.value = true;
  try {
    const res = await getRecords({ isAbnormal: true, pageSize: 10 });
    recentAbnormalRecords.value = res.data || [];
  } catch (err) {
    ElMessage.error('加载异常记录失败');
  } finally {
    loadingRecords.value = false;
  }
};

const loadPotentialTrend = async () => {
  if (!selectedPointId.value) return;
  
  try {
    const res = await getRecords({ 
      pointId: selectedPointId.value, 
      pageSize: 30,
      sortBy: 'measureTime',
      sortOrder: 'desc'
    });
    const records = (res.data || []).reverse();
    
    const point = points.value.find(p => p.id === selectedPointId.value);
    
    const dates = records.map(r => r.measure_time ? new Date(r.measure_time).toLocaleDateString('zh-CN') : '');
    const potentials = records.map(r => r.protection_potential);
    const minLine = dates.map(() => point?.min_protection_potential || -1.5);
    const maxLine = dates.map(() => point?.max_protection_potential || -0.7);
    
    await nextTick();
    if (!chartInstance && chartRef.value) {
      chartInstance = echarts.init(chartRef.value);
    }
    
    if (chartInstance) {
      chartInstance.setOption({
        tooltip: {
          trigger: 'axis',
          formatter: (params) => {
            let result = params[0].name + '<br/>';
            params.forEach(param => {
              result += `${param.marker} ${param.seriesName}: ${param.value}V<br/>`;
            });
            return result;
          }
        },
        legend: {
          data: ['保护电位', '保护下限', '保护上限']
        },
        grid: {
          left: '3%',
          right: '4%',
          bottom: '3%',
          containLabel: true
        },
        xAxis: {
          type: 'category',
          data: dates
        },
        yAxis: {
          type: 'value',
          name: '电位(V)'
        },
        series: [
          {
            name: '保护电位',
            type: 'line',
            data: potentials,
            smooth: true,
            itemStyle: { color: '#409eff' },
            lineStyle: { width: 2 }
          },
          {
            name: '保护下限',
            type: 'line',
            data: minLine,
            lineStyle: { type: 'dashed', color: '#f56c6c' },
            itemStyle: { color: '#f56c6c' }
          },
          {
            name: '保护上限',
            type: 'line',
            data: maxLine,
            lineStyle: { type: 'dashed', color: '#e6a23c' },
            itemStyle: { color: '#e6a23c' }
          }
        ]
      });
    }
  } catch (err) {
    ElMessage.error('加载电位趋势失败');
  }
};

const viewPointDetail = (row) => {
  selectedPoint.value = row;
  detailDialogVisible.value = true;
};

const viewRectifier = async (rectifierId) => {
  try {
    const res = await getRectifier(rectifierId);
    rectifierInfo.value = res.data || res;
    rectifierDialogVisible.value = true;
  } catch (err) {
    ElMessage.error('加载整流器信息失败');
  }
};

const generateRecheckPlan = async (row) => {
  try {
    await ElMessageBox.confirm(
      `确定为测点 ${row.code} 生成复测计划吗？`,
      '生成复测计划',
      { type: 'warning' }
    );
    
    await createRecheckPlan({
      pointId: row.id,
      reason: `电位持续异常，当前电位: ${row.latest_potential}V`,
      priority: row.consecutive_abnormal_count >= 3 ? 'HIGH' : 'MEDIUM',
      deadline: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    });
    
    ElMessage.success('复测计划已生成');
  } catch (err) {
    if (err !== 'cancel') {
      ElMessage.error(err.response?.data?.error || '生成失败');
    }
  }
};

onMounted(async () => {
  const res = await getPoints({ status: 'ACTIVE' });
  points.value = res.data || [];
  
  if (points.value.length > 0) {
    selectedPointId.value = points.value[0].id;
    loadPotentialTrend();
  }
  
  loadStats();
  loadAbnormalPoints();
  loadRecentAbnormalRecords();
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

.stat-icon.warning {
  background: linear-gradient(135deg, #ff9800, #f57c00);
}

.stat-icon.danger {
  background: linear-gradient(135deg, #f44336, #d32f2f);
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

.chart-card {
  margin-bottom: 20px;
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
  font-size: 12px;
  color: #909399;
}

.text-danger {
  color: #f56c6c;
  font-weight: 500;
}
</style>
