const api = require('../../utils/api.js');

Page({
  data: {
    username: '',
    password: '',
    confirmPassword: '',
    agreed: false,
    submitting: false,
    logoError: false
  },

  onLogoError() {
    this.setData({ logoError: true });
  },

  onUsernameInput(e) {
    this.setData({ username: e.detail.value });
  },

  onPasswordInput(e) {
    this.setData({ password: e.detail.value });
  },

  onConfirmInput(e) {
    this.setData({ confirmPassword: e.detail.value });
  },

  toggleAgree() {
    this.setData({ agreed: !this.data.agreed });
  },

  openAgreement() {
    wx.navigateTo({ url: '/pages/agreement/agreement' });
  },

  openPrivacy() {
    wx.navigateTo({ url: '/pages/privacy/privacy' });
  },

  goLogin() {
    wx.reLaunch({ url: '/pages/login/login' });
  },

  async onSubmit() {
    const username = this.data.username.trim();
    const password = this.data.password;
    const confirmPassword = this.data.confirmPassword;

    if (!username) {
      wx.showToast({ title: '请输入账号', icon: 'none' });
      return;
    }
    if (password.length < 6) {
      wx.showToast({ title: '密码至少 6 位', icon: 'none' });
      return;
    }
    if (password !== confirmPassword) {
      wx.showToast({ title: '两次输入密码不一致', icon: 'none' });
      return;
    }
    if (!this.data.agreed) {
      wx.showToast({ title: '请先阅读并同意用户协议与隐私政策', icon: 'none' });
      return;
    }

    this.setData({ submitting: true });
    try {
      const data = await api.register({ username, password });
      getApp().globalData.userInfo = data.user;
      wx.showToast({ title: '注册成功', icon: 'success' });
      setTimeout(() => {
        wx.switchTab({ url: '/pages/index/index' });
      }, 300);
    } catch (err) {
      wx.showModal({
        title: '注册失败',
        content: err.message || '请稍后重试',
        showCancel: false
      });
    } finally {
      this.setData({ submitting: false });
    }
  }
});
