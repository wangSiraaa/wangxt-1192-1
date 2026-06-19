const express = require('express');
const db = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');
const {
  validateCoordinates,
  isPotentialAbnormal,
  shouldCreateRecheckPlan,
  generateRecheckPlanCode,
  getConsecutiveAbnormalCount,
  determineRiskLevel,
  generateRiskCode,
} = require('../utils/businessRules');

const router = express.Router();

router.get('/', authenticateToken, async (req, res) => {
  try {
    const { pointId, startDate, endDate, isAbnormal, page = 1, pageSize = 20 } = req.query;
    
    let countQuery = 'SELECT COUNT(*) FROM measurement_records WHERE 1=1';
    let dataQuery = `
      SELECT mr.*, mp.code as point_code, mp.name as point_name,
             u.real_name as inspector_name,
             mp.min_protection_potential, mp.max_protection_potential
      FROM measurement_records mr
      LEFT JOIN measurement_points mp ON mr.point_id = mp.id
      LEFT JOIN users u ON mr.inspector_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (pointId) {
      params.push(pointId);
      countQuery += ` AND point_id = $${params.length}`;
      dataQuery += ` AND mr.point_id = $${params.length}`;
    }
    if (startDate) {
      params.push(startDate);
      countQuery += ` AND measure_time >= $${params.length}`;
      dataQuery += ` AND mr.measure_time >= $${params.length}`;
    }
    if (endDate) {
      params.push(endDate);
      countQuery += ` AND measure_time <= $${params.length}`;
      dataQuery += ` AND mr.measure_time <= $${params.length}`;
    }
    if (isAbnormal !== undefined) {
      params.push(isAbnormal === 'true');
      countQuery += ` AND is_abnormal = $${params.length}`;
      dataQuery += ` AND mr.is_abnormal = $${params.length}`;
    }

    dataQuery += ' ORDER BY mr.measure_time DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
    const limit = parseInt(pageSize);
    const offset = (parseInt(page) - 1) * limit;

    const countResult = await db.query(countQuery, params);
    const dataResult = await db.query(dataQuery, [...params, limit, offset]);

    res.json({
      data: dataResult.rows,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      pageSize: limit,
    });
  } catch (err) {
    console.error('Get measurement records error:', err);
    res.status(500).json({ error: '获取测量记录失败' });
  }
});

router.post('/', authenticateToken, requireRole('INSPECTOR', 'ENGINEER'), async (req, res) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const {
      pointId,
      measureTime,
      longitude,
      latitude,
      protectionPotential,
      soilResistivity,
      naturalPotential,
      temperature,
      weather,
      notes,
    } = req.body;

    const coordValidation = validateCoordinates(longitude, latitude);
    if (!coordValidation.valid) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: coordValidation.errors.join(', ') });
    }

    const pointResult = await client.query(
      'SELECT * FROM measurement_points WHERE id = $1 AND status = $2',
      [pointId, 'ACTIVE']
    );
    if (pointResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: '测点不存在或未启用' });
    }
    const point = pointResult.rows[0];

    const isAbnormal = isPotentialAbnormal(protectionPotential, point);

    const recordResult = await client.query(
      `INSERT INTO measurement_records
       (point_id, inspector_id, measure_time, longitude, latitude,
        protection_potential, soil_resistivity, natural_potential,
        temperature, weather, notes, is_abnormal)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [
        pointId,
        req.user.id,
        measureTime || new Date(),
        longitude,
        latitude,
        protectionPotential,
        soilResistivity,
        naturalPotential,
        temperature,
        weather,
        notes,
        isAbnormal,
      ]
    );

    const record = recordResult.rows[0];
    let recheckPlan = null;
    let risk = null;

    if (isAbnormal) {
      const consecutiveCount = await getConsecutiveAbnormalCount(pointId);
      const needRecheck = consecutiveCount >= 2;

      if (needRecheck) {
        const planCode = generateRecheckPlanCode();
        const plannedTime = new Date();
        plannedTime.setHours(plannedTime.getHours() + 24);

        const recheckResult = await client.query(
          `INSERT INTO recheck_plans
           (plan_code, point_id, trigger_record_id, abnormal_count,
            planned_time, priority, description)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING *`,
          [
            planCode,
            pointId,
            record.id,
            consecutiveCount,
            plannedTime,
            consecutiveCount >= 3 ? 'HIGH' : 'MEDIUM',
            `电位连续${consecutiveCount}次异常，保护电位：${protectionPotential}V`,
          ]
        );
        recheckPlan = recheckResult.rows[0];

        if (consecutiveCount >= 3) {
          const riskLevel = determineRiskLevel(consecutiveCount, protectionPotential);
          const riskCode = generateRiskCode();

          const riskResult = await client.query(
            `INSERT INTO risks
             (risk_code, point_id, risk_level, description, detected_time)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [
              riskCode,
              pointId,
              riskLevel,
              `保护电位连续异常，当前值：${protectionPotential}V，连续${consecutiveCount}次`,
              new Date(),
            ]
          );
          risk = riskResult.rows[0];
        }
      }
    }

    await client.query('COMMIT');

    res.status(201).json({
      data: record,
      message: '测量记录提交成功',
      recheckPlan,
      risk,
      isAbnormal,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Create measurement record error:', err);
    res.status(500).json({ error: '提交测量记录失败' });
  } finally {
    client.release();
  }
});

router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT mr.*, mp.code as point_code, mp.name as point_name,
              u.real_name as inspector_name
       FROM measurement_records mr
       LEFT JOIN measurement_points mp ON mr.point_id = mp.id
       LEFT JOIN users u ON mr.inspector_id = u.id
       WHERE mr.id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: '测量记录不存在' });
    }

    res.json({ data: result.rows[0] });
  } catch (err) {
    console.error('Get measurement record error:', err);
    res.status(500).json({ error: '获取测量记录失败' });
  }
});

module.exports = router;
