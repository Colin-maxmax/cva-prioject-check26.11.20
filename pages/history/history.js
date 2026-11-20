const api = require('../../utils/api.js');
const xlsx = require('../../utils/xlsx.js');
const tts = require('../../utils/tts.js');
const report = require('../../utils/report.js');
const { formatDate, formatDateTime } = require('../../utils/util.js');

Page({
  data: {
    assessments: [],
    filtered: [],
    loading: false,
    offline: false,
    legacyCount: 0,
    canImportLegacy: true,
    filter: '全部',
    filters: ['全部', '高风险', '中风险', '低风险'],
    total: 0,
    highCount: 0,
    detail: null,
    showDetail: false,
    speaking: false,
    detailAdvice: ''
  },

  onShow() {
    this.loadHistory();
  },

  requireToken() {
    if (!api.getToken()) {
      wx.reLaunch({ url: '/pages/login/login' });
      return false;
    }
    return true;
  },

  riskTone(level) {
    if (level === '高风险') return 'high';
    if (level === '中风险') return 'medium';
    if (level === '低风险') return 'low';
    return 'default';
  },

  normalizeItem(item) {
    const date = item.date || item.createdAt || '';
    const isCloud = item.ownerId != null
      || item.source === 'miniprogram'
      || item.source === 'web';
    return {
      ...item,
      date,
      dateShort: formatDate(date),
      dateTime: formatDateTime(date),
      riskTone: this.riskTone(item.riskLevel),
      riskFactors: Array.isArray(item.riskFactors) ? item.riskFactors : [],
      isCloud,
      sourceLabel: item.source === 'miniprogram'
        ? '小程序'
        : (item.source === 'web' ? '网站' : (isCloud ? '云端' : '本机')),
      sourceClass: item.source === 'miniprogram'
        ? 'mp'
        : (item.source === 'web' ? 'web' : (isCloud ? 'web' : 'local'))
    };
  },

  sortByDate(list) {
    return list.slice().sort((a, b) => {
      return (Date.parse(b.date || b.createdAt) || 0) - (Date.parse(a.date || a.createdAt) || 0);
    });
  },

  applyFilter(list, filter) {
    if (filter === '全部') return list;
    return list.filter((item) => item.riskLevel === filter);
  },

  commitList(list, extra) {
    const total = list.length;
    const highCount = list.filter((item) => item.riskLevel === '高风险').length;
    const filtered = this.applyFilter(list, this.data.filter);
    this.setData({
      assessments: list,
      filtered,
      total,
      highCount,
      ...(extra || {})
    });
  },

  async loadHistory() {
    if (!this.requireToken()) return;
    if (this.data.loading) return;
    this.setData({ loading: true });

    try {
      const data = await api.listAssessments({ limit: 200 });
      const list = this.sortByDate((data.items || []).map((item) => this.normalizeItem(item)));
      wx.setStorageSync('assessments_cache', list);

      const legacyLocal = wx.getStorageSync('assessments');
      const legacyCount = Array.isArray(legacyLocal) ? legacyLocal.length : 0;
      this.commitList(list, {
        offline: false,
        legacyCount,
        canImportLegacy: api.getLoginType() !== 'account'
      });
    } catch (err) {
      if (err.code === 'UNAUTHORIZED' || err.code === 'TOKEN_EXPIRED') {
        wx.reLaunch({ url: '/pages/login/login' });
        return;
      }

      const cache = wx.getStorageSync('assessments_cache');
      const legacy = wx.getStorageSync('assessments');
      const rawList = Array.isArray(cache) && cache.length > 0
        ? cache
        : (Array.isArray(legacy) ? legacy : []);
      const list = this.sortByDate(rawList.map((item) => this.normalizeItem(item)));

      this.commitList(list, {
        offline: true,
        legacyCount: Array.isArray(legacy) ? legacy.length : 0,
        canImportLegacy: api.getLoginType() !== 'account'
      });

      if (err.code !== 'NOT_CONFIGURED') {
        wx.showToast({ title: '网络异常，显示本机记录', icon: 'none' });
      }
    } finally {
      this.setData({ loading: false });
    }
  },

  setFilter(e) {
    const level = e.currentTarget.dataset.level;
    this.setData({
      filter: level,
      filtered: this.applyFilter(this.data.assessments, level)
    });
  },

  viewDetail(e) {
    const index = e.currentTarget.dataset.index;
    const record = this.data.filtered[index];
    if (!record) return;
    this.setData({
      detail: record,
      showDetail: true,
      speaking: false,
      detailAdvice: this.adviceFor(record.riskLevel)
    });
  },

  closeDetail() {
    tts.stop();
    this.setData({ showDetail: false, speaking: false, detailAdvice: '' });
  },

  adviceFor(level) {
    if (level === '高风险') return '建议尽快到神经内科或卒中中心就诊，进行专业评估；同时控制血压、血糖、血脂，遵医嘱用药。';
    if (level === '中风险') return '建议 3-6 个月复测一次，重点控制血压、血糖、体重，戒烟限酒，保持规律运动。';
    return '继续保持健康生活方式，定期体检，关注血压、血糖、血脂变化。';
  },

  buildDetailSpeakText() {
    const d = this.data.detail;
    if (!d) return '';
    const factors = (d.riskFactors || []).join('、') || '未发现明显风险因素';
    return `${d.patientName || '患者'}，${d.age ? d.age + '岁' : ''}${d.gender ? '，' + d.gender + '性' : ''}。`
      + `评估结果：${d.riskLevel || '未分级'}，患病概率 ${d.probability || '--'}%。`
      + `主要风险因素：${factors}。${this.adviceFor(d.riskLevel)}`;
  },

  speakDetail() {
    if (this.data.speaking) {
      tts.stop();
      this.setData({ speaking: false });
      return;
    }
    this.setData({ speaking: true });
    tts.speak(this.buildDetailSpeakText(), {
      onEnd: () => this.setData({ speaking: false })
    }).catch((err) => {
      this.setData({ speaking: false });
      wx.showModal({
        title: '播报失败',
        content: err.message || '播报失败',
        showCancel: false
      });
    });
  },

  async saveDetailReport() {
    const d = this.data.detail;
    if (!d) return;

    wx.showLoading({ title: '生成中...', mask: true });
    try {
      const filePath = await report.buildReportImage({
        name: d.patientName,
        age: d.age,
        gender: d.gender,
        riskLevel: d.riskLevel,
        probability: d.probability,
        riskFactors: d.riskFactors,
        advice: this.adviceFor(d.riskLevel),
        date: d.dateTime || d.dateShort
      });
      wx.hideLoading();
      await this.persistImage(filePath);
    } catch (err) {
      wx.hideLoading();
      wx.showToast({ title: err.message || '生成失败', icon: 'none' });
    }
  },

  async persistImage(filePath) {
    try {
      await report.saveToAlbum(filePath);
      wx.showToast({ title: '已保存到相册', icon: 'success' });
    } catch (err) {
      const msg = (err && err.errMsg) || '';
      if (msg.indexOf('auth') !== -1 || msg.indexOf('deny') !== -1) {
        wx.showModal({
          title: '需要相册权限',
          content: '保存报告图片需要访问相册，请在设置中允许。',
          confirmText: '去设置',
          success: (res) => { if (res.confirm) wx.openSetting(); }
        });
      } else {
        wx.showToast({ title: '保存失败', icon: 'none' });
      }
    }
  },

  onHide() {
    tts.stop();
  },

  onUnload() {
    tts.stop();
  },

  noop() {},

  deleteRecord(e) {
    const index = e.currentTarget.dataset.index;
    const record = this.data.filtered[index];
    this.confirmDelete(record);
  },

  deleteDetail() {
    this.confirmDelete(this.data.detail);
  },

  confirmDelete(record) {
    if (!record) return;

    wx.showModal({
      title: '删除记录',
      content: `确定删除 ${record.patientName || '这条'} 的评估记录吗？删除后无法恢复。`,
      success: async (res) => {
        if (!res.confirm) return;

        wx.showLoading({ title: '删除中...', mask: true });
        try {
          if (!record.isCloud) {
            const legacy = wx.getStorageSync('assessments');
            if (Array.isArray(legacy)) {
              const kept = legacy.filter((item) => {
                const sameId = record.id != null && String(item.id) === String(record.id);
                const sameFallback = record.id == null
                  && item.patientName === record.patientName
                  && (item.date || '') === (record.date || '');
                return !(sameId || sameFallback);
              });
              wx.setStorageSync('assessments', kept);
            }
          } else {
            await api.deleteAssessment({ id: record.id });
          }

          const cache = wx.getStorageSync('assessments_cache');
          if (Array.isArray(cache)) {
            const kept = cache.filter((item) => {
              if (record.id != null) return String(item.id) !== String(record.id);
              return !(item.patientName === record.patientName && (item.date || '') === (record.date || ''));
            });
            wx.setStorageSync('assessments_cache', kept);
          }

          wx.hideLoading();
          this.setData({ showDetail: false, detail: null });
          await this.loadHistory();
          wx.showToast({ title: '已删除', icon: 'success' });
        } catch (err) {
          wx.hideLoading();
          if (err.code === 'UNAUTHORIZED' || err.code === 'TOKEN_EXPIRED') {
            wx.reLaunch({ url: '/pages/login/login' });
            return;
          }
          wx.showModal({
            title: '删除失败',
            content: err.message || '网络异常，请稍后重试',
            showCancel: false
          });
        }
      }
    });
  },

  goAssessment() {
    wx.navigateTo({ url: '/pages/assessment/assessment' });
  },

  formatExportDate(d) {
    return formatDateTime(d);
  },

  exportExcel() {
    const rows = this.data.assessments || [];
    if (rows.length === 0) {
      wx.showToast({ title: '没有可导出的记录', icon: 'none' });
      return;
    }

    const yn = (v) => (v === '1' || v === 1 || v === true) ? '是'
      : ((v === '0' || v === 0 || v === false) ? '否' : (v == null ? '' : v));
    const join = (v) => (Array.isArray(v) ? v.join('、') : (v == null ? '' : v));
    const heartLabel = (v) => ({ '1': '房颤或心梗', '2': '其他心脏病', '0': '无心脏病' }[v] || (v == null ? '' : v));
    const familyLabel = (v) => ({ '1': '一级亲属', '2': '二级亲属', '0': '无' }[v] || (v == null ? '' : v));
    const num = (v) => (v == null || v === '') ? '' : v;

    const headers = [
      '姓名', '年龄', '性别', '婚姻状况', '职业类型', '居住地', '文化程度', '月收入', '医疗费用承担方式',
      '收缩压(mmHg)', '舒张压(mmHg)', '空腹血糖(mmol/L)', '身高(cm)', '体重(kg)', 'BMI',
      '高血压病史', '糖尿病', '心脏病', '心脏病详情', '血脂异常', '超重或肥胖',
      '中风病史', '短暂性脑缺血病史', '脑卒中家族史',
      '吸烟', '饮酒', '运动缺乏', '其他家族遗传性疾病', '饮食习惯',
      '风险等级', '患病概率(%)', '风险因素', '评估人员', '评估时间', '来源', '备注'
    ];

    const dataRows = rows.map((r) => [
      r.patientName || '',
      r.age != null ? r.age : '',
      r.gender || '',
      r.everMarried || '',
      r.workType || '',
      r.residenceType || '',
      r.education || '',
      r.monthlyIncome || '',
      r.medicalInsurance || '',
      num(r.systolicBP),
      num(r.diastolicBP),
      num(r.avgGlucoseLevel),
      num(r.height),
      num(r.weight),
      num(r.bmi),
      yn(r.hypertension),
      yn(r.diabetes),
      heartLabel(r.heartDiseaseType),
      r.heartDiseaseNote || '',
      yn(r.hyperlipidemia),
      yn(r.overweight),
      yn(r.strokeHistory),
      yn(r.tiaHistory),
      familyLabel(r.strokeFamilyHistory),
      yn(r.smoking) !== '' ? yn(r.smoking) : (r.smokingStatus || ''),
      yn(r.drinking) !== '' ? yn(r.drinking) : (r.drinkingStatus || ''),
      yn(r.lackExercise) !== '' ? yn(r.lackExercise) : (r.exerciseFrequency || ''),
      yn(r.otherFamilyHistory),
      join(r.dietaryHabits),
      r.riskLevel || '',
      num(r.probability),
      join(r.riskFactors),
      r.assessedBy || r.ownerName || '',
      this.formatExportDate(r.date || r.createdAt),
      r.sourceLabel || '',
      r.notes || ''
    ]);

    const arrayBuffer = xlsx.buildXlsx('评估记录', [headers].concat(dataRows));

    const now = new Date();
    const pad = (n) => (n < 10 ? '0' + n : n);
    const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const fileName = `卒中评估记录_${stamp}.xlsx`;
    const filePath = `${wx.env.USER_DATA_PATH}/${fileName}`;

    wx.showLoading({ title: '生成中...', mask: true });
    wx.getFileSystemManager().writeFile({
      filePath,
      data: arrayBuffer,
      success: () => {
        this.uploadAndGetLink(filePath, fileName);
      },
      fail: () => {
        wx.hideLoading();
        wx.showToast({ title: '导出失败，请重试', icon: 'none' });
      }
    });
  },

  uploadAndGetLink(filePath, fileName) {
    if (!wx.cloud) {
      wx.hideLoading();
      wx.showModal({
        title: '暂不可用',
        content: '当前小程序未开启云开发，无法生成下载链接。',
        showCancel: false
      });
      return;
    }
    wx.cloud.uploadFile({
      cloudPath: `exports/${fileName}`,
      filePath,
      success: (res) => {
        wx.cloud.getTempFileURL({
          fileList: [res.fileID],
          success: (r) => {
            wx.hideLoading();
            const url = r.fileList && r.fileList[0] ? r.fileList[0].tempFileURL : '';
            if (!url) {
              wx.showToast({ title: '生成链接失败', icon: 'none' });
              return;
            }
            wx.setClipboardData({
              data: url,
              success: () => {
                wx.showModal({
                  title: '下载链接已生成',
                  content: '链接已复制到剪贴板，请在浏览器中打开即可下载 Excel 文件。',
                  showCancel: false
                });
              },
              fail: () => {
                wx.showModal({
                  title: '下载链接',
                  content: url,
                  showCancel: false
                });
              }
            });
          },
          fail: (err) => {
            wx.hideLoading();
            console.error('获取链接失败', err);
            wx.showModal({
              title: '生成链接失败',
              content: (err && (err.errMsg || err.message)) || '请稍后重试',
              showCancel: false
            });
          }
        });
      },
      fail: (err) => {
        wx.hideLoading();
        console.error('上传文件失败', err);
        wx.showModal({
          title: '上传失败',
          content: (err && (err.errMsg || err.message)) || '请确认已开通云开发并正确关联环境',
          showCancel: false
        });
      }
    });
  },

  async importLegacy() {
    if (!this.requireToken()) return;

    const loginType = api.getLoginType();
    if (loginType && loginType !== 'wechat') {
      wx.showModal({
        title: '请先切换微信登录',
        content: '本机旧记录属于微信登录身份。当前是账号密码登录，直接导入会导致记录归属错误。请退出后使用“微信登录”再导入。',
        showCancel: false
      });
      return;
    }

    const legacy = wx.getStorageSync('assessments');
    if (!Array.isArray(legacy) || legacy.length === 0) {
      wx.showToast({ title: '没有本机旧记录', icon: 'none' });
      return;
    }

    wx.showModal({
      title: '导入本机旧记录',
      content: `检测到 ${legacy.length} 条旧记录，是否上传到云端？`,
      success: async (res) => {
        if (!res.confirm) return;
        wx.showLoading({ title: '导入中...', mask: true });
        try {
          let imported = 0;
          let skipped = 0;
          let failed = 0;
          for (let i = 0; i < legacy.length; i += 200) {
            const result = await api.importAssessments({
              records: legacy.slice(i, i + 200),
              source: 'miniprogram'
            });
            imported += result.imported || 0;
            skipped += result.skipped || 0;
            failed += result.failed || 0;
          }
          wx.removeStorageSync('stroke_migrated_mp');
          wx.hideLoading();
          wx.showModal({
            title: '导入完成',
            content: `新增 ${imported} 条，跳过 ${skipped} 条${failed ? `，失败 ${failed} 条` : ''}`,
            showCancel: false
          });
          await this.loadHistory();
        } catch (err) {
          wx.hideLoading();
          if (err.code === 'UNAUTHORIZED' || err.code === 'TOKEN_EXPIRED') {
            wx.reLaunch({ url: '/pages/login/login' });
            return;
          }
          wx.showModal({
            title: '导入失败',
            content: err.message || '网络异常，请稍后重试',
            showCancel: false
          });
        }
      }
    });
  },

  clearHistory() {
    wx.showModal({
      title: '确认清空',
      content: '将清空云端记录和本机旧记录，此操作不可恢复。确定继续吗？',
      success: (res) => {
        if (!res.confirm) return;

        wx.showModal({
          title: '再次确认',
          content: '删除后无法恢复，建议先在网站管理端导出数据。确定清空吗？',
          success: async (res2) => {
            if (!res2.confirm) return;

            if (!this.requireToken()) return;
            wx.showLoading({ title: '清空中...', mask: true });
            try {
              await api.clearAssessments({});
              wx.removeStorageSync('assessments_cache');
              wx.removeStorageSync('assessments');
              wx.setStorageSync('stroke_migrated_mp', '1');
              this.setData({
                assessments: [],
                filtered: [],
                total: 0,
                highCount: 0,
                legacyCount: 0,
                detail: null,
                showDetail: false
              });
              wx.hideLoading();
              wx.showToast({ title: '已清空', icon: 'success' });
            } catch (err) {
              wx.hideLoading();
              if (err.code === 'UNAUTHORIZED' || err.code === 'TOKEN_EXPIRED') {
                wx.reLaunch({ url: '/pages/login/login' });
                return;
              }
              wx.showModal({
                title: '清空失败',
                content: err.message || '网络异常，请稍后重试',
                showCancel: false
              });
            }
          }
        });
      }
    });
  }
});
