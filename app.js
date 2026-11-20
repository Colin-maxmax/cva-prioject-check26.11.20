const api = require('./utils/api.js');

App({
  globalData: {
    userInfo: null
  },

  onLaunch() {
    // 冷启动清除登录态：退出小程序后需要重新登录
    api.clearSession();

    // 登录改为由 pages/login 处理，这里不再静默创建微信账号。
    // 这样不会绕过登录页，也不会动任何已保存的评估数据。

    // 云开发：用于导出 Excel 时把文件上传到云存储并生成下载链接。
    if (wx.cloud) {
      wx.cloud.init({
        env: 'significant-donkey-d5cfzd9b35604',
        traceUser: true
      });
    }
  },

  onShow() {
    this.trackUsage();
  },

  // 使用统计：每次回到前台记一次，5 分钟内重复切前台不重复计数
  trackUsage(force) {
    if (!api.getToken()) return;
    const now = Date.now();
    if (!force && this._lastTrackAt && now - this._lastTrackAt < 5 * 60 * 1000) return;
    this._lastTrackAt = now;
    api.trackUsage().catch(() => {});
  },

  /**
   * 旧版小程序只把记录存在 wx storage('assessments')。
   * 新版本首次登录成功后上传到云端；服务端按 legacyKey 去重，
   * 重复启动不会产生重复记录。
   */
  async migrateLegacyData() {
    const FLAG = 'stroke_migrated_mp';
    if (wx.getStorageSync(FLAG)) return;

    const legacy = wx.getStorageSync('assessments');
    if (!Array.isArray(legacy) || legacy.length === 0) {
      wx.setStorageSync(FLAG, '1');
      return;
    }

    let imported = 0;
    let skipped = 0;
    let failed = 0;
    try {
      for (let i = 0; i < legacy.length; i += 200) {
        const batch = legacy.slice(i, i + 200);
        const result = await api.importAssessments({ records: batch, source: 'miniprogram' });
        imported += result.imported || 0;
        skipped += result.skipped || 0;
        failed += result.failed || 0;
      }
      if (failed === 0) {
        wx.setStorageSync(FLAG, '1');
      }
      console.log(`本机历史导入：新增 ${imported}，跳过 ${skipped}，失败 ${failed}`);
    } catch (err) {
      console.warn('本机历史导入失败，下次启动重试：', err.message);
    }
  }
});
