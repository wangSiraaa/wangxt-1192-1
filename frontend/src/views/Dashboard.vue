<template>
  <div>
    <h2 class="page-title">首页概览</h2>
    
    <div class="dashboard-grid">
      <div class="stat-card" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
        <div class="stat-card-value">{{ stats.totalPoints }}</div>
        <div class="stat-card-label">测点总数</div>
      </div>
      <div class="stat-card" style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);">
        <div class="stat-card-value">{{ stats.abnormalPoints }}</div>
        <div class="stat-card-label">连续异常测点</div>
      </div>
      <div class="stat-card" style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);">
        <div class="stat-card-value">{{ stats.pendingRecheck }}</div>
        <div class="stat-card-label">待复测任务</div>
      </div>
      <div class="stat-card" style="background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);">
        <div class="stat-card-value">{{ stats.openRisks }}</div>
        <div class="stat-card-label">待处理风险</div>
      </div>
    </div>

    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
      <div class="page-container">
        <h3 style="font-size: 16px; margin-bottom: 16px; color: #334155;">最新测量记录</h3>
        <el-table :data="latestRecords" style="width: 100%" size="small">
          <el-table-column prop="point_code" label="测点编号" width="100" />
          <el-table-column prop="point_name" label="测点名称" width="120" />
          <el-table-column prop="protection_potential" label="保护电位(V)" width="120">
            <template #default="{ row }">
              <span :class="row.is_abnormal ? 'status-abnormal status-tag' : 'status-normal status-tag'">
                {{ row.protection_potential }}
              </span>
            </template>
          </el-table-column>
          <el-table-column prop="measure_time" label="测量时间">
            <template #default="{ row }">
              {{ formatDate(row.measure_time) }}
            </template>
          </el-table-column>
        </el-table>
      </div>

      <div class="page-container">
        <h3 style="font-size: 16px; margin-bottom: 16px; color: #334155;">待处理任务</h3>
        <el-table :data="pendingTasks" style="width: 100%" size="small">
          <el-table-column prop="type" label="类型" width="100">
            <template #default="{ row }">
              <el-tag size="small" :type="row.type === '复测' ? 'warning' : 'danger'">
                {{ row.type }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="code" label="编号" width="140" />
          <el-table-column prop="point" label="涉及测点" />
          <el-table-column prop="time" label="创建时间">
            <template #default="{ row }">
              {{ formatDate(row.time) }}
            </template>
          </el-table-column>
        </el-table>
      </div>
    </div>

    <div class="page-container" style="margin-top: 20px;">
      <h3 style="font-size: 16px; margin-bottom: 16px; color: #334155;">电位趋势分析</h3>
      <div ref="chartRef" class="chart-container"></div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, nextTick } from 'vue';
import * as echarts from 'echarts';
import { getRecords, getPoints } from '../api/measurement';
import { getRecheckPlans } from '../api/recheck';
import { getRisks } from '../api/risk';
import moment from 'moment';

const chartRef = ref();
let chart = null;

const stats = reactive({
  totalPoints: 0,
  abnormalPoints: 0,
  pendingRecheck: 0,
  openRisks: 0,
});

const latestRecords = ref([]);
const pendingTasks = ref([]);

const formatDate = (date) => moment(date).format('YYYY-MM-DD HH:mm');

const loadStats = async () => {
  try {
    const [pointsRes, recheckRes, risksRes, recordsRes] = await Promise.all([
      getPoints(),
      getRecheckPlans({ status: 'PENDING', pageSize: 100 }),
      getRisks({ status: 'OPEN', pageSize: 100 }),
      getRecords({ pageSize: 10 }),
    ]);

    stats.totalPoints = pointsRes.data?.length || 0;
    
    const abnormalPointsRes = await getPoints();
    stats.abnormalPoints = abnormalPointsRes.data?.filter(p => p.consecutive_abnormal)?.length || 0;
    
    stats.pendingRecheck = recheckRes.total || 0;
    stats.openRisks = risksRes.total || 0;
    latestRecords.value = recordsRes.data || [];

    const tasks = [];
    recheckRes.data?.forEach(r => {
      tasks.push({
        type: '复测',
        code: r.plan_code,
        point: r.point_name,
        time: r.created_at,
      });
    });
    risksRes.data?.forEach(r => {
      tasks.push({
        type: '风险',
        code: r.risk_code,
        point: r.point_name,
        time: r.detected_time,
      });
    });
    pendingTasks.value = tasks.sort((a, b) => new Date(b.time) - new Date(a.time)).slice(0, 10);
  } catch (err) {
    console.error('Load stats error:', err);
  }
};

const initChart = async () => {
  await nextTick();
  if (!chartRef.value) return;

  chart = echarts.init(chartRef.value);

  const pointRes = await getPoints({ pageSize: 5 });
  const points = pointRes.data?.slice(0, 3) || [];

  const series = await Promise.all(
    points.map(async (point) => {
      const res = await getRecords({ pointId: point.id, pageSize: 10 });
      const data = (res.data || []).reverse().map(r => [
        moment(r.measure_time).format('MM-DD HH:mm'),
        r.protection_potential,
      ]);
      return {
        name: point.code,
        type: 'line',
        smooth: true,
        data,
        markLine: {
          silent: true,
          data: [
            { yAxis: -0.85, name: '上限' },
            { yAxis: -1.1, name: '下限' },
          ],
          lineStyle: { color: '#94a3b8', type: 'dashed' },
        },
      };
    })
  );

  chart.setOption({
    tooltip: { trigger: 'axis' },
    legend: { data: points.map(p => p.code) },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: { type: 'category', boundaryGap: false },
    yAxis: { type: 'value', name: '电位(V)', inverse: true },
    series,
  });
};

onMounted(() => {
  loadStats();
  initChart();

  window.addEventListener('resize', () => {
    chart?.resize();
  });
});
</script>
