const api = require('../../utils/api.js');
const { formatDate, formatDateTime } = require('../../utils/util.js');

const NOTICES = [
  {
    icon: '公',
    tone: 'blue',
    text: '版本更新：卒防智控 v2.4.0 已上线，新增 AI 健康助手',
    action: 'changelog'
  },
  {
    icon: '智',
    tone: 'blue',
    text: 'AI 健康助手已上线：有健康方面的疑问，可以随时问我',
    action: 'ai'
  },
  {
    icon: '私',
    tone: 'teal',
    text: '隐私保护：您填写的健康信息仅用于风险评估，仅本人与授权管理员可查看',
    action: 'none'
  },
  {
    icon: '同',
    tone: 'orange',
    text: '数据同步：提交的评估会同步到医生端，方便后续查看',
    action: 'none'
  },
  {
    icon: '知',
    tone: 'teal',
    text: '健康知识、急救指南板块正在优化，即将上线，敬请期待',
    action: 'none'
  }
];

Page({
  data: {
    username: '',
    latest: null,
    latestRiskColor: '#2F80ED',
    notices: NOTICES,
    noticeIndex: 0,
    currentNotice: NOTICES[0],
    quickActions: [
      { key: 'assessment', label: '开始评估', icon: '评', color: 'blue' },
      { key: 'history', label: '历史记录', icon: '史', color: 'teal' },
      { key: 'health', label: '健康知识', icon: '知', color: 'orange' },
      { key: 'emergency', label: '急救指南', icon: '急', color: 'red' }
    ]
  },

  onShow() {
    if (!api.getToken()) {
      wx.reLaunch({ url: '/pages/login/login' });
      return;
    }

    const user = api.getUser();
    this.setData({
      username: user ? (user.displayName || user.username || '') : ''
    });
    getApp().trackUsage();
    this.startNoticeTicker();
    this.loadLatest();
  },

  onHide() {
    this.stopNoticeTicker();
  },

  onUnload() {
    this.stopNoticeTicker();
  },

  startNoticeTicker() {
    this.stopNoticeTicker();
    this.noticeTimer = setInterval(() => {
      const notices = this.data.notices;
      if (!notices.length) return;
      const nextIndex = (this.data.noticeIndex + 1) % notices.length;
      this.setData({
        noticeIndex: nextIndex,
        currentNotice: notices[nextIndex]
      });
    }, 6000);
  },

  stopNoticeTicker() {
    if (this.noticeTimer) {
      clearInterval(this.noticeTimer);
      this.noticeTimer = null;
    }
  },

  onNoticeTap() {
    const notice = this.data.currentNotice;
    if (!notice) return;
    if (notice.action === 'changelog') this.goChangelog();
    else if (notice.action === 'ai') this.goAi();
  },

  riskColor(level) {
    if (level === '高风险') return '#D32F2F';
    if (level === '中风险') return '#ED6C02';
    if (level === '低风险') return '#2E7D32';
    return '#2F80ED';
  },

  async loadLatest() {
    const cache = wx.getStorageSync('assessments_cache');
    const cached = Array.isArray(cache) ? cache : [];

    const pickLatest = (items) => {
      const map = new Map();
      (items || []).forEach((item) => {
        const key = item.id || `${item.patientName || ''}_${item.date || item.createdAt || ''}`;
        if (!map.has(key)) map.set(key, item);
      });

      const list = [...map.values()].map((item) => {
        const date = item.date || item.createdAt || '';
        return {
          ...item,
          date,
          dateShort: formatDate(date),
          dateTime: formatDateTime(date),
          riskFactors: Array.isArray(item.riskFactors) ? item.riskFactors : []
        };
      });
      list.sort((a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0));
      return list[0] || null;
    };

    try {
      const data = await api.listAssessments({ limit: 20 });
      // 接口成功时以接口为准，避免本机缓存里已删除的旧记录被重新显示
      const latest = pickLatest(data.items);
      this.setData({
        latest,
        latestRiskColor: latest ? this.riskColor(latest.riskLevel) : '#2F80ED'
      });
    } catch (err) {
      if (err.code === 'UNAUTHORIZED' || err.code === 'TOKEN_EXPIRED') {
        wx.reLaunch({ url: '/pages/login/login' });
        return;
      }
      const latest = pickLatest(cached);
      this.setData({
        latest,
        latestRiskColor: latest ? this.riskColor(latest.riskLevel) : '#2F80ED'
      });
    }
  },

  refreshLatest() {
    this.loadLatest();
    wx.showToast({ title: '已刷新', icon: 'none' });
  },

  async onPullDownRefresh() {
    await this.loadLatest();
    wx.stopPullDownRefresh();
  },

  onQuickAction(e) {
    const key = e.currentTarget.dataset.key;
    if (key === 'assessment') this.goAssessment();
    else if (key === 'history') this.goHistory();
    else if (key === 'health') this.goHealth();
    else if (key === 'emergency') this.goEmergency();
  },

  goAssessment() {
    wx.navigateTo({ url: '/pages/assessment/assessment' });
  },

  goHistory() {
    wx.navigateTo({ url: '/pages/history/history' });
  },

  goHealth() {
    wx.navigateTo({ url: '/pages/health/health' });
  },

  goEmergency() {
    wx.navigateTo({ url: '/pages/emergency/emergency' });
  },

  goAi() {
    wx.navigateTo({ url: '/pages/ai/ai' });
  },

  goFaq() {
    wx.navigateTo({ url: '/pages/faq/faq' });
  },

  goChangelog() {
    wx.navigateTo({ url: '/pages/changelog/changelog' });
  },

  goReport() {
    wx.switchTab({ url: '/pages/report/report' });
  }
});
