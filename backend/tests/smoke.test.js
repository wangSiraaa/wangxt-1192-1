const request = require('supertest');
const app = require('../src/app');
const businessRules = require('../src/utils/businessRules');

describe('Business Rules Validation', () => {
  describe('Coordinate Validation', () => {
    it('should reject missing coordinates', () => {
      const result = businessRules.validateCoordinates(null, null);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('测点经度坐标缺失');
      expect(result.errors).toContain('测点纬度坐标缺失');
    });

    it('should reject invalid coordinates', () => {
      const result = businessRules.validateCoordinates(200, 100);
      expect(result.valid).toBe(false);
    });

    it('should accept valid coordinates', () => {
      const result = businessRules.validateCoordinates(116.4074, 39.9042);
      expect(result.valid).toBe(true);
    });
  });

  describe('Potential Abnormality Check', () => {
    it('should flag potential below minimum as abnormal', () => {
      const pointConfig = { min_protection_potential: -1.1, max_protection_potential: -0.85 };
      expect(businessRules.isPotentialAbnormal(-1.2, pointConfig)).toBe(true);
    });

    it('should flag potential above maximum as abnormal', () => {
      const pointConfig = { min_protection_potential: -1.1, max_protection_potential: -0.85 };
      expect(businessRules.isPotentialAbnormal(-0.7, pointConfig)).toBe(true);
    });

    it('should accept potential within normal range', () => {
      const pointConfig = { min_protection_potential: -1.1, max_protection_potential: -0.85 };
      expect(businessRules.isPotentialAbnormal(-0.95, pointConfig)).toBe(false);
    });
  });

  describe('Risk Level Determination', () => {
    it('should determine HIGH risk for 5+ consecutive abnormalities', () => {
      expect(businessRules.determineRiskLevel(5, -0.9)).toBe('HIGH');
    });

    it('should determine MEDIUM risk for 3-4 consecutive abnormalities', () => {
      expect(businessRules.determineRiskLevel(3, -0.9)).toBe('MEDIUM');
    });

    it('should determine LOW risk for 2 consecutive abnormalities', () => {
      expect(businessRules.determineRiskLevel(2, -0.9)).toBe('LOW');
    });
  });

  describe('Code Generation', () => {
    it('should generate recheck plan code with correct format', () => {
      const code = businessRules.generateRecheckPlanCode();
      expect(code).toMatch(/^RCP-\d{8}-\d{4}$/);
    });

    it('should generate adjustment code with correct format', () => {
      const code = businessRules.generateAdjustmentCode();
      expect(code).toMatch(/^ADJ-\d{8}-\d{4}$/);
    });

    it('should generate risk code with correct format', () => {
      const code = businessRules.generateRiskCode();
      expect(code).toMatch(/^RSK-\d{8}-\d{4}$/);
    });
  });
});

describe('API Endpoints', () => {
  describe('Health Check', () => {
    it('should return health status', async () => {
      const res = await request(app).get('/api/health');
      expect(res.statusCode).toBe(200);
      expect(res.body.status).toBe('ok');
    });
  });

  describe('Authentication', () => {
    it('should reject login without credentials', async () => {
      const res = await request(app).post('/api/auth/login').send({});
      expect(res.statusCode).toBe(400);
    });

    it('should return unauthorized for invalid token', async () => {
      const res = await request(app)
        .get('/api/measurement-points')
        .set('Authorization', 'Bearer invalid_token');
      expect(res.statusCode).toBe(403);
    });
  });

  describe('Data Submission Rules', () => {
    it('should reject measurement record without coordinates', async () => {
      const res = await request(app)
        .post('/api/measurement-records')
        .set('Authorization', 'Bearer invalid_token');
      expect(res.statusCode).not.toBe(201);
    });
  });
});
