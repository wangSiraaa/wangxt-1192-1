const businessRules = require('../src/utils/businessRules');

console.log('=== 长输天然气管道阴极保护巡检系统 - 业务规则验证 ===\n');

let passed = 0;
let failed = 0;

function test(description, fn) {
  try {
    fn();
    console.log(`✅ PASS: ${description}`);
    passed++;
  } catch (error) {
    console.log(`❌ FAIL: ${description}`);
    console.log(`   错误: ${error.message}`);
    failed++;
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || '断言失败');
  }
}

console.log('--- 规则1: 测点坐标缺失不能提交 ---');
test('坐标缺失 - 经纬度都为null', () => {
  const result = businessRules.validateCoordinates(null, null);
  assert(result.valid === false, '应该返回无效');
  assert(result.errors.includes('测点经度坐标缺失'), '应该包含经度缺失错误');
  assert(result.errors.includes('测点纬度坐标缺失'), '应该包含纬度缺失错误');
});

test('坐标缺失 - 经度缺失', () => {
  const result = businessRules.validateCoordinates(null, 39.9042);
  assert(result.valid === false, '应该返回无效');
  assert(result.errors.includes('测点经度坐标缺失'), '应该包含经度缺失错误');
});

test('坐标缺失 - 纬度缺失', () => {
  const result = businessRules.validateCoordinates(116.4074, null);
  assert(result.valid === false, '应该返回无效');
  assert(result.errors.includes('测点纬度坐标缺失'), '应该包含纬度缺失错误');
});

test('坐标无效 - 经度超出范围', () => {
  const result = businessRules.validateCoordinates(200, 39.9042);
  assert(result.valid === false, '应该返回无效');
  assert(result.errors.includes('经度坐标超出有效范围'), '应该包含经度超出范围错误');
});

test('坐标无效 - 纬度超出范围', () => {
  const result = businessRules.validateCoordinates(116.4074, 100);
  assert(result.valid === false, '应该返回无效');
  assert(result.errors.includes('纬度坐标超出有效范围'), '应该包含纬度超出范围错误');
});

test('坐标有效 - 正常坐标', () => {
  const result = businessRules.validateCoordinates(116.4074, 39.9042);
  assert(result.valid === true, '应该返回有效');
  assert(result.errors.length === 0, '不应该有错误');
});

console.log('\n--- 规则2: 电位连续异常要生成复测计划 ---');
test('电位异常判断 - 低于最小值', () => {
  const pointConfig = { min_protection_potential: -1.1, max_protection_potential: -0.85 };
  assert(businessRules.isPotentialAbnormal(-1.2, pointConfig) === true, '-1.2V 应该判定为异常');
});

test('电位异常判断 - 高于最大值', () => {
  const pointConfig = { min_protection_potential: -1.1, max_protection_potential: -0.85 };
  assert(businessRules.isPotentialAbnormal(-0.7, pointConfig) === true, '-0.7V 应该判定为异常');
});

test('电位正常判断 - 在范围内', () => {
  const pointConfig = { min_protection_potential: -1.1, max_protection_potential: -0.85 };
  assert(businessRules.isPotentialAbnormal(-0.95, pointConfig) === false, '-0.95V 应该判定为正常');
});

test('电位异常判断 - 使用默认阈值', () => {
  assert(businessRules.isPotentialAbnormal(-1.2) === true, '-1.2V 应该判定为异常（默认阈值）');
  assert(businessRules.isPotentialAbnormal(-0.95) === false, '-0.95V 应该判定为正常（默认阈值）');
});

test('连续异常阈值 - 默认为2次', () => {
  assert(businessRules.CONSECUTIVE_ABNORMAL_THRESHOLD === 2, '连续异常阈值应该为2');
});

console.log('\n--- 规则3: 整流器调整后未复测不能关闭风险 ---');
test('风险等级判定 - 高风险', () => {
  assert(businessRules.determineRiskLevel(5, -0.9) === 'HIGH', '5次连续异常应为高风险');
  assert(businessRules.determineRiskLevel(3, -0.6) === 'HIGH', '电位-0.6V应为高风险');
  assert(businessRules.determineRiskLevel(3, -1.6) === 'HIGH', '电位-1.6V应为高风险');
});

test('风险等级判定 - 中风险', () => {
  assert(businessRules.determineRiskLevel(3, -0.9) === 'MEDIUM', '3次连续异常应为中风险');
  assert(businessRules.determineRiskLevel(4, -0.9) === 'MEDIUM', '4次连续异常应为中风险');
});

test('风险等级判定 - 低风险', () => {
  assert(businessRules.determineRiskLevel(2, -0.9) === 'LOW', '2次连续异常应为低风险');
});

console.log('\n--- 规则4: 业务编码生成 ---');
test('复测计划编码格式', () => {
  const code = businessRules.generateRecheckPlanCode();
  assert(code.match(/^RCP-\d{8}-\d{4}$/), `编码格式不正确: ${code}`);
});

test('调整记录编码格式', () => {
  const code = businessRules.generateAdjustmentCode();
  assert(code.match(/^ADJ-\d{8}-\d{4}$/), `编码格式不正确: ${code}`);
});

test('风险记录编码格式', () => {
  const code = businessRules.generateRiskCode();
  assert(code.match(/^RSK-\d{8}-\d{4}$/), `编码格式不正确: ${code}`);
});

console.log('\n--- 规则5: 保护电位阈值 ---');
test('默认保护电位范围', () => {
  assert(businessRules.POTENTIAL_THRESHOLDS.MIN === -1.1, '最小保护电位应为-1.1V');
  assert(businessRules.POTENTIAL_THRESHOLDS.MAX === -0.85, '最大保护电位应为-0.85V');
});

console.log('\n=== 验证结果 ===');
console.log(`通过: ${passed}`);
console.log(`失败: ${failed}`);
console.log(`总计: ${passed + failed}`);

if (failed > 0) {
  process.exit(1);
} else {
  console.log('\n🎉 所有业务规则验证通过！');
  process.exit(0);
}
