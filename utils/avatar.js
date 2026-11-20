const api = require('./api.js');

// 头像存的是云存储 fileID（cloud://），展示前转成临时链接
function resolveAvatar(url) {
  return new Promise((resolve) => {
    const value = String(url || '').trim();
    if (!value) {
      resolve('');
      return;
    }
    if (value.indexOf('cloud://') !== 0) {
      resolve(value);
      return;
    }
    if (!wx.cloud) {
      resolve('');
      return;
    }
    wx.cloud.getTempFileURL({
      fileList: [value],
      success(res) {
        const item = res && res.fileList && res.fileList[0];
        resolve(item && item.tempFileURL ? item.tempFileURL : '');
      },
      fail() {
        resolve('');
      }
    });
  });
}

function uploadAvatar(tempPath) {
  return new Promise((resolve, reject) => {
    if (!wx.cloud) {
      reject(new Error('当前环境不支持上传头像'));
      return;
    }
    const user = api.getUser() || {};
    const cloudPath = `avatars/${user.id || 'u'}_${Date.now()}.jpg`;
    wx.cloud.uploadFile({
      cloudPath,
      filePath: tempPath,
      success: (res) => {
        if (!res || !res.fileID) {
          reject(new Error('头像上传失败'));
          return;
        }
        resolve(res.fileID);
      },
      fail: () => reject(new Error('头像上传失败'))
    });
  });
}

// 选择头像后上传并保存到账号
async function saveAvatar(tempPath) {
  const fileID = await uploadAvatar(tempPath);
  const result = await api.updateProfile({ avatarUrl: fileID });
  if (result && result.user) api.setUser(result.user);
  const displayUrl = await resolveAvatar(fileID);
  return { fileID, displayUrl: displayUrl || tempPath, user: result && result.user };
}

module.exports = {
  resolveAvatar,
  saveAvatar
};
