CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    real_name VARCHAR(100) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('INSPECTOR', 'ENGINEER', 'DISPATCHER')),
    phone VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE rectifiers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    location TEXT,
    longitude DECIMAL(15,10),
    latitude DECIMAL(15,10),
    voltage_setting DECIMAL(10,2),
    current_setting DECIMAL(10,2),
    status VARCHAR(20) DEFAULT 'NORMAL',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE measurement_points (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    pipeline_segment VARCHAR(100),
    longitude DECIMAL(15,10) NOT NULL,
    latitude DECIMAL(15,10) NOT NULL,
    rectifier_id UUID REFERENCES rectifiers(id),
    min_protection_potential DECIMAL(10,4) DEFAULT -1.1000,
    max_protection_potential DECIMAL(10,4) DEFAULT -0.8500,
    status VARCHAR(20) DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE measurement_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    point_id UUID REFERENCES measurement_points(id) NOT NULL,
    inspector_id UUID REFERENCES users(id) NOT NULL,
    measure_time TIMESTAMP NOT NULL,
    longitude DECIMAL(15,10) NOT NULL,
    latitude DECIMAL(15,10) NOT NULL,
    protection_potential DECIMAL(10,4) NOT NULL,
    soil_resistivity DECIMAL(10,2),
    natural_potential DECIMAL(10,4),
    temperature DECIMAL(5,2),
    weather VARCHAR(50),
    notes TEXT,
    is_abnormal BOOLEAN DEFAULT FALSE,
    abnormal_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE recheck_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plan_code VARCHAR(50) UNIQUE NOT NULL,
    point_id UUID REFERENCES measurement_points(id) NOT NULL,
    trigger_record_id UUID REFERENCES measurement_records(id),
    abnormal_count INTEGER NOT NULL DEFAULT 1,
    planned_time TIMESTAMP NOT NULL,
    assignee_id UUID REFERENCES users(id),
    status VARCHAR(20) DEFAULT 'PENDING',
    priority VARCHAR(20) DEFAULT 'MEDIUM',
    description TEXT,
    recheck_result TEXT,
    recheck_time TIMESTAMP,
    rechecker_id UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE rectifier_adjustments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    adjustment_code VARCHAR(50) UNIQUE NOT NULL,
    rectifier_id UUID REFERENCES rectifiers(id) NOT NULL,
    point_id UUID REFERENCES measurement_points(id),
    operator_id UUID REFERENCES users(id) NOT NULL,
    adjust_time TIMESTAMP NOT NULL,
    old_voltage DECIMAL(10,2),
    new_voltage DECIMAL(10,2),
    old_current DECIMAL(10,2),
    new_current DECIMAL(10,2),
    reason TEXT NOT NULL,
    is_rechecked BOOLEAN DEFAULT FALSE,
    recheck_record_id UUID REFERENCES measurement_records(id),
    status VARCHAR(20) DEFAULT 'PENDING',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE risks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    risk_code VARCHAR(50) UNIQUE NOT NULL,
    point_id UUID REFERENCES measurement_points(id) NOT NULL,
    rectifier_adjustment_id UUID REFERENCES rectifier_adjustments(id),
    risk_level VARCHAR(20) NOT NULL,
    description TEXT,
    status VARCHAR(20) DEFAULT 'OPEN',
    detected_time TIMESTAMP NOT NULL,
    closed_time TIMESTAMP,
    closer_id UUID REFERENCES users(id),
    close_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE map_layers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    layer_name VARCHAR(100) NOT NULL,
    layer_type VARCHAR(50) NOT NULL,
    data_source TEXT,
    style_config JSONB,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_measurement_records_point_time ON measurement_records(point_id, measure_time DESC);
CREATE INDEX idx_measurement_records_abnormal ON measurement_records(is_abnormal) WHERE is_abnormal = TRUE;
CREATE INDEX idx_recheck_plans_status ON recheck_plans(status);
CREATE INDEX idx_rectifier_adjustments_status ON rectifier_adjustments(status);
CREATE INDEX idx_risks_status ON risks(status);

INSERT INTO users (username, password, real_name, role, phone) VALUES
('inspector01', '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', '张三', 'INSPECTOR', '13800138001'),
('engineer01', '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', '李四', 'ENGINEER', '13800138002'),
('dispatcher01', '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', '王五', 'DISPATCHER', '13800138003');

INSERT INTO rectifiers (code, name, location, longitude, latitude, voltage_setting, current_setting) VALUES
('REC-001', '1号整流器', '东段首站', 116.4074, 39.9042, 2.50, 10.00),
('REC-002', '2号整流器', '中段1号阀室', 116.5074, 39.8542, 2.80, 12.50),
('REC-003', '3号整流器', '西段末站', 116.6074, 39.8042, 2.60, 11.00);

INSERT INTO measurement_points (code, name, pipeline_segment, longitude, latitude, rectifier_id)
SELECT 'P-001', '测试桩001', '东段K0-K10', 116.4174, 39.9142, id FROM rectifiers WHERE code = 'REC-001'
UNION ALL SELECT 'P-002', '测试桩002', '东段K0-K10', 116.4274, 39.9242, id FROM rectifiers WHERE code = 'REC-001'
UNION ALL SELECT 'P-003', '测试桩003', '中段K10-K20', 116.5174, 39.8642, id FROM rectifiers WHERE code = 'REC-002'
UNION ALL SELECT 'P-004', '测试桩004', '中段K10-K20', 116.5274, 39.8742, id FROM rectifiers WHERE code = 'REC-002'
UNION ALL SELECT 'P-005', '测试桩005', '西段K20-K30', 116.6174, 39.8142, id FROM rectifiers WHERE code = 'REC-003';

INSERT INTO map_layers (layer_name, layer_type, data_source, style_config) VALUES
('管道中心线', 'pipeline', 'internal://pipeline/centerline', '{"color": "#2563eb", "width": 4}'),
('阴极保护测试桩', 'point', 'internal://measurement/points', '{"color": "#16a34a", "radius": 6}'),
('整流器', 'rectifier', 'internal://rectifiers', '{"color": "#dc2626", "radius": 8}');
