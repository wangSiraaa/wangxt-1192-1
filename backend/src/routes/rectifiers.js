const express = require('express');
const db = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { validateCoordinates } = require('../utils/businessRules');

const router = express.Router();

router.get('/', authenticateToken, async (req, res) => {
  try {
    const { status } = req.query;
    let query = 'SELECT * FROM rectifiers WHERE 1=1';
    const params = [];

    if (status) {
      params.push(status);
      query += ` AND status = $${params.length}`;
    }

    query += ' ORDER BY code';

    const result = await db.query(query, params);
    res.json({ data: result.rows });
  } catch (err) {
    console.error('Get rectifiers error:', err);
    res.status(500).json({ error: '获取整流器列表失败' });
  }
});

router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT r.*,
              (SELECT COUNT(*) FROM measurement_points mp WHERE mp.rectifier_id = r.id) as point_count
       FROM rectifiers r
       WHERE r.id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: '整流器不存在' });
    }

    res.json({ data: result.rows[0] });
  } catch (err) {
    console.error('Get rectifier error:', err);
    res.status(500).json({ error: '获取整流器详情失败' });
  }
});

router.post('/', authenticateToken, requireRole('DISPATCHER', 'ENGINEER'), async (req, res) => {
  try {
    const { code, name, location, longitude, latitude, voltageSetting, currentSetting } = req.body;

    if (longitude !== undefined && latitude !== undefined) {
      const coordValidation = validateCoordinates(longitude, latitude);
      if (!coordValidation.valid) {
        return res.status(400).json({ error: coordValidation.errors.join(', ') });
      }
    }

    const result = await db.query(
      `INSERT INTO rectifiers
       (code, name, location, longitude, latitude, voltage_setting, current_setting)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [code, name, location, longitude, latitude, voltageSetting, currentSetting]
    );

    res.status(201).json({ data: result.rows[0], message: '整流器创建成功' });
  } catch (err) {
    console.error('Create rectifier error:', err);
    if (err.code === '23505') {
      return res.status(400).json({ error: '整流器编码已存在' });
    }
    res.status(500).json({ error: '创建整流器失败' });
  }
});

router.put('/:id', authenticateToken, requireRole('DISPATCHER', 'ENGINEER'), async (req, res) => {
  try {
    const { name, location, longitude, latitude, voltageSetting, currentSetting, status } = req.body;

    if (longitude !== undefined && latitude !== undefined) {
      const coordValidation = validateCoordinates(longitude, latitude);
      if (!coordValidation.valid) {
        return res.status(400).json({ error: coordValidation.errors.join(', ') });
      }
    }

    const existing = await db.query('SELECT * FROM rectifiers WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: '整流器不存在' });
    }

    const result = await db.query(
      `UPDATE rectifiers SET
         name = COALESCE($1, name),
         location = COALESCE($2, location),
         longitude = COALESCE($3, longitude),
         latitude = COALESCE($4, latitude),
         voltage_setting = COALESCE($5, voltage_setting),
         current_setting = COALESCE($6, current_setting),
         status = COALESCE($7, status),
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $8
       RETURNING *`,
      [name, location, longitude, latitude, voltageSetting, currentSetting, status, req.params.id]
    );

    res.json({ data: result.rows[0], message: '整流器更新成功' });
  } catch (err) {
    console.error('Update rectifier error:', err);
    res.status(500).json({ error: '更新整流器失败' });
  }
});

module.exports = router;
