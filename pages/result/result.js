const tts = require('../../utils/tts.js');
const report = require('../../utils/report.js');
const { formatDate } = require('../../utils/util.js');

function safeDecode(value) {
  if (!value) return '';
  try {
    return decodeURIComponent(value);
  } catch (err) {
    return value;
  }
}

Page({
  data: {
    result: null,
    name: '',
    age: '',
    gender: '',
    riskTone: 'default',
    advice: '',
    probWidthClass: 'w10',
    speaking: false
  },

  onLoad(options) {
    let result = null;
    try {
      result = JSON.parse(decodeURIComponent(options.result || ''));
    } catch (err) {
      result = null;
    }

    if (!result) {
      wx.showModal({
        title: '结果读取失败',
        content: '请返回重新评估',
        showCancel: false,
        success: () => {
          wx.navigateBack();
        }
      });
      return;
    }

    const level = result.riskLevel;
    let riskTone = 'low';
    let advice = '';
    if (level === '高风险') {
      riskTone = 'high';
      advice = '建议尽快到神经内科或卒中中心就诊，进行专业评估；同时控制血压、血糖、血脂，遵医嘱用药。如出现口角歪斜、肢体无力、言语不清，请立即拨打 120。';
    } else if (level === '中风险') {
      riskTone = 'medium';
      advice = '建议 3-6 个月复测一次，重点控制血压、血糖、体重，戒烟限酒，保持规律运动；如有不适及时就医。';
    } else {
      riskTone = 'low';
      advice = '继续保持健康生活方式，定期体检，关注血压、血糖、血脂变化。';
    }

    const probability = Math.min(100, Math.max(0, Number(result.probability) || 0));
    const bucket = Math.max(10, Math.min(100, Math.round(probability / 10) * 10));

    this.setData({
      result: {
        ...result,
        riskFactors: Array.isArray(result.riskFactors) ? result.riskFactors : []
      },
      name: safeDecode(options.name),
      age: safeDecode(options.age),
      gender: safeDecode(options.gender),
      riskTone,
      advice,
      probWidthClass: 'w' + bucket
    });
  },

  onHide() {
    tts.stop();
    this.setData({ speaking: false });
  },

  onUnload() {
    tts.stop();
  },

  buildSpeakText() {
    const { result, name, age, gender, advice } = this.data;
    if (!result) return '';
    const factors = (result.riskFactors || []).join('、') || '未发现明显风险因素';
    return `${name || '您好'}，${age ? age + '岁' : ''}${gender ? '，' + gender + '性' : ''}。`
      + `评估结果：${result.riskLevel}，患病概率 ${result.probability}%。`
      + `主要风险因素：${factors}。${advice || ''}`;
  },

  speakResult() {
    if (this.data.speaking) {
      tts.stop();
      this.setData({ speaking: false });
      return;
    }
    this.setData({ speaking: true });
    tts.speak(this.buildSpeakText(), {
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

  async saveReport() {
    const { result, name, age, gender, advice } = this.data;
    if (!result) return;

    wx.showLoading({ title: '生成中...', mask: true });
    try {
      const filePath = await report.buildReportImage({
        name,
        age,
        gender,
        riskLevel: result.riskLevel,
        probability: result.probability,
        riskFactors: result.riskFactors,
        advice,
        date: formatDate(new Date())
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

  goHome() {
    wx.switchTab({ url: '/pages/index/index' });
  },

  goHistory() {
    wx.navigateTo({ url: '/pages/history/history' });
  },

  goReport() {
    wx.switchTab({ url: '/pages/report/report' });
  },

  goAssessment() {
    wx.navigateTo({ url: '/pages/assessment/assessment' });
  }
});
