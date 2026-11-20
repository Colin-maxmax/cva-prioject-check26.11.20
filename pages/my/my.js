const api = require('../../utils/api.js');
const { formatDate } = require('../../utils/util.js');
const avatar = require('../../utils/avatar.js');

Page({
  data: {
    user: null,
    name: '已登录用户',
    initial: '卒',
    loginTypeLabel: '已登录',
    roleLabel: '',
    avatarUrl: '',
    userNo: 0,
    total: 0,
    high: 0,
    lastDate: '--',
    supportUnread: 0,
    version: '2.5.1'
  },

  onShow() {
    this.load();
  },

  requireToken() {
    if (!api.getToken()) {
      wx.reLaunch({ url: '/pages/login/login' });
      return false;
    }
    return true;
  },

  async load() {
    if (!this.requireToken()) return;

    let user = api.getUser();
    if (!user) {
      try {
        const result = await api.me();
        user = result.user;
      } catch (err) {
        if (err.code === 'UNAUTHORIZED' || err.code === 'TOKEN_EXPIRED') {
          wx.reLaunch({ url: '/pages/login/login' });
          return;
        }
      }
    }

    const loginType = api.getLoginType();
    const loginTypeLabel = loginType === 'wechat'
      ? '微信登录'
      : (loginType === 'account' ? '账号登录' : '已登录');
    const roleLabel = user && user.role === 'admin' ? '管理员' : '';
    const name = (user && (user.displayName || user.username)) || '已登录用户';
    this.setData({
      user,
      name,
      initial: name.slice(0, 1),
      loginTypeLabel,
      roleLabel,
      userNo: (user && user.userNo) || 0
    });

    avatar.resolveAvatar(user && user.avatarUrl).then((url) => {
      this.setData({ avatarUrl: url });
    });

    try {
      const data = await api.listAssessments({ limit: 200 });
      const items = data.items || [];
      const high = items.filter((item) => item.riskLevel === '高风险').length;
      const lastDate = items[0]
        ? (formatDate(items[0].date || items[0].createdAt) || '--')
        : '--';
      this.setData({ total: items.length, high, lastDate });
    } catch (err) {
      // 统计失败不影响页面其他功能
    }

    try {
      const unread = await api.feedbackUnread();
      this.setData({ supportUnread: Number(unread.unread) || 0 });
    } catch (err) {
      // 未读数失败忽略
    }
  },

  async onChooseAvatar(e) {
    const tempPath = e.detail && e.detail.avatarUrl;
    if (!tempPath) return;

    wx.showLoading({ title: '上传中...', mask: true });
    try {
      const result = await avatar.saveAvatar(tempPath);
      this.setData({ avatarUrl: result.displayUrl });
      wx.hideLoading();
      wx.showToast({ title: '头像已更新', icon: 'success' });
    } catch (err) {
      wx.hideLoading();
      wx.showToast({ title: err.message || '头像更新失败', icon: 'none' });
    }
  },

  goProfile() {
    wx.navigateTo({ url: '/pages/profile/profile' });
  },

  goSupport() {
    wx.navigateTo({ url: '/pages/support/support' });
  },

  goHistory() {
    wx.navigateTo({ url: '/pages/history/history' });
  },

  goHealth() {
    wx.navigateTo({ url: '/pages/health/health' });
  },

  goFaq() {
    wx.navigateTo({ url: '/pages/faq/faq' });
  },

  goChangelog() {
    wx.navigateTo({ url: '/pages/changelog/changelog' });
  },

  goAbout() {
    wx.navigateTo({ url: '/pages/about/about' });
  },

  goAgreement() {
    wx.navigateTo({ url: '/pages/agreement/agreement' });
  },

  goPrivacy() {
    wx.navigateTo({ url: '/pages/privacy/privacy' });
  },

  goFamily() {
    wx.showToast({ title: '家人档案即将上线', icon: 'none' });
  },

  goReminder() {
    wx.showToast({ title: '复测提醒即将上线', icon: 'none' });
  },

  onShareAppMessage() {
    return {
      title: '卒防智控 - 脑卒中风险自测',
      path: '/pages/index/index'
    };
  },

  logout() {
    wx.showModal({
      title: '退出登录',
      content: '退出后不会删除你的评估记录，下次可重新登录。',
      success: (res) => {
        if (!res.confirm) return;
        api.clearSession();
        wx.reLaunch({ url: '/pages/login/login' });
      }
    });
  }
});
