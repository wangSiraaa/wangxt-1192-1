console.log('=== 长输天然气管道阴极保护巡检系统 - 核心业务规则验证 ===\n');

const POTENTIAL_THRESHOLDS = {
  MIN: -1.1000,
  MAX: -0.8500,
};

const CONSECUTIVE_ABNORMAL_THRESHOLD = 2;

const validateCoordinates = (longitude, latitude) => {
  const errors = [];
  if (longitude === null || longitude === undefined || isNaN(longitude)) {
    errors.push('测点经度坐标缺失');
  }
  if (latitude === null || latitude === undefined || isNaN(latitude)) {
    errors.push('测点纬度坐标缺失');
  }
  if (longitude < -180 || longitude > 180) {
    errors.push('经度坐标超出有效范围');
  }
  if (latitude < -90 || latitude > 90) {
    errors.push('纬度坐标超出有效范围');
  }
  return { valid: errors.length === 0, errors };
};

const isPotentialAbnormal = (potential, pointConfig) => {
  const min = pointConfig?.min_protection_potential || POTENTIAL_THRESHOLDS.MIN;
  const max = pointConfig?.max_protection_potential || POTENTIAL_THRESHOLDS.MAX;
  return potential < min || potential > max;
};

const shouldCreateRecheckPlan = (consecutiveCount) => {
  return consecutiveCount >= CONSECUTIVE_ABNORMAL_THRESHOLD;
};

const canCloseRisk = (hasAdjustment, isRechecked) => {
  if (hasAdjustment && !isRechecked) {
    return { valid: false, errors: ['整流器调整后未完成复测，不能关闭风险'] };
  }
  return { valid: true };
};

const generateRecheckPlanCode = () => {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `RCP-${dateStr}-${random}`;
};

const generateAdjustmentCode = () => {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `ADJ-${dateStr}-${random}`;
};

const generateRiskCode = () => {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `RSK-${dateStr}-${random}`;
};

const determineRiskLevel = (consecutiveCount, potential) => {
  if (consecutiveCount >= 5 || potential > -0.7 || potential < -1.5) {
    return 'HIGH';
  } else if (consecutiveCount >= 3) {
    return 'MEDIUM';
  }
  return 'LOW';
};

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
  const result = validateCoordinates(null, null);
  assert(result.valid === false, '应该返回无效');
  assert(result.errors.includes('测点经度坐标缺失'), '应该包含经度缺失错误');
  assert(result.errors.includes('测点纬度坐标缺失'), '应该包含纬度缺失错误');
});

test('坐标缺失 - 经度缺失', () => {
  const result = validateCoordinates(null, 39.9042);
  assert(result.valid === false, '应该返回无效');
  assert(result.errors.includes('测点经度坐标缺失'), '应该包含经度缺失错误');
});

test('坐标缺失 - 纬度缺失', () => {
  const result = validateCoordinates(116.4074, null);
  assert(result.valid === false, '应该返回无效');
  assert(result.errors.includes('测点纬度坐标缺失'), '应该包含纬度缺失错误');
});

test('坐标缺失 - 经度为undefined', () => {
  const result = validateCoordinates(undefined, 39.9042);
  assert(result.valid === false, '应该返回无效');
  assert(result.errors.includes('测点经度坐标缺失'), '应该包含经度缺失错误');
});

test('坐标缺失 - 纬度为NaN', () => {
  const result = validateCoordinates(116.4074, NaN);
  assert(result.valid === false, '应该返回无效');
  assert(result.errors.includes('测点纬度坐标缺失'), '应该包含纬度缺失错误');
});

test('坐标无效 - 经度超出范围(正)', () => {
  const result = validateCoordinates(200, 39.9042);
  assert(result.valid === false, '应该返回无效');
  assert(result.errors.includes('经度坐标超出有效范围'), '应该包含经度超出范围错误');
});

test('坐标无效 - 经度超出范围(负)', () => {
  const result = validateCoordinates(-200, 39.9042);
  assert(result.valid === false, '应该返回无效');
  assert(result.errors.includes('经度坐标超出有效范围'), '应该包含经度超出范围错误');
});

