// 随机森林卒中风险预测（前端推理，零网络延迟）
// 模型数据见 rfModelData.js（200 棵树），由 data1.xlsx 训练的 RandomForest 导出。
const { trees } = require('./rfModelData.js');

// 分类变量编码（对应训练数据 data1.xlsx 的编码字典）
const EDUCATION = { '小学及以下': 1, '初中': 2, '高中/中专': 3, '大专/本科': 4, '硕士及以上': 5 };
const WORK_TYPE = { '农民': 1, '工人': 2, '公职人员': 3, '公司职员': 4, '医疗卫生人员': 5, '自媒体': 6, '自由职业者': 7, '个体户': 8, '退休': 9, '其他': 10 };
const MARITAL = { '已婚': 1, '未婚': 2, '离异': 3, '丧偶': 4 };
const INCOME = { '2000元以下': 1, '2000-3999元': 2, '4000-5999元': 3, '6000-7999元': 4, '8000-9999元': 5, '10000元以上': 6 };
const RESIDENCE = { '城市': 2, '农村': 1 };

// 特征索引 -> 中文标签（仅病史/生活方式特征用于展示风险因素）
const FACTOR_LABELS = [
  '', '', '', '', '', '',
  '高血压病史', '糖尿病', '血脂异常', '',
  '脑卒中家族史', '心脏病史', '超重或肥胖（BMI≥24）', '吸烟',
  '', '运动缺乏', '', '中风/短暂性脑缺血病史', ''
];

function ageBin(age) {
  age = Number(age);
  if (!age || age < 40) return 1; // 训练集为 40+ 人群，40 以下归入最低档
  if (age < 50) return 1;
  if (age < 60) return 2;
  if (age < 70) return 3;
  if (age < 80) return 4;
  return 5;
}

function to01(v) {
  return (v === '1' || v === 1 || v === true) ? 1 : 0;
}

function featuresFromForm(f) {
  f = f || {};
  const glucose = Number(f.avgGlucoseLevel);
  const height = Number(f.height);
  const weight = Number(f.weight);
  const bmi = (height && weight && height > 0 && weight > 0) ? weight / ((height / 100) ** 2) : null;
  const lackExercise = (to01(f.lackExercise) === 1
    || f.exerciseFrequency === '无运动'
    || f.exerciseFrequency === '少量运动') ? 1 : 0;
  const strokeTia = (to01(f.strokeHistory) === 1 || to01(f.tiaHistory) === 1) ? 1 : 0;

  return [
    ageBin(f.age),                                      // 0 年龄
    EDUCATION[f.education] || 1,                        // 1 学历
    WORK_TYPE[f.workType] || 10,                        // 2 职业
    MARITAL[f.everMarried] || 1,                        // 3 婚姻状况
    INCOME[f.monthlyIncome] || 1,                       // 4 家庭人均月收入
    RESIDENCE[f.residenceType] || 1,                    // 5 居住地
    to01(f.hypertension),                               // 6 高血压
    (to01(f.diabetes) === 1 || glucose >= 7.0) ? 1 : 0, // 7 糖尿病（病史或空腹血糖≥7.0）
    to01(f.hyperlipidemia),                             // 8 血脂异常
    0,                                                  // 9 高尿酸血症（已从问卷移除）
    (f.strokeFamilyHistory && f.strokeFamilyHistory !== '0') ? 1 : 0, // 10 亲人中风
    (f.heartDiseaseType && f.heartDiseaseType !== '0') ? 1 : 0,       // 11 心脏病
    (to01(f.overweight) === 1 || (bmi != null && bmi >= 24)) ? 1 : 0, // 12 超重或肥胖（BMI≥24）
    (to01(f.smoking) === 1 || f.smokingStatus === '目前吸烟') ? 1 : 0, // 13 吸烟
    0,                                                  // 14 心理疾病（已从问卷移除）
    lackExercise,                                       // 15 运动缺乏
    0,                                                  // 16 贫血（已从问卷移除）
    strokeTia,                                          // 17 中风/TIA
    0                                                   // 18 其他
  ];
}

function predictProba(features) {
  let sum = 0;
  for (let i = 0; i < trees.length; i++) {
    const t = trees[i];
    let node = 0;
    while (t.f[node] >= 0) {
      node = (features[t.f[node]] <= t.t[node]) ? t.l[node] : t.r[node];
    }
    sum += t.v[node];
  }
  return sum / trees.length;
}

// 风险等级阈值（可按临床意见调整）
function riskLevel(p) {
  if (p >= 0.40) return '高风险';
  if (p >= 0.10) return '中风险';
  return '低风险';
}

function riskFactors(features) {
  const out = [];
  for (let i = 6; i <= 17; i++) {
    if (features[i] === 1 && FACTOR_LABELS[i]) out.push(FACTOR_LABELS[i]);
  }
  return out;
}

function predict(formData) {
  const features = featuresFromForm(formData);
  const probability = predictProba(features);
  return {
    probability: probability,
    probabilityPercent: (probability * 100).toFixed(1),
    riskLevel: riskLevel(probability),
    riskFactors: riskFactors(features),
    features: features
  };
}

module.exports = {
  predict: predict,
  predictProba: predictProba,
  featuresFromForm: featuresFromForm
};
