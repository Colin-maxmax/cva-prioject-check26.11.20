const api = require('../../utils/api.js');
const avatar = require('../../utils/avatar.js');
const { formatDate } = require('../../utils/util.js');

Page({
  data: {
    avatarUrl: '',
    displayName: '',
    originalName: '',
    loginTypeLabel: '已登录',
    username: '',
    userNo: 0,
    createdAt: '',
    saving: false
  },

  onShow() {
    if (!api.getToken()) {
      wx.reLaunch({ url: '/pages/login/login' });
      return;
    }
    this.load();
  },

  async load() {
    let user = api.getUser();
    try {
      const result = await api.me();
      user = result.user;
      api.setUser(user);
    } catch (err) {
      if (err.code === 'UNAUTHORIZED' || err.code === 'TOKEN_EXPIRED') {
        wx.reLaunch({ url: '/pages/login/login' });
        return;
      }
    }
    if (!user) return;

    const loginType = api.getLoginType();
    const loginTypeLabel = loginType === 'wechat'
      ? '微信登录'
      : (loginType === 'account' ? '账号登录' : '已登录');
    const name = user.displayName || user.username || '';

    this.setData({
      displayName: name,
      originalName: name,
      loginTypeLabel,
      username: user.username || '',
      userNo: user.userNo || 0,
      createdAt: user.createdAt ? formatDate(user.createdAt) : ''
    });

    avatar.resolveAvatar(user.avatarUrl).then((url) => {
      this.setData({ avatarUrl: url });
    });
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

  onNameInput(e) {
    this.setData({ displayName: e.detail.value });
  },

  async saveName() {
    const name = String(this.data.displayName || '').trim();
    if (!name) {
      wx.showToast({ title: '昵称不能为空', icon: 'none' });
      return;
    }
    if (name === this.data.originalName) {
      wx.showToast({ title: '昵称未修改', icon: 'none' });
      return;
    }

    this.setData({ saving: true });
    try {
      const result = await api.updateProfile({ displayName: name });
      if (result && result.user) api.setUser(result.user);
      this.setData({ originalName: name });
      wx.showToast({ title: '昵称已更新', icon: 'success' });
    } catch (err) {
      if (err.code === 'UNAUTHORIZED' || err.code === 'TOKEN_EXPIRED') {
        wx.reLaunch({ url: '/pages/login/login' });
        return;
      }
      wx.showToast({ title: err.message || '保存失败', icon: 'none' });
    } finally {
      this.setData({ saving: false });
    }
  }
});
