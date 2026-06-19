const express = require('express');
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.get('/layers', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM map_layers WHERE is_active = TRUE ORDER BY id'
    );
    res.json({ data: result.rows });
  } catch (err) {
    console.error('Get map layers error:', err);
    res.status(500).json({ error: '获取地图图层失败' });
  }
});

router.get('/points', authenticateToken, async (req, res) => {
  try {
    const { status, abnormalOnly } = req.query;
    let query = `
      SELECT mp.id, mp.code, mp.name, mp.longitude, mp.latitude,
             mp.status, mp.pipeline_segment,
             r.code as rectifier_code, r.name as rectifier_name,
             mp.min_protection_potential, mp.max_protection_potential
      FROM measurement_points mp
      LEFT JOIN rectifiers r ON mp.rectifier_id = r.id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      params.push(status);
      query += ` AND mp.status = $${params.length}`;
    }

    query += ' ORDER BY mp.code';

    let points = (await db.query(query, params)).rows;

    if (abnormalOnly === 'true') {
      const abnormalPointsResult = await db.query(`
        SELECT DISTINCT point_id
        FROM (
          SELECT point_id, is_abnormal,
                 ROW_NUMBER() OVER (PARTITION BY point_id ORDER BY measure_time DESC) as rn
          FROM measurement_records
        ) t
        WHERE rn <= 2 AND is_abnormal = TRUE
        GROUP BY point_id
        HAVING COUNT(*) = 2
      `);
      const abnormalPointIds = new Set(abnormalPointsResult.rows.map(r => r.point_id));
      points = points.filter(p => abnormalPointIds.has(p.id));
    }

    const withLatestData = await Promise.all(
      points.map(async (point) => {
        const latestResult = await db.query(
          `SELECT protection_potential, measure_time, is_abnormal
           FROM measurement_records
           WHERE point_id = $1
           ORDER BY measure_time DESC
           LIMIT 1`,
          [point.id]
        );

        const lastTwoResult = await db.query(
          `SELECT is_abnormal
           FROM measurement_records
           WHERE point_id = $1
           ORDER BY measure_time DESC
           LIMIT 2`,
          [point.id]
        );

        const consecutiveAbnormal = lastTwoResult.rows.length === 2 &&
          lastTwoResult.rows.every(r => r.is_abnormal);

        return {
          ...point,
          latest_potential: latestResult.rows[0]?.protection_potential,
          latest_measure_time: latestResult.rows[0]?.measure_time,
          latest_is_abnormal: latestResult.rows[0]?.is_abnormal,
          consecutive_abnormal: consecutiveAbnormal,
        };
      })
    );

    res.json({ data: withLatestData });
  } catch (err) {
    console.error('Get map points error:', err);
    res.status(500).json({ error: '获取地图测点失败' });
  }
});

router.get('/rectifiers', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT r.*, 
              (SELECT COUNT(*) FROM measurement_points mp WHERE mp.rectifier_id = r.id) as point_count,
              (SELECT COUNT(*) FROM rectifier_adjustments ra WHERE ra.rectifier_id = r.id AND ra.status = 'PENDING') as pending_adjustments
       FROM rectifiers r
       ORDER BY r.code`
    );
    res.json({ data: result.rows });
  } catch (err) {
    console.error('Get map rectifiers error:', err);
    res.status(500).json({ error: '获取整流器位置失败' });
  }
});

router.get('/pipeline', authenticateToken, async (req, res) => {
  try {
    const pipelineSegments = [
      {
        id: 'seg-001',
        name: '东段K0-K10',
        coordinates: [
          [116.4074, 39.9042],
          [116.4274, 39.9142],
          [116.4474, 39.9242],
        ],
      },
      {
        id: 'seg-002',
        name: '中段K10-K20',
        coordinates: [
          [116.4474, 39.9242],
          [116.5174, 39.8642],
          [116.5274, 39.8742],
        ],
      },
      {
        id: 'seg-003',
        name: '西段K20-K30',
        coordinates: [
          [116.5274, 39.8742],
          [116.6174, 39.8142],
          [116.6574, 39.8042],
        ],
      },
    ];

    res.json({ data: pipelineSegments });
  } catch (err) {
    console.error('Get pipeline route error:', err);
    res.status(500).json({ error: '获取管道走向失败' });
  }
});

module.exports = router;
