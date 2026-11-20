const api = require('../../utils/api.js');
const { formatDate } = require('../../utils/util.js');

Page({
  data: {
    loading: true,
    latest: null,
    latestRiskColor: '#2F80ED',
    trend: [],
    hasTrend: false,
    advice: '',
    error: ''
  },

  onShow() {
    this.loadReport();
  },

  requireToken() {
    if (!api.getToken()) {
      wx.reLaunch({ url: '/pages/login/login' });
      return false;
    }
    return true;
  },

  riskColor(level) {
    if (level === '高风险') return '#D32F2F';
    if (level === '中风险') return '#ED6C02';
    if (level === '低风险') return '#2E7D32';
    return '#2F80ED';
  },

  adviceFor(level) {
    if (level === '高风险') return '建议尽快到神经内科或卒中中心就诊，进行专业评估；同时控制血压、血糖、血脂，遵医嘱用药。';
    if (level === '中风险') return '建议 3-6 个月复测一次，重点控制血压、血糖、体重，戒烟限酒，保持规律运动。';
    return '继续保持健康生活方式，定期体检，关注血压、血糖、血脂变化。';
  },

  async loadReport() {
    if (!this.requireToken()) return;
    this.setData({ loading: true, error: '' });

    let items = [];
    try {
      const data = await api.listAssessments({ limit: 20 });
      items = data.items || [];
    } catch (err) {
      if (err.code === 'UNAUTHORIZED' || err.code === 'TOKEN_EXPIRED') {
        wx.reLaunch({ url: '/pages/login/login' });
        return;
      }
      const cache = wx.getStorageSync('assessments_cache');
      items = Array.isArray(cache) ? cache : [];
      this.setData({ error: '网络异常，显示本机缓存' });
    }

    items = items.map((item) => {
      const date = item.date || item.createdAt || '';
      return {
        ...item,
        date,
        dateShort: formatDate(date),
        riskFactors: Array.isArray(item.riskFactors) ? item.riskFactors : []
      };
    });

    items.sort((a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0));

    if (items.length === 0) {
      this.setData({ loading: false, latest: null, trend: [], hasTrend: false });
      return;
    }

    const latest = items[0];
    const trend = items.slice(0, 7).reverse().map((item) => {
      const prob = Number(item.probability) || 0;
      const bucket = Math.min(100, Math.max(10, Math.round(prob / 10) * 10));
      let colorClass = 'default';
      if (item.riskLevel === '高风险') colorClass = 'high';
      else if (item.riskLevel === '中风险') colorClass = 'medium';
      else if (item.riskLevel === '低风险') colorClass = 'low';
      return {
        id: item.id,
        date: formatDate(item.date).slice(5, 10),
        prob,
        widthClass: 'w' + bucket,
        colorClass
      };
    });

    this.setData({
      loading: false,
      latest,
      latestRiskColor: this.riskColor(latest.riskLevel),
      advice: this.adviceFor(latest.riskLevel),
      trend,
      hasTrend: trend.length > 1
    });
  },

  goAssessment() {
    wx.navigateTo({ url: '/pages/assessment/assessment' });
  },

  goHistory() {
    wx.navigateTo({ url: '/pages/history/history' });
  }
});
