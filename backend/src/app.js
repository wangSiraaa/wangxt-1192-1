const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const measurementPointRoutes = require('./routes/measurementPoints');
const measurementRecordRoutes = require('./routes/measurementRecords');
const recheckPlanRoutes = require('./routes/recheckPlans');
const rectifierAdjustmentRoutes = require('./routes/rectifierAdjustments');
const riskRoutes = require('./routes/risks');
const rectifierRoutes = require('./routes/rectifiers');
const mapRoutes = require('./routes/map');

const app = express();
const PORT = process.env.API_PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/measurement-points', measurementPointRoutes);
app.use('/api/measurement-records', measurementRecordRoutes);
app.use('/api/recheck-plans', recheckPlanRoutes);
app.use('/api/rectifier-adjustments', rectifierAdjustmentRoutes);
app.use('/api/risks', riskRoutes);
app.use('/api/rectifiers', rectifierRoutes);
app.use('/api/map', mapRoutes);

app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: '服务器内部错误', message: err.message });
});

app.use((req, res) => {
  res.status(404).json({ error: '接口不存在' });
});

if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = app;
