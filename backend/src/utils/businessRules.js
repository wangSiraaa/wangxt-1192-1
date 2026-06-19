const db = require('../config/database');

const POTENTIAL_THRESHOLDS = {
  MIN: -1.1000,
  MAX: -0.8500,
};

const CONSECUTIVE_ABNORMAL_THRESHOLD = 2;

const validateCoordinates = (longitude, latitude) => {
  const errors = [];
  if (longitude === null || longitude === undefined || isNaN(longitude)) {
    errors.push('测点经度坐标缺失');
  }
  if (latitude === null || latitude === undefined || isNaN(latitude)) {
    errors.push('测点纬度坐标缺失');
  }
  if (longitude < -180 || longitude > 180) {
    errors.push('经度坐标超出有效范围');
  }
  if (latitude < -90 || latitude > 90) {
    errors.push('纬度坐标超出有效范围');
  }
  return { valid: errors.length === 0, errors };
};

const isPotentialAbnormal = (potential, pointConfig) => {
  const min = pointConfig?.min_protection_potential || POTENTIAL_THRESHOLDS.MIN;
  const max = pointConfig?.max_protection_potential || POTENTIAL_THRESHOLDS.MAX;
  return potential < min || potential > max;
};

const getConsecutiveAbnormalCount = async (pointId) => {
  const result = await db.query(
    `SELECT is_abnormal, measure_time
     FROM measurement_records
     WHERE point_id = $1
     ORDER BY measure_time DESC
     LIMIT 10`,
    [pointId]
  );

  let count = 0;
  for (const record of result.rows) {
    if (record.is_abnormal) {
      count++;
    } else {
      break;
    }
  }
  return count;
};

const shouldCreateRecheckPlan = async (pointId) => {
  const consecutiveCount = await getConsecutiveAbnormalCount(pointId);
  return consecutiveCount >= CONSECUTIVE_ABNORMAL_THRESHOLD;
};

const canCloseRisk = async (riskId) => {
  const result = await db.query(
    `SELECT r.*, ra.is_rechecked
     FROM risks r
     LEFT JOIN rectifier_adjustments ra ON r.rectifier_adjustment_id = ra.id
     WHERE r.id = $1`,
    [riskId]
  );

  if (result.rows.length === 0) {
    return { valid: false, errors: ['风险记录不存在'] };
  }

  const risk = result.rows[0];
  
  if (risk.rectifier_adjustment_id && !risk.is_rechecked) {
    return { valid: false, errors: ['整流器调整后未完成复测，不能关闭风险'] };
  }

  return { valid: true };
};

const generateRecheckPlanCode = () => {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `RCP-${dateStr}-${random}`;
};

const generateAdjustmentCode = () => {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `ADJ-${dateStr}-${random}`;
};

const generateRiskCode = () => {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `RSK-${dateStr}-${random}`;
};

const determineRiskLevel = (consecutiveCount, potential) => {
  if (consecutiveCount >= 5 || potential > -0.7 || potential < -1.5) {
    return 'HIGH';
  } else if (consecutiveCount >= 3) {
    return 'MEDIUM';
  }
  return 'LOW';
};

module.exports = {
  validateCoordinates,
  isPotentialAbnormal,
  getConsecutiveAbnormalCount,
  shouldCreateRecheckPlan,
  canCloseRisk,
  generateRecheckPlanCode,
  generateAdjustmentCode,
  generateRiskCode,
  determineRiskLevel,
  POTENTIAL_THRESHOLDS,
  CONSECUTIVE_ABNORMAL_THRESHOLD,
};
