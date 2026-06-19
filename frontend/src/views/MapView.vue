<template>
  <div>
    <h2 class="page-title">地图监控</h2>
    
    <div class="page-container">
      <div class="table-toolbar">
        <div style="display: flex; gap: 12px;">
          <el-checkbox v-model="showAbnormalOnly" @change="loadPoints">
            只显示异常测点
          </el-checkbox>
          <el-tag type="success">正常测点: {{ normalCount }}</el-tag>
          <el-tag type="danger">异常测点: {{ abnormalCount }}</el-tag>
          <el-tag type="warning">待调整整流器: {{ pendingRectifiers }}</el-tag>
        </div>
        <el-button type="primary" @click="refreshMap">
          <el-icon><Refresh /></el-icon>
          刷新
        </el-button>
      </div>

      <div id="map" class="map-container"></div>

      <el-row :gutter="20" style="margin-top: 20px;">
        <el-col :span="12">
          <div class="detail-section">
            <div class="detail-section-title">测点详情</div>
            <el-descriptions v-if="selectedPoint" :column="2" border size="small">
              <el-descriptions-item label="测点编号">{{ selectedPoint.code }}</el-descriptions-item>
              <el-descriptions-item label="测点名称">{{ selectedPoint.name }}</el-descriptions-item>
              <el-descriptions-item label="管段">{{ selectedPoint.pipeline_segment }}</el-descriptions-item>
              <el-descriptions-item label="所属整流器">{{ selectedPoint.rectifier_name }}</el-descriptions-item>
              <el-descriptions-item label="最新电位">{{ selectedPoint.latest_potential }} V</el-descriptions-item>
              <el-descriptions-item label="测量时间">{{ formatDate(selectedPoint.latest_measure_time) }}</el-descriptions-item>
              <el-descriptions-item label="状态" :span="2">
                <span :class="selectedPoint.consecutive_abnormal ? 'status-abnormal status-tag' : 'status-normal status-tag'">
                  {{ selectedPoint.consecutive_abnormal ? '连续异常' : '正常' }}
                </span>
              </el-descriptions-item>
              <el-descriptions-item label="保护范围" :span="2">
                {{ selectedPoint.min_protection_potential }} V ~ {{ selectedPoint.max_protection_potential }} V
              </el-descriptions-item>
            </el-descriptions>
            <el-empty v-else description="点击地图上的测点查看详情" />
          </div>
        </el-col>
        <el-col :span="12">
          <div class="detail-section">
            <div class="detail-section-title">图例</div>
            <div style="display: flex; flex-direction: column; gap: 12px;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <div style="width: 16px; height: 16px; background: #22c55e; border-radius: 50%;"></div>
                <span>正常测点</span>
              </div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <div style="width: 16px; height: 16px; background: #ef4444; border-radius: 50%;"></div>
                <span>异常测点</span>
              </div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <div style="width: 16px; height: 16px; background: #f59e0b; border-radius: 50%;"></div>
                <span>整流器</span>
              </div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <div style="width: 24px; height: 4px; background: #3b82f6;"></div>
                <span>管道中心线</span>
              </div>
            </div>
          </div>
        </el-col>
      </el-row>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { ElMessage } from 'element-plus';
import { Refresh } from '@element-plus/icons-vue';
import { getMapPoints, getMapRectifiers, getPipelineRoute } from '../api/map';
import moment from 'moment';

const showAbnormalOnly = ref(false);
const selectedPoint = ref(null);
const normalCount = ref(0);
const abnormalCount = ref(0);
const pendingRectifiers = ref(0);

let map = null;
let markers = [];
let pipelineLayer = null;

const formatDate = (date) => date ? moment(date).format('YYYY-MM-DD HH:mm') : '-';

const initMap = () => {
  if (typeof L === 'undefined') {
    ElMessage.error('地图组件加载失败');
    return;
  }

  map = L.map('map').setView([39.8842, 116.5174], 11);
  
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
  }).addTo(map);
};

const loadPoints = async () => {
  try {
    const [pointsRes, rectifiersRes, pipelineRes] = await Promise.all([
      getMapPoints({ abnormalOnly: showAbnormalOnly.value }),
      getMapRectifiers(),
      getPipelineRoute(),
    ]);

    const points = pointsRes.data || [];
    normalCount.value = points.filter(p => !p.consecutive_abnormal).length;
    abnormalCount.value = points.filter(p => p.consecutive_abnormal).length;
    pendingRectifiers.value = (rectifiersRes.data || []).filter(r => r.pending_adjustments > 0).length;

    markers.forEach(m => map.removeLayer(m));
    markers = [];

    points.forEach(point => {
      const isAbnormal = point.consecutive_abnormal;
      const color = isAbnormal ? '#ef4444' : '#22c55e';
      
      const marker = L.circleMarker([point.latitude, point.longitude], {
        radius: 8,
        fillColor: color,
        color: '#fff',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.8,
      }).addTo(map);

      const popupContent = `
        <div style="min-width: 200px;">
          <h4 style="margin: 0 0 8px 0;">${point.code} - ${point.name}</h4>
          <p style="margin: 4px 0;">最新电位: <strong>${point.latest_potential || '-'} V</strong></p>
          <p style="margin: 4px 0;">状态: <span style="color: ${color}; font-weight: bold;">${isAbnormal ? '异常' : '正常'}</span></p>
          <p style="margin: 4px 0; font-size: 12px; color: #666;">${formatDate(point.latest_measure_time)}</p>
        </div>
      `;
      
      marker.bindPopup(popupContent);
      marker.on('click', () => {
        selectedPoint.value = point;
      });
      markers.push(marker);
    });

    const rectifiers = rectifiersRes.data || [];
    rectifiers.forEach(rectifier => {
      if (rectifier.latitude && rectifier.longitude) {
        const icon = L.divIcon({
          className: 'rectifier-marker',
          html: `<div style="background: #f59e0b; width: 20px; height: 20px; border-radius: 50%; border: 3px solid #fff; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
          iconSize: [20, 20],
          iconAnchor: [10, 10],
        });

        const marker = L.marker([rectifier.latitude, rectifier.longitude], { icon }).addTo(map);
        marker.bindPopup(`
          <div>
            <h4 style="margin: 0 0 8px 0;">${rectifier.code} - ${rectifier.name}</h4>
            <p style="margin: 4px 0;">电压: ${rectifier.voltage_setting} V</p>
            <p style="margin: 4px 0;">电流: ${rectifier.current_setting} A</p>
            <p style="margin: 4px 0;">关联测点: ${rectifier.point_count} 个</p>
          </div>
        `);
        markers.push(marker);
      }
    });

    if (pipelineLayer) {
      map.removeLayer(pipelineLayer);
    }
    const segments = pipelineRes.data || [];
    segments.forEach(segment => {
      const latlngs = segment.coordinates.map(c => [c[1], c[0]]);
      pipelineLayer = L.polyline(latlngs, {
        color: '#3b82f6',
        weight: 4,
        opacity: 0.8,
      }).addTo(map);
      pipelineLayer.bindTooltip(segment.name, { permanent: false });
    });

    if (markers.length > 0) {
      const group = L.featureGroup(markers);
      map.fitBounds(group.getBounds().pad(0.1));
    }
  } catch (err) {
    console.error('Load map data error:', err);
    ElMessage.error('加载地图数据失败');
  }
};

const refreshMap = () => {
  loadPoints();
  ElMessage.success('地图已刷新');
};

onMounted(() => {
  initMap();
  setTimeout(loadPoints, 500);
});

onUnmounted(() => {
  if (map) {
    map.remove();
    map = null;
  }
});
</script>
