Page({
  data: {
    logoError: false
  },

  onLogoError() {
    this.setData({ logoError: true });
  },

  goLogin() {
    wx.reLaunch({ url: '/pages/login/login' });
  }
});