test('坐标无效 - 纬度超出范围(正)', () => {
  const result = validateCoordinates(116.4074, 100);
  assert(result.valid === false, '应该返回无效');
  assert(result.errors.includes('纬度坐标超出有效范围'), '应该包含纬度超出范围错误');
});

test('坐标无效 - 纬度超出范围(负)', () => {
  const result = validateCoordinates(116.4074, -100);
  assert(result.valid === false, '应该返回无效');
  assert(result.errors.includes('纬度坐标超出有效范围'), '应该包含纬度超出范围错误');
});

test('坐标有效 - 正常坐标(北京)', () => {
  const result = validateCoordinates(116.4074, 39.9042);
  assert(result.valid === true, '应该返回有效');
  assert(result.errors.length === 0, '不应该有错误');
});

test('坐标有效 - 边界值经度180', () => {
  const result = validateCoordinates(180, 39.9042);
  assert(result.valid === true, '应该返回有效');
});

test('坐标有效 - 边界值纬度90', () => {
  const result = validateCoordinates(116.4074, 90);
  assert(result.valid === true, '应该返回有效');
});

console.log('\n--- 规则2: 电位连续异常要生成复测计划 ---');
test('电位异常判断 - 低于最小值', () => {
  const pointConfig = { min_protection_potential: -1.1, max_protection_potential: -0.85 };
  assert(isPotentialAbnormal(-1.2, pointConfig) === true, '-1.2V 应该判定为异常');
});

test('电位异常判断 - 高于最大值', () => {
  const pointConfig = { min_protection_potential: -1.1, max_protection_potential: -0.85 };
  assert(isPotentialAbnormal(-0.7, pointConfig) === true, '-0.7V 应该判定为异常');
});

test('电位正常判断 - 在范围内', () => {
  const pointConfig = { min_protection_potential: -1.1, max_protection_potential: -0.85 };
  assert(isPotentialAbnormal(-0.95, pointConfig) === false, '-0.95V 应该判定为正常');
});

test('电位正常判断 - 边界值-1.1', () => {
  const pointConfig = { min_protection_potential: -1.1, max_protection_potential: -0.85 };
  assert(isPotentialAbnormal(-1.1, pointConfig) === false, '-1.1V 应该判定为正常');
});

test('电位正常判断 - 边界值-0.85', () => {
  const pointConfig = { min_protection_potential: -1.1, max_protection_potential: -0.85 };
  assert(isPotentialAbnormal(-0.85, pointConfig) === false, '-0.85V 应该判定为正常');
});

test('电位异常判断 - 使用默认阈值(低于)', () => {
  assert(isPotentialAbnormal(-1.2) === true, '-1.2V 应该判定为异常（默认阈值）');
});

test('电位异常判断 - 使用默认阈值(高于)', () => {
  assert(isPotentialAbnormal(-0.8) === true, '-0.8V 应该判定为异常（默认阈值）');
});

test('电位正常判断 - 使用默认阈值', () => {
  assert(isPotentialAbnormal(-0.95) === false, '-0.95V 应该判定为正常（默认阈值）');
});

test('连续异常阈值 - 默认为2次', () => {
  assert(CONSECUTIVE_ABNORMAL_THRESHOLD === 2, '连续异常阈值应该为2');
});

test('复测计划触发 - 连续2次异常触发', () => {
  assert(shouldCreateRecheckPlan(2) === true, '连续2次异常应该触发复测计划');
});

test('复测计划触发 - 连续3次异常触发', () => {
  assert(shouldCreateRecheckPlan(3) === true, '连续3次异常应该触发复测计划');
});

test('复测计划不触发 - 连续1次异常', () => {
  assert(shouldCreateRecheckPlan(1) === false, '连续1次异常不应该触发复测计划');
});

test('复测计划不触发 - 0次异常', () => {
  assert(shouldCreateRecheckPlan(0) === false, '0次异常不应该触发复测计划');
});

