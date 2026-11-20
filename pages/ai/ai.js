const api = require('../../utils/api.js');

const QUICK_QUESTIONS = [
  '根据我的情况，平时要注意什么？',
  '饮食上应该怎么安排？',
  '多久复查一次比较合适？'
];

const MAX_SESSIONS = 30;

function nowTime() {
  const d = new Date();
  const pad = (n) => (n < 10 ? '0' + n : String(n));
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatStamp(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const pad = (n) => (n < 10 ? '0' + n : String(n));
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function storageKey() {
  const user = api.getUser() || {};
  return `ai_chat_sessions_${user.id || user.username || 'anon'}`;
}

Page({
  data: {
    messages: [],
    input: '',
    sending: false,
    typing: false,
    scrollTo: '',
    quickQuestions: QUICK_QUESTIONS,
    showQuick: true,
    sessions: [],
    currentId: '',
    showDrawer: false
  },

  onLoad() {
    this.sessions = this.loadSessions();
    this.syncSessionList();
    this.openOrCreate();
  },

  onShow() {
    if (!api.getToken()) {
      wx.reLaunch({ url: '/pages/login/login' });
    }
  },

  onUnload() {
    if (this.typingTimer) {
      clearInterval(this.typingTimer);
      this.typingTimer = null;
    }
    this.snapshotCurrent();
    if (this.current) {
      const list = (this.sessions || []).map((s) => (s.id === this.current.id ? this.current : s));
      try {
        wx.setStorageSync(storageKey(), list);
      } catch (err) {
        // 退出时保存失败不影响使用
      }
    }
  },

  /* ---------- 存储 ---------- */

  loadSessions() {
    try {
      const raw = wx.getStorageSync(storageKey());
      return Array.isArray(raw) ? raw : [];
    } catch (err) {
      return [];
    }
  },

  saveLocal(list) {
    this.sessions = list;
    try {
      wx.setStorageSync(storageKey(), list);
    } catch (err) {
      // 存储失败不影响当前会话
    }
    this.syncSessionList();
  },

  syncSessionList() {
    const view = (this.sessions || []).map((s) => ({
      id: s.id,
      title: s.title || '新对话',
      updatedText: formatStamp(s.updatedAt)
    }));
    this.setData({ sessions: view });
  },

  persist() {
    if (!this.current) return;
    const list = (this.sessions || []).map((s) => (s.id === this.current.id ? this.current : s));
    this.saveLocal(list);
  },

  snapshotCurrent() {
    if (!this.current) return;
    this.current.messages = this.data.messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      time: m.time
    }));
  },

  /* ---------- 会话 ---------- */

  openOrCreate() {
    const list = this.sessions || [];
    if (list.length) {
      this.openById(list[0].id);
      return;
    }
    this.startNew();
  },

  startNew() {
    const session = {
      id: `s_${Date.now()}`,
      title: '新对话',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: []
    };
    this.current = session;
    this.saveLocal([session].concat(this.sessions || []).slice(0, MAX_SESSIONS));
    this.setData({
      currentId: session.id,
      messages: [],
      input: '',
      showQuick: true,
      showDrawer: false,
      scrollTo: ''
    });
  },

  openById(id) {
    const session = (this.sessions || []).find((s) => s.id === id);
    if (!session) {
      this.startNew();
      return;
    }
    this.current = session;
    const messages = (session.messages || []).map((m) => Object.assign({}, m));
    this.setData({
      currentId: session.id,
      messages,
      showQuick: messages.length === 0,
      showDrawer: false,
      scrollTo: messages.length ? 'msg-bottom' : ''
    });
  },

  toggleDrawer() {
    this.setData({ showDrawer: !this.data.showDrawer });
  },

  closeDrawer() {
    this.setData({ showDrawer: false });
  },

  noop() {},

  newChat() {
    this.snapshotCurrent();
    this.persist();
    // 当前会话还是空的，直接复用，避免产生大量空记录
    if (this.current && (this.data.messages || []).length === 0) {
      this.setData({ showDrawer: false, input: '', showQuick: true });
      return;
    }
    this.startNew();
  },

  openSession(e) {
    this.snapshotCurrent();
    this.persist();
    this.openById(e.currentTarget.dataset.id);
  },

  deleteSession(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '删除对话',
      content: '确定删除这条对话记录吗？删除后无法恢复。',
      success: (res) => {
        if (!res.confirm) return;
        const list = (this.sessions || []).filter((s) => s.id !== id);
        this.saveLocal(list);
        if (this.data.currentId === id) {
          if (list.length) this.openById(list[0].id);
          else this.startNew();
        }
      }
    });
  },

  /* ---------- 输入与提问 ---------- */

  onInput(e) {
    this.setData({ input: e.detail.value });
  },

  onQuickAsk(e) {
    this.send(e.currentTarget.dataset.q);
  },

  onSend() {
    this.send(this.data.input);
  },

  nextAnchor() {
    this._anchor = this._anchor === 'msg-bottom-2' ? 'msg-bottom' : 'msg-bottom-2';
    return this._anchor;
  },

  typeOut(id, fullText) {
    return new Promise((resolve) => {
      const total = fullText.length;
      let shown = 0;
      const step = 2;

      if (this.typingTimer) clearInterval(this.typingTimer);

      this.typingTimer = setInterval(() => {
        shown = Math.min(total, shown + step);
        const done = shown >= total;
        const messages = this.data.messages.map((m) => (
          m.id === id
            ? Object.assign({}, m, { content: fullText.slice(0, shown), typing: !done })
            : m
        ));
        this.setData({ messages, scrollTo: this.nextAnchor() });

        if (done) {
          clearInterval(this.typingTimer);
          this.typingTimer = null;
          resolve();
        }
      }, 35);
    });
  },

  async send(raw) {
    if (this.data.sending || this.data.typing) return;
    const question = String(raw || '').trim();
    if (!question) {
      wx.showToast({ title: '请输入问题', icon: 'none' });
      return;
    }

    // 带上最近几条对话，让模型能联系上下文
    const history = this.data.messages
      .filter((m) => m.content)
      .slice(-10)
      .map((m) => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.content
      }));

    const userMessage = {
      id: `u_${Date.now()}`,
      role: 'user',
      content: question,
      time: nowTime()
    };

    const messages = this.data.messages.concat(userMessage);
    this.setData({
      messages,
      input: '',
      sending: true,
      showQuick: false,
      scrollTo: 'msg-bottom'
    });

    // 先把提问存下来，避免中途退出丢失
    this.snapshotCurrent();
    if (this.current && this.current.title === '新对话' && messages.length === 1) {
      this.current.title = question.slice(0, 16);
    }
    this.persist();

    try {
      const res = await api.aiChat({ question, history });
      const answer = (res && res.answer) || '抱歉，暂时没有获取到回答。';
      const aiId = `a_${Date.now()}`;

      this.setData({
        messages: this.data.messages.concat({
          id: aiId,
          role: 'ai',
          content: '',
          time: nowTime(),
          typing: true
        }),
        sending: false,
        typing: true,
        scrollTo: 'msg-bottom'
      });

      await this.typeOut(aiId, answer);
      this.setData({ typing: false });

      this.snapshotCurrent();
      this.persist();
    } catch (err) {
      this.setData({ sending: false, typing: false });
      if (err.code === 'UNAUTHORIZED' || err.code === 'TOKEN_EXPIRED') {
        wx.reLaunch({ url: '/pages/login/login' });
        return;
      }
      wx.showModal({
        title: '提问失败',
        content: err.message || '网络异常，请稍后重试',
        showCancel: false
      });
    }
  }
});
