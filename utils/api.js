const CONFIG = require('./config.js');

const TOKEN_KEY = 'stroke_token';
const USER_KEY = 'stroke_user';
const LOGIN_TYPE_KEY = 'stroke_login_type';
const TIMEOUT_MS = 15000;

let loginPromise = null;

function getToken() {
  return wx.getStorageSync(TOKEN_KEY) || '';
}

function getUser() {
  return wx.getStorageSync(USER_KEY) || null;
}

function setSession(token, user) {
  if (token) wx.setStorageSync(TOKEN_KEY, token);
  if (user) wx.setStorageSync(USER_KEY, user);
}

function getLoginType() {
  return wx.getStorageSync(LOGIN_TYPE_KEY) || '';
}

function setLoginType(type) {
  if (type) wx.setStorageSync(LOGIN_TYPE_KEY, type);
  else wx.removeStorageSync(LOGIN_TYPE_KEY);
}

function clearSession() {
  wx.removeStorageSync(TOKEN_KEY);
  wx.removeStorageSync(USER_KEY);
  wx.removeStorageSync(LOGIN_TYPE_KEY);
}

function login(input) {
  return request('login', input).then((data) => {
    setSession(data.token, data.user);
    setLoginType('account');
    return data;
  });
}

function register(input) {
  return request('register', input).then((data) => {
    setSession(data.token, data.user);
    setLoginType('account');
    return data;
  });
}

function isConfigured() {
  return !!CONFIG.API_BASE && CONFIG.API_BASE.indexOf('example.com') === -1;
}

function request(action, payload, options) {
  const timeoutMs = (options && options.timeoutMs) || TIMEOUT_MS;
  return new Promise((resolve, reject) => {
    if (!isConfigured()) {
      reject(Object.assign(new Error('后端地址尚未配置，请先修改 utils/config.js'), { code: 'NOT_CONFIGURED' }));
      return;
    }

    const token = getToken();
    wx.request({
      url: CONFIG.API_BASE,
      method: 'POST',
      timeout: timeoutMs,
      header: { 'Content-Type': 'application/json' },
      data: { action: action, token: token, payload: payload || {} },
      success(res) {
        const body = res.data || {};
        if (res.statusCode >= 200 && res.statusCode < 300 && body.ok === true) {
          resolve(body.data);
          return;
        }
        const error = body.error || { code: 'HTTP_' + res.statusCode, message: '请求失败' };
        if (token && (error.code === 'UNAUTHORIZED' || error.code === 'TOKEN_EXPIRED')) {
          clearSession();
        }
        reject(Object.assign(new Error(error.message || '请求失败'), {
          code: error.code || 'HTTP_' + res.statusCode,
          status: res.statusCode
        }));
      },
      fail(err) {
        reject(Object.assign(new Error('网络异常，请稍后重试'), { code: 'NETWORK', detail: err }));
      }
    });
  });
}

/**
 * 静默微信登录：首次调用 wx.login，后端用 code 换 openid 并签发 token。
 * 拿不到 token 时页面应提示重试；不要在这里弹窗，避免启动时骚扰用户。
 */
function ensureLogin(force) {
  if (!force) {
    const token = getToken();
    if (token) return Promise.resolve({ token: token, user: getUser() });
  }
  if (loginPromise) return loginPromise;
  if (!isConfigured()) {
    return Promise.reject(Object.assign(new Error('后端地址尚未配置'), { code: 'NOT_CONFIGURED' }));
  }

  loginPromise = new Promise((resolve, reject) => {
    wx.login({
      success(res) {
        if (!res.code) {
          reject(new Error('微信登录失败，请重试'));
          return;
        }
        request('wxLogin', { code: res.code })
          .then((data) => {
            setSession(data.token, data.user);
            setLoginType('wechat');
            resolve(data);
          })
          .catch(reject);
      },
      fail() {
        reject(new Error('微信登录失败，请检查网络'));
      }
    });
  });

  const reset = () => { loginPromise = null; };
  loginPromise.then(reset, reset);
  return loginPromise;
}

module.exports = {
  ensureLogin: ensureLogin,
  login: login,
  register: register,
  getToken: getToken,
  getUser: getUser,
  getLoginType: getLoginType,
  setLoginType: setLoginType,
  clearSession: clearSession,
  isConfigured: isConfigured,
  me: function () { return request('me'); },
  updateProfile: function (input) { return request('updateProfile', input); },
  setUser: function (user) {
    if (user) wx.setStorageSync(USER_KEY, user);
  },
  createAssessment: function (input) {
    return request('createAssessment', Object.assign({}, input, { clientSource: 'miniprogram' }));
  },
  listAssessments: function (input) { return request('listAssessments', input || {}); },
  deleteAssessment: function (input) { return request('deleteAssessment', input); },
  clearAssessments: function (input) { return request('clearAssessments', input || {}); },
  importAssessments: function (input) { return request('importAssessments', input); },

  // 使用统计
  trackUsage: function () { return request('trackUsage'); },

  // 语音播报
  tts: function (input) { return request('tts', input); },

  // AI 健康助手（大模型响应较慢，单独放宽超时）
  aiChat: function (input) { return request('aiChat', input, { timeoutMs: 50000 }); },

  // 站内客服
  sendFeedback: function (input) { return request('sendFeedback', input); },
  myFeedback: function () { return request('myFeedback'); },
  feedbackUnread: function () { return request('feedbackUnread'); },
  markFeedbackRead: function (input) { return request('markFeedbackRead', input); }
};
