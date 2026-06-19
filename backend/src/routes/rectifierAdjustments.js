const express = require('express');
const db = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { generateAdjustmentCode } = require('../utils/businessRules');

const router = express.Router();

router.get('/', authenticateToken, async (req, res) => {
  try {
    const { status, rectifierId, pointId, page = 1, pageSize = 20 } = req.query;

    let countQuery = 'SELECT COUNT(*) FROM rectifier_adjustments WHERE 1=1';
    let dataQuery = `
      SELECT ra.*, r.code as rectifier_code, r.name as rectifier_name,
             mp.code as point_code, mp.name as point_name,
             u.real_name as operator_name,
             mr.protection_potential as recheck_potential
      FROM rectifier_adjustments ra
      LEFT JOIN rectifiers r ON ra.rectifier_id = r.id
      LEFT JOIN measurement_points mp ON ra.point_id = mp.id
      LEFT JOIN users u ON ra.operator_id = u.id
      LEFT JOIN measurement_records mr ON ra.recheck_record_id = mr.id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      params.push(status);
      countQuery += ` AND status = $${params.length}`;
      dataQuery += ` AND ra.status = $${params.length}`;
    }
    if (rectifierId) {
      params.push(rectifierId);
      countQuery += ` AND rectifier_id = $${params.length}`;
      dataQuery += ` AND ra.rectifier_id = $${params.length}`;
    }
    if (pointId) {
      params.push(pointId);
      countQuery += ` AND point_id = $${params.length}`;
      dataQuery += ` AND ra.point_id = $${params.length}`;
    }

    dataQuery += ' ORDER BY ra.adjust_time DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
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
    console.error('Get rectifier adjustments error:', err);
    res.status(500).json({ error: '获取调整记录失败' });
  }
});

router.post('/', authenticateToken, requireRole('DISPATCHER', 'ENGINEER'), async (req, res) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const { rectifierId, pointId, adjustTime, newVoltage, newCurrent, reason } = req.body;

    if (!rectifierId || !reason) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: '整流器ID和调整原因不能为空' });
    }

    const rectifierResult = await client.query(
      'SELECT * FROM rectifiers WHERE id = $1',
      [rectifierId]
    );
    if (rectifierResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: '整流器不存在' });
    }
    const rectifier = rectifierResult.rows[0];

    const adjustmentCode = generateAdjustmentCode();

    const result = await client.query(
      `INSERT INTO rectifier_adjustments
       (adjustment_code, rectifier_id, point_id, operator_id, adjust_time,
        old_voltage, new_voltage, old_current, new_current, reason)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        adjustmentCode,
        rectifierId,
        pointId,
        req.user.id,
        adjustTime || new Date(),
        rectifier.voltage_setting,
        newVoltage,
        rectifier.current_setting,
        newCurrent,
        reason,
      ]
    );

    await client.query(
      `UPDATE rectifiers SET
         voltage_setting = $1,
         current_setting = $2,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $3`,
      [newVoltage, newCurrent, rectifierId]
    );

    if (pointId) {
      const openRiskResult = await client.query(
        `SELECT id FROM risks 
         WHERE point_id = $1 AND status = 'OPEN'
         ORDER BY detected_time DESC LIMIT 1`,
        [pointId]
      );

      if (openRiskResult.rows.length > 0) {
        await client.query(
          `UPDATE risks SET
             rectifier_adjustment_id = $1,
             updated_at = CURRENT_TIMESTAMP
           WHERE id = $2`,
          [result.rows[0].id, openRiskResult.rows[0].id]
        );
      }
    }

    await client.query('COMMIT');

    res.status(201).json({
      data: result.rows[0],
      message: '整流器调整记录创建成功',
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Create rectifier adjustment error:', err);
    res.status(500).json({ error: '创建调整记录失败' });
  } finally {
    client.release();
  }
});

router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT ra.*, r.code as rectifier_code, r.name as rectifier_name,
              mp.code as point_code, mp.name as point_name,
              u.real_name as operator_name
       FROM rectifier_adjustments ra
       LEFT JOIN rectifiers r ON ra.rectifier_id = r.id
       LEFT JOIN measurement_points mp ON ra.point_id = mp.id
       LEFT JOIN users u ON ra.operator_id = u.id
       WHERE ra.id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: '调整记录不存在' });
    }

    res.json({ data: result.rows[0] });
  } catch (err) {
    console.error('Get rectifier adjustment error:', err);
    res.status(500).json({ error: '获取调整记录失败' });
  }
});

module.exports = router;
