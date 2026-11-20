const api = require('../../utils/api.js');
const avatar = require('../../utils/avatar.js');

Page({
  data: {
    username: '',
    password: '',
    showPassword: false,
    agreed: false,
    loggingIn: false,
    wechatLogging: false,
    checking: true,
    logoError: false,
    showProfilePrompt: false,
    profileAvatar: '',
    profileNickname: '',
    profileSaving: false
  },

  onLogoError() {
    this.setData({ logoError: true });
  },

  onLoad() {
    const token = api.getToken();
    if (!token) {
      this.setData({ checking: false });
      return;
    }

    // 已有登录态：向服务端确认后直接进入，避免重复登录
    api.me()
      .then((result) => {
        getApp().globalData.userInfo = result.user;
        if (!api.getLoginType()) api.setLoginType('wechat');
        wx.switchTab({ url: '/pages/index/index' });
      })
      .catch(() => {
        api.clearSession();
        this.setData({ checking: false });
      });
  },

  onUsernameInput(e) {
    this.setData({ username: e.detail.value });
  },

  onPasswordInput(e) {
    this.setData({ password: e.detail.value });
  },

  togglePassword() {
    this.setData({ showPassword: !this.data.showPassword });
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

  goRegister() {
    wx.navigateTo({ url: '/pages/register/register' });
  },

  goForgot() {
    wx.navigateTo({ url: '/pages/forgot/forgot' });
  },

  requireAgreement() {
    if (!this.data.agreed) {
      wx.showToast({ title: '请先阅读并同意用户协议与隐私政策', icon: 'none' });
      return false;
    }
    return true;
  },

  async onAccountLogin() {
    const username = this.data.username.trim();
    const password = this.data.password;

    if (!username) {
      wx.showToast({ title: '请输入账号', icon: 'none' });
      return;
    }
    if (!password) {
      wx.showToast({ title: '请输入密码', icon: 'none' });
      return;
    }
    if (!this.requireAgreement()) return;

    this.setData({ loggingIn: true });
    try {
      const data = await api.login({ username, password });
      getApp().globalData.userInfo = data.user;
      wx.showToast({ title: '登录成功', icon: 'success' });
      setTimeout(() => {
        wx.switchTab({ url: '/pages/index/index' });
      }, 300);
    } catch (err) {
      wx.showModal({
        title: '登录失败',
        content: err.message || '账号或密码错误',
        showCancel: false
      });
    } finally {
      this.setData({ loggingIn: false });
    }
  },

  async onWechatLogin() {
    if (!this.requireAgreement()) return;

    this.setData({ wechatLogging: true });
    try {
      const data = await api.ensureLogin(true);
      getApp().globalData.userInfo = data.user;

      // 微信登录保留原 openid 身份，并把旧版本本机记录迁移一次
      try {
        await getApp().migrateLegacyData();
      } catch (migrationError) {
        console.warn('旧记录迁移失败：', migrationError.message);
      }

      this.setData({ wechatLogging: false });

      // 首次微信登录（还没头像、昵称还是默认值）时，提示使用微信头像和昵称
      const isDefaultName = /^微信用户/.test((data.user && data.user.displayName) || '');
      if (data.user && !data.user.avatarUrl && isDefaultName) {
        this.setData({
          showProfilePrompt: true,
          profileAvatar: '',
          profileNickname: '',
          profileSaving: false
        });
        return;
      }

      this.enterApp();
    } catch (err) {
      this.setData({ wechatLogging: false });
      wx.showModal({
        title: '微信登录失败',
        content: err.message || '请稍后重试',
        showCancel: false
      });
    }
  },

  enterApp() {
    wx.showToast({ title: '登录成功', icon: 'success' });
    setTimeout(() => {
      wx.switchTab({ url: '/pages/index/index' });
    }, 300);
  },

  onPromptChooseAvatar(e) {
    const tempPath = e.detail && e.detail.avatarUrl;
    if (tempPath) this.setData({ profileAvatar: tempPath });
  },

  onPromptNickname(e) {
    this.setData({ profileNickname: e.detail.value });
  },

  skipProfilePrompt() {
    this.setData({ showProfilePrompt: false });
    this.enterApp();
  },

  async submitProfilePrompt() {
    if (this.data.profileSaving) return;
    this.setData({ profileSaving: true });

    try {
      if (this.data.profileAvatar) {
        await avatar.saveAvatar(this.data.profileAvatar);
      }

      const name = String(this.data.profileNickname || '').trim();
      if (name) {
        const result = await api.updateProfile({ displayName: name });
        if (result && result.user) api.setUser(result.user);
      }

      this.setData({ showProfilePrompt: false, profileSaving: false });
      this.enterApp();
    } catch (err) {
      this.setData({ profileSaving: false });
      wx.showToast({ title: err.message || '保存失败', icon: 'none' });
    }
  }
});