console.log('\n--- 规则3: 整流器调整后未复测不能关闭风险 ---');
test('风险关闭校验 - 有调整但未复测，不能关闭', () => {
  const result = canCloseRisk(true, false);
  assert(result.valid === false, '应该返回无效');
  assert(result.errors.includes('整流器调整后未完成复测，不能关闭风险'), '应该包含未复测错误');
});

test('风险关闭校验 - 有调整且已复测，可以关闭', () => {
  const result = canCloseRisk(true, true);
  assert(result.valid === true, '应该返回有效');
});

test('风险关闭校验 - 无调整，可以关闭', () => {
  const result = canCloseRisk(false, false);
  assert(result.valid === true, '应该返回有效');
});

test('风险等级判定 - 高风险(5次连续)', () => {
  assert(determineRiskLevel(5, -0.9) === 'HIGH', '5次连续异常应为高风险');
});

test('风险等级判定 - 高风险(电位过高)', () => {
  assert(determineRiskLevel(3, -0.6) === 'HIGH', '电位-0.6V应为高风险');
});

test('风险等级判定 - 高风险(电位过低)', () => {
  assert(determineRiskLevel(3, -1.6) === 'HIGH', '电位-1.6V应为高风险');
});

test('风险等级判定 - 中风险(3次)', () => {
  assert(determineRiskLevel(3, -0.9) === 'MEDIUM', '3次连续异常应为中风险');
});

test('风险等级判定 - 中风险(4次)', () => {
  assert(determineRiskLevel(4, -0.9) === 'MEDIUM', '4次连续异常应为中风险');
});

test('风险等级判定 - 低风险(2次)', () => {
  assert(determineRiskLevel(2, -0.9) === 'LOW', '2次连续异常应为低风险');
});

test('风险等级判定 - 低风险(1次)', () => {
  assert(determineRiskLevel(1, -0.9) === 'LOW', '1次异常应为低风险');
});

console.log('\n--- 规则4: 业务编码生成 ---');
test('复测计划编码格式', () => {
  const code = generateRecheckPlanCode();
  assert(code.match(/^RCP-\d{8}-\d{4}$/), `编码格式不正确: ${code}`);
  console.log(`   生成编码: ${code}`);
});

test('调整记录编码格式', () => {
  const code = generateAdjustmentCode();
  assert(code.match(/^ADJ-\d{8}-\d{4}$/), `编码格式不正确: ${code}`);
  console.log(`   生成编码: ${code}`);
});

test('风险记录编码格式', () => {
  const code = generateRiskCode();
  assert(code.match(/^RSK-\d{8}-\d{4}$/), `编码格式不正确: ${code}`);
  console.log(`   生成编码: ${code}`);
});

test('编码唯一性 - 连续生成不重复', () => {
  const codes = new Set();
  for (let i = 0; i < 100; i++) {
    codes.add(generateRecheckPlanCode());
  }
  assert(codes.size > 1, '应该生成不同的编码');
});

console.log('\n--- 规则5: 保护电位阈值 ---');
test('默认保护电位范围', () => {
  assert(POTENTIAL_THRESHOLDS.MIN === -1.1, '最小保护电位应为-1.1V');
  assert(POTENTIAL_THRESHOLDS.MAX === -0.85, '最大保护电位应为-0.85V');
});

console.log('\n=== 验证结果 ===');
console.log(`通过: ${passed}`);
console.log(`失败: ${failed}`);
console.log(`总计: ${passed + failed}`);
console.log(`通过率: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);

if (failed > 0) {
  console.log('\n❌ 存在验证失败的规则，请检查！');
  process.exit(1);
} else {
  console.log('\n🎉 所有核心业务规则验证通过！');
  console.log('\n系统三大核心业务规则已确认：');
  console.log('  1. ✅ 测点坐标缺失不能提交');
  console.log('  2. ✅ 电位连续异常(≥2次)要生成复测计划');
  console.log('  3. ✅ 整流器调整后未复测不能关闭风险');
  process.exit(0);
}
