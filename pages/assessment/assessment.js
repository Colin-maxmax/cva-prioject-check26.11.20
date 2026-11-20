const api = require('../../utils/api.js');
const rf = require('../../utils/rfModel.js');

const EMPTY_FORM = {
  patientName: '',
  age: '',
  gender: '',
  everMarried: '',
  workType: '',
  residenceType: '',
  education: '',
  monthlyIncome: '',
  medicalInsurance: '',
  hypertension: '0',
  diabetes: '0',
  heartDiseaseType: '0',
  heartDiseaseNote: '',
  strokeHistory: '0',
  tiaHistory: '0',
  strokeFamilyHistory: '0',
  hyperlipidemia: '0',
  overweight: '0',
  smoking: '0',
  lackExercise: '0',
  systolicBP: '',
  diastolicBP: '',
  avgGlucoseLevel: '',
  height: '',
  weight: '',
  drinking: '0',
  otherFamilyHistory: '0',
  dietaryHabits: []
};

Page({
  data: {
    formData: { ...EMPTY_FORM },
    genderOptions: ['男', '女'],
    maritalOptions: ['已婚', '未婚', '离异', '丧偶'],
    workTypeOptions: ['农民', '工人', '公职人员', '公司职员', '医疗卫生人员', '自媒体', '自由职业者', '个体户', '退休', '其他'],
    residenceOptions: ['城市', '农村'],
    educationOptions: ['小学及以下', '初中', '高中/中专', '大专/本科', '硕士及以上'],
    incomeOptions: ['2000元以下', '2000-3999元', '4000-5999元', '6000-7999元', '8000-9999元', '10000元以上'],
    insuranceOptions: ['自费', '全公费', '新型农村合作医疗', '城镇职工医疗保险', '城镇居民医疗保险'],
    familyHistoryOptions: ['无', '一级亲属', '二级亲属'],
    familyHistoryMap: { '0': '无', '1': '一级亲属', '2': '二级亲属' },
    heartDiseaseOptions: ['无心脏病', '房颤或心梗', '其他心脏病'],
    heartDiseaseMap: { '0': '无心脏病', '1': '房颤或心梗', '2': '其他心脏病' },
    dietaryOptions: [
      { name: '高盐', value: '高盐', checked: false },
      { name: '高油', value: '高油', checked: false },
      { name: '高糖', value: '高糖', checked: false },
      { name: '蔬菜不足', value: '蔬菜不足', checked: false },
      { name: '水果不足', value: '水果不足', checked: false },
      { name: '均衡', value: '均衡', checked: false }
    ],
    bmi: null,
    submitting: false
  },

  onShow() {
    if (!api.getToken()) {
      wx.reLaunch({ url: '/pages/login/login' });
      return;
    }
    this.loadProfiles();
  },

  // 按姓名缓存历史记录里的基本信息，供下次自动带出
  buildProfiles(items) {
    const map = {};
    const pick = (value, options) => (options.includes(value) ? value : '');
    (items || []).forEach((item) => {
      const name = (item.patientName || '').trim();
      if (!name || map[name]) return;
      map[name] = {
        age: item.age ? String(item.age) : '',
        gender: pick(item.gender, this.data.genderOptions),
        everMarried: pick(item.everMarried, this.data.maritalOptions),
        workType: pick(item.workType, this.data.workTypeOptions),
        residenceType: pick(item.residenceType, this.data.residenceOptions),
        education: pick(item.education, this.data.educationOptions),
        monthlyIncome: pick(item.monthlyIncome, this.data.incomeOptions)
      };
    });
    return map;
  },

  async loadProfiles() {
    this.profiles = {};
    const cache = wx.getStorageSync('assessments_cache');
    if (Array.isArray(cache)) {
      this.profiles = this.buildProfiles(cache);
    }
    try {
      const data = await api.listAssessments({ limit: 200 });
      this.profiles = Object.assign({}, this.profiles, this.buildProfiles(data.items));
    } catch (err) {
      // 离线时只用本机缓存，不打断填写
    }
    // 档案晚于姓名输入到达时，补一次带出
    const current = (this.data.formData.patientName || '').trim();
    if (current) this.tryAutofillBasic(current);
  },

  tryAutofillBasic(name) {
    const key = (name || '').trim();
    if (!key) {
      this.lastAutoName = '';
      return;
    }
    if (!this.profiles || this.lastAutoName === key) return;
    const profile = this.profiles[key];
    if (!profile) return;

    const fields = ['age', 'gender', 'everMarried', 'workType', 'residenceType', 'education', 'monthlyIncome'];
    const patch = {};
    fields.forEach((field) => {
      if (profile[field]) patch[`formData.${field}`] = profile[field];
    });
    if (Object.keys(patch).length === 0) return;

    this.lastAutoName = key;
    this.setData(patch);
    wx.showToast({ title: '已自动填写基本信息', icon: 'none' });
  },

  onInput(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [`formData.${field}`]: e.detail.value });
    if (field === 'patientName') this.tryAutofillBasic(e.detail.value);
    this.calculateBMI();
  },

  onPickerChange(e) {
    const field = e.currentTarget.dataset.field;
    const idx = Number(e.detail.value);
    let value;
    if (field === 'gender') value = this.data.genderOptions[idx];
    else if (field === 'everMarried') value = this.data.maritalOptions[idx];
    else if (field === 'workType') value = this.data.workTypeOptions[idx];
    else if (field === 'residenceType') value = this.data.residenceOptions[idx];
    else if (field === 'education') value = this.data.educationOptions[idx];
    else if (field === 'monthlyIncome') value = this.data.incomeOptions[idx];
    else if (field === 'medicalInsurance') value = this.data.insuranceOptions[idx];
    else if (field === 'heartDiseaseType') value = String(idx);
    else if (field === 'strokeFamilyHistory') value = String(idx);
    this.setData({ [`formData.${field}`]: value });
    if (field === 'heartDiseaseType' && value !== '2') {
      this.setData({ 'formData.heartDiseaseNote': '' });
    }
  },

  onSwitchChange(e) {
    const field = e.currentTarget.dataset.field;
    const value = e.detail.value ? '1' : '0';
    this.setData({ [`formData.${field}`]: value });
  },

  onDietaryChange(e) {
    const values = e.detail.value;
    const options = this.data.dietaryOptions.map(opt => ({
      ...opt,
      checked: values.includes(opt.value)
    }));
    this.setData({
      'formData.dietaryHabits': values,
      dietaryOptions: options
    });
  },

  calculateBMI() {
    const height = parseFloat(this.data.formData.height);
    const weight = parseFloat(this.data.formData.weight);
    if (height && weight && height > 0 && weight > 0) {
      const bmi = weight / ((height / 100) ** 2);
      this.setData({
        bmi: bmi.toFixed(1),
        'formData.overweight': bmi >= 24 ? '1' : '0'
      });
    } else {
      this.setData({ bmi: null });
    }
  },

  async onSubmit() {
    if (this.data.submitting) return;

    const data = this.data.formData;
    if (!data.patientName || !data.age || !data.gender || !data.systolicBP || !data.diastolicBP
      || !data.avgGlucoseLevel || !data.height || !data.weight) {
      wx.showToast({ title: '请填写姓名、年龄、性别、血压、血糖、身高体重', icon: 'none' });
      return;
    }

    if (!api.getToken()) {
      wx.showModal({
        title: '请先登录',
        content: '登录后才能提交评估',
        showCancel: false,
        success: () => wx.reLaunch({ url: '/pages/login/login' })
      });
      return;
    }

    // 前端随机森林模型计算风险（零延迟，后端直接存储，不再用加权规则重算）
    const rfResult = rf.predict(data);
    const risk = {
      riskLevel: rfResult.riskLevel,
      probability: Number(rfResult.probabilityPercent),
      riskFactors: rfResult.riskFactors,
      riskSource: 'randomForest'
    };

    const payload = {
      ...data,
      age: Number(data.age),
      systolicBP: Number(data.systolicBP),
      diastolicBP: Number(data.diastolicBP),
      avgGlucoseLevel: Number(data.avgGlucoseLevel),
      height: data.height === '' ? '' : Number(data.height),
      weight: data.weight === '' ? '' : Number(data.weight),
      notes: '',
      ...risk
    };

    this.setData({ submitting: true });
    wx.showLoading({ title: '提交中...', mask: true });

    try {
      const assessment = await api.createAssessment({
        data: payload,
        clientRequestId: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
      });

      // 本地留一份最近记录，断网时历史页仍可查看（用前端模型结果覆盖，后端未更新时也显示正确）
      const cache = wx.getStorageSync('assessments_cache') || [];
      if (Array.isArray(cache)) {
        cache.unshift({ ...assessment, ...risk });
        wx.setStorageSync('assessments_cache', cache.slice(0, 200));
      }

      wx.hideLoading();

      wx.navigateTo({
        url: `/pages/result/result?result=${encodeURIComponent(JSON.stringify(risk))}`
          + `&name=${encodeURIComponent(data.patientName)}`
          + `&age=${encodeURIComponent(data.age)}`
          + `&gender=${encodeURIComponent(data.gender)}`
      });
    } catch (err) {
      wx.hideLoading();
      if (err.code === 'UNAUTHORIZED' || err.code === 'TOKEN_EXPIRED') {
        wx.showModal({
          title: '登录已过期',
          content: '请重新登录后再提交',
          showCancel: false,
          success: () => wx.reLaunch({ url: '/pages/login/login' })
        });
        return;
      }
      wx.showModal({
        title: '提交失败',
        content: err.message || '网络异常，请稍后重试',
        showCancel: false
      });
    } finally {
      this.setData({ submitting: false });
    }
  }
});
