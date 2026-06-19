const express = require('express');
const db = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { validateCoordinates } = require('../utils/businessRules');

const router = express.Router();

router.get('/', authenticateToken, async (req, res) => {
  try {
    const { status, rectifierId } = req.query;
    let query = `
      SELECT mp.*, r.code as rectifier_code, r.name as rectifier_name,
             r.longitude as rectifier_lng, r.latitude as rectifier_lat
      FROM measurement_points mp
      LEFT JOIN rectifiers r ON mp.rectifier_id = r.id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      params.push(status);
      query += ` AND mp.status = $${params.length}`;
    }
    if (rectifierId) {
      params.push(rectifierId);
      query += ` AND mp.rectifier_id = $${params.length}`;
    }

    query += ' ORDER BY mp.code';

    const result = await db.query(query, params);
    res.json({ data: result.rows });
  } catch (err) {
    console.error('Get measurement points error:', err);
    res.status(500).json({ error: '获取测点列表失败' });
  }
});

router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT mp.*, r.code as rectifier_code, r.name as rectifier_name
       FROM measurement_points mp
       LEFT JOIN rectifiers r ON mp.rectifier_id = r.id
       WHERE mp.id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: '测点不存在' });
    }

    res.json({ data: result.rows[0] });
  } catch (err) {
    console.error('Get measurement point error:', err);
    res.status(500).json({ error: '获取测点详情失败' });
  }
});

router.post('/', authenticateToken, requireRole('ENGINEER', 'DISPATCHER'), async (req, res) => {
  try {
    const { code, name, pipelineSegment, longitude, latitude, rectifierId, minPotential, maxPotential } = req.body;

    const coordValidation = validateCoordinates(longitude, latitude);
    if (!coordValidation.valid) {
      return res.status(400).json({ error: coordValidation.errors.join(', ') });
    }

    const result = await db.query(
      `INSERT INTO measurement_points 
       (code, name, pipeline_segment, longitude, latitude, rectifier_id, 
        min_protection_potential, max_protection_potential)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [code, name, pipelineSegment, longitude, latitude, rectifierId, minPotential, maxPotential]
    );

    res.status(201).json({ data: result.rows[0], message: '测点创建成功' });
  } catch (err) {
    console.error('Create measurement point error:', err);
    if (err.code === '23505') {
      return res.status(400).json({ error: '测点编码已存在' });
    }
    res.status(500).json({ error: '创建测点失败' });
  }
});

router.put('/:id', authenticateToken, requireRole('ENGINEER', 'DISPATCHER'), async (req, res) => {
  try {
    const { name, pipelineSegment, longitude, latitude, rectifierId, minPotential, maxPotential, status } = req.body;

    if (longitude !== undefined && latitude !== undefined) {
      const coordValidation = validateCoordinates(longitude, latitude);
      if (!coordValidation.valid) {
        return res.status(400).json({ error: coordValidation.errors.join(', ') });
      }
    }

    const existing = await db.query('SELECT * FROM measurement_points WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: '测点不存在' });
    }

    const result = await db.query(
      `UPDATE measurement_points SET
         name = COALESCE($1, name),
         pipeline_segment = COALESCE($2, pipeline_segment),
         longitude = COALESCE($3, longitude),
         latitude = COALESCE($4, latitude),
         rectifier_id = COALESCE($5, rectifier_id),
         min_protection_potential = COALESCE($6, min_protection_potential),
         max_protection_potential = COALESCE($7, max_protection_potential),
         status = COALESCE($8, status),
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $9
       RETURNING *`,
      [name, pipelineSegment, longitude, latitude, rectifierId, minPotential, maxPotential, status, req.params.id]
    );

    res.json({ data: result.rows[0], message: '测点更新成功' });
  } catch (err) {
    console.error('Update measurement point error:', err);
    res.status(500).json({ error: '更新测点失败' });
  }
});

module.exports = router;
