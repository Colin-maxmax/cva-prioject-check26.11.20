const api = require('../../utils/api.js');
const { formatDateTime } = require('../../utils/util.js');

Page({
  data: {
    messages: [],
    input: '',
    loading: true,
    sending: false,
    scrollTo: ''
  },

  onShow() {
    if (!api.getToken()) {
      wx.reLaunch({ url: '/pages/login/login' });
      return;
    }
    this.load();
    this.startPolling();
  },

  onHide() {
    this.stopPolling();
  },

  onUnload() {
    this.stopPolling();
  },

  startPolling() {
    this.stopPolling();
    this.timer = setInterval(() => this.load(true), 10000);
  },

  stopPolling() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  },

  // 云存储 fileID 转临时链接，一次批量解析
  resolveAvatarMap(values) {
    return new Promise((resolve) => {
      const map = {};
      const list = [...new Set((values || []).filter(Boolean))];
      const cloudList = list.filter((v) => String(v).indexOf('cloud://') === 0);

      list.forEach((v) => {
        if (String(v).indexOf('cloud://') !== 0) map[v] = v;
      });

      if (!cloudList.length || !wx.cloud) {
        resolve(map);
        return;
      }

      wx.cloud.getTempFileURL({
        fileList: cloudList,
        success(res) {
          (res.fileList || []).forEach((item) => {
            if (item.tempFileURL) map[item.fileID] = item.tempFileURL;
          });
          resolve(map);
        },
        fail() {
          resolve(map);
        }
      });
    });
  },

  decorate(messages, avatarMap) {
    const me = api.getUser() || {};
    const myName = me.displayName || me.username || '我';
    const safeMap = avatarMap || {};

    return (messages || []).map((item) => ({
      ...item,
      time: formatDateTime(item.createdAt),
      label: item.from === 'admin'
        ? `${item.authorName || '管理员'}（管理员）`
        : myName,
      avatarUrl: item.from === 'admin'
        ? (safeMap[item.authorAvatar] || '')
        : (safeMap[me.avatarUrl] || '')
    }));
  },

  async load(silent) {
    if (!silent) this.setData({ loading: true });
    try {
      const data = await api.myFeedback();
      const raw = data.messages || [];
      const me = api.getUser() || {};
      const avatarMap = await this.resolveAvatarMap(
        raw.map((m) => m.authorAvatar).concat(me.avatarUrl || '')
      );
      const messages = this.decorate(raw, avatarMap);
      this.setData({
        messages,
        loading: false,
        scrollTo: messages.length ? 'msg-bottom' : ''
      });
      api.markFeedbackRead({}).catch(() => {});
    } catch (err) {
      this.setData({ loading: false });
      if (err.code === 'UNAUTHORIZED' || err.code === 'TOKEN_EXPIRED') {
        wx.reLaunch({ url: '/pages/login/login' });
        return;
      }
      if (!silent) wx.showToast({ title: err.message || '加载失败', icon: 'none' });
    }
  },

  onInput(e) {
    this.setData({ input: e.detail.value });
  },

  async onSend() {
    if (this.data.sending) return;
    const content = (this.data.input || '').trim();
    if (!content) {
      wx.showToast({ title: '请输入内容', icon: 'none' });
      return;
    }

    this.setData({ sending: true });
    try {
      await api.sendFeedback({ content });
      this.setData({ input: '' });
      await this.load(true);
    } catch (err) {
      if (err.code === 'UNAUTHORIZED' || err.code === 'TOKEN_EXPIRED') {
        wx.reLaunch({ url: '/pages/login/login' });
        return;
      }
      wx.showToast({ title: err.message || '发送失败', icon: 'none' });
    } finally {
      this.setData({ sending: false });
    }
  }
});
