const express = require('express');
const db = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { generateRecheckPlanCode, validateCoordinates, isPotentialAbnormal } = require('../utils/businessRules');

const router = express.Router();

router.get('/', authenticateToken, async (req, res) => {
  try {
    const { status, pointId, priority, assigneeId, page = 1, pageSize = 20 } = req.query;

    let countQuery = 'SELECT COUNT(*) FROM recheck_plans WHERE 1=1';
    let dataQuery = `
      SELECT rp.*, mp.code as point_code, mp.name as point_name,
             mp.longitude as point_lng, mp.latitude as point_lat,
             u1.real_name as assignee_name, u2.real_name as rechecker_name,
             mr.protection_potential as trigger_potential
      FROM recheck_plans rp
      LEFT JOIN measurement_points mp ON rp.point_id = mp.id
      LEFT JOIN users u1 ON rp.assignee_id = u1.id
      LEFT JOIN users u2 ON rp.rechecker_id = u2.id
      LEFT JOIN measurement_records mr ON rp.trigger_record_id = mr.id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      params.push(status);
      countQuery += ` AND status = $${params.length}`;
      dataQuery += ` AND rp.status = $${params.length}`;
    }
    if (pointId) {
      params.push(pointId);
      countQuery += ` AND point_id = $${params.length}`;
      dataQuery += ` AND rp.point_id = $${params.length}`;
    }
    if (priority) {
      params.push(priority);
      countQuery += ` AND priority = $${params.length}`;
      dataQuery += ` AND rp.priority = $${params.length}`;
    }
    if (assigneeId) {
      params.push(assigneeId);
      countQuery += ` AND assignee_id = $${params.length}`;
      dataQuery += ` AND rp.assignee_id = $${params.length}`;
    }

    dataQuery += ' ORDER BY rp.created_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
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
    console.error('Get recheck plans error:', err);
    res.status(500).json({ error: '获取复测计划失败' });
  }
});

router.post('/', authenticateToken, requireRole('ENGINEER', 'DISPATCHER'), async (req, res) => {
  try {
    const { pointId, plannedTime, assigneeId, priority, description } = req.body;

    if (!pointId) {
      return res.status(400).json({ error: '测点ID不能为空' });
    }

    const planCode = generateRecheckPlanCode();

    const result = await db.query(
      `INSERT INTO recheck_plans
       (plan_code, point_id, planned_time, assignee_id, priority, description)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [planCode, pointId, plannedTime || new Date(), assigneeId, priority || 'MEDIUM', description]
    );

    res.status(201).json({ data: result.rows[0], message: '复测计划创建成功' });
  } catch (err) {
    console.error('Create recheck plan error:', err);
    res.status(500).json({ error: '创建复测计划失败' });
  }
});

router.put('/:id/complete', authenticateToken, requireRole('INSPECTOR', 'ENGINEER'), async (req, res) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const { recheckResult, protectionPotential, longitude, latitude, soilResistivity } = req.body;

    const existing = await client.query('SELECT * FROM recheck_plans WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: '复测计划不存在' });
    }

    const plan = existing.rows[0];
    if (plan.status === 'COMPLETED') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: '复测计划已完成' });
    }

    if (protectionPotential !== undefined) {
      const coordValidation = validateCoordinates(longitude, latitude);
      if (!coordValidation.valid) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: coordValidation.errors.join(', ') });
      }

      const pointResult = await client.query(
        'SELECT * FROM measurement_points WHERE id = $1',
        [plan.point_id]
      );
      const point = pointResult.rows[0];
      const isAbnormal = isPotentialAbnormal(protectionPotential, point);

      const recordResult = await client.query(
        `INSERT INTO measurement_records
         (point_id, inspector_id, measure_time, longitude, latitude,
          protection_potential, soil_resistivity, is_abnormal, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [
          plan.point_id,
          req.user.id,
          new Date(),
          longitude,
          latitude,
          protectionPotential,
          soilResistivity,
          isAbnormal,
          `复测记录 - ${plan.plan_code}`,
        ]
      );

      await client.query(
        `UPDATE recheck_plans SET
           status = 'COMPLETED',
           recheck_result = $1,
           recheck_time = CURRENT_TIMESTAMP,
           rechecker_id = $2,
           updated_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [recheckResult || (isAbnormal ? '复测仍异常' : '复测恢复正常'), req.user.id, req.params.id]
      );

      await client.query(
        `UPDATE rectifier_adjustments SET
           is_rechecked = TRUE,
           recheck_record_id = $1
         WHERE id IN (
           SELECT rectifier_adjustment_id FROM risks
           WHERE point_id = $2 AND status = 'OPEN'
           LIMIT 1
         )`,
        [recordResult.rows[0].id, plan.point_id]
      );

      await client.query('COMMIT');

      res.json({
        data: { plan: { ...plan, status: 'COMPLETED' }, recheckRecord: recordResult.rows[0] },
        message: '复测完成，记录已保存',
      });
    } else {
      await client.query(
        `UPDATE recheck_plans SET
           status = 'COMPLETED',
           recheck_result = $1,
           recheck_time = CURRENT_TIMESTAMP,
           rechecker_id = $2,
           updated_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [recheckResult || '复测完成', req.user.id, req.params.id]
      );

      await client.query('COMMIT');

      res.json({ message: '复测完成' });
    }
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Complete recheck plan error:', err);
    res.status(500).json({ error: '完成复测计划失败' });
  } finally {
    client.release();
  }
});

router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT rp.*, mp.code as point_code, mp.name as point_name,
              u1.real_name as assignee_name, u2.real_name as rechecker_name
       FROM recheck_plans rp
       LEFT JOIN measurement_points mp ON rp.point_id = mp.id
       LEFT JOIN users u1 ON rp.assignee_id = u1.id
       LEFT JOIN users u2 ON rp.rechecker_id = u2.id
       WHERE rp.id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: '复测计划不存在' });
    }

    res.json({ data: result.rows[0] });
  } catch (err) {
    console.error('Get recheck plan error:', err);
    res.status(500).json({ error: '获取复测计划失败' });
  }
});

module.exports = router;
