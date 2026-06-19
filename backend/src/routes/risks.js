const express = require('express');
const db = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { canCloseRisk, generateRiskCode } = require('../utils/businessRules');

const router = express.Router();

router.get('/', authenticateToken, async (req, res) => {
  try {
    const { status, riskLevel, pointId, page = 1, pageSize = 20 } = req.query;

    let countQuery = 'SELECT COUNT(*) FROM risks WHERE 1=1';
    let dataQuery = `
      SELECT r.*, mp.code as point_code, mp.name as point_name,
              mp.longitude as point_lng, mp.latitude as point_lat,
              u.real_name as closer_name,
              ra.adjustment_code, ra.is_rechecked
       FROM risks r
       LEFT JOIN measurement_points mp ON r.point_id = mp.id
       LEFT JOIN users u ON r.closer_id = u.id
       LEFT JOIN rectifier_adjustments ra ON r.rectifier_adjustment_id = ra.id
       WHERE 1=1
    `;
    const params = [];

    if (status) {
      params.push(status);
      countQuery += ` AND status = $${params.length}`;
      dataQuery += ` AND r.status = $${params.length}`;
    }
    if (riskLevel) {
      params.push(riskLevel);
      countQuery += ` AND risk_level = $${params.length}`;
      dataQuery += ` AND r.risk_level = $${params.length}`;
    }
    if (pointId) {
      params.push(pointId);
      countQuery += ` AND point_id = $${params.length}`;
      dataQuery += ` AND r.point_id = $${params.length}`;
    }

    dataQuery += ' ORDER BY r.detected_time DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
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
    console.error('Get risks error:', err);
    res.status(500).json({ error: '获取风险列表失败' });
  }
});

router.post('/', authenticateToken, requireRole('ENGINEER', 'DISPATCHER'), async (req, res) => {
  try {
    const { pointId, riskLevel, description } = req.body;

    if (!pointId || !riskLevel) {
      return res.status(400).json({ error: '测点ID和风险等级不能为空' });
    }

    const riskCode = generateRiskCode();

    const result = await db.query(
      `INSERT INTO risks
       (risk_code, point_id, risk_level, description, detected_time)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [riskCode, pointId, riskLevel, description, new Date()]
    );

    res.status(201).json({ data: result.rows[0], message: '风险记录创建成功' });
  } catch (err) {
    console.error('Create risk error:', err);
    res.status(500).json({ error: '创建风险记录失败' });
  }
});

router.put('/:id/close', authenticateToken, requireRole('ENGINEER', 'DISPATCHER'), async (req, res) => {
  try {
    const { closeNotes } = req.body;

    const existing = await db.query('SELECT * FROM risks WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: '风险记录不存在' });
    }

    if (existing.rows[0].status === 'CLOSED') {
      return res.status(400).json({ error: '风险已关闭' });
    }

    const closeCheck = await canCloseRisk(req.params.id);
    if (!closeCheck.valid) {
      return res.status(400).json({ error: closeCheck.errors.join(', ') });
    }

    const result = await db.query(
      `UPDATE risks SET
         status = 'CLOSED',
         closed_time = CURRENT_TIMESTAMP,
         closer_id = $1,
         close_notes = $2,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING *`,
      [req.user.id, closeNotes, req.params.id]
    );

    res.json({ data: result.rows[0], message: '风险关闭成功' });
  } catch (err) {
    console.error('Close risk error:', err);
    res.status(500).json({ error: '关闭风险失败' });
  }
});

router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT r.*, mp.code as point_code, mp.name as point_name,
              u.real_name as closer_name,
              ra.adjustment_code, ra.is_rechecked
       FROM risks r
       LEFT JOIN measurement_points mp ON r.point_id = mp.id
       LEFT JOIN users u ON r.closer_id = u.id
       LEFT JOIN rectifier_adjustments ra ON r.rectifier_adjustment_id = ra.id
       WHERE r.id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: '风险记录不存在' });
    }

    res.json({ data: result.rows[0] });
  } catch (err) {
    console.error('Get risk error:', err);
    res.status(500).json({ error: '获取风险详情失败' });
  }
});

module.exports = router;
