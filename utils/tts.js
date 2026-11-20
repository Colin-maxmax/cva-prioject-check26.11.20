// 语音播报：调用后端阿里云语音合成，返回 base64 音频后本地播放
const api = require('./api.js');

let audio = null;
let currentFile = '';

function cleanup() {
  if (audio) {
    try { audio.stop(); } catch (err) { /* ignore */ }
    try { audio.destroy(); } catch (err) { /* ignore */ }
    audio = null;
  }
  if (currentFile) {
    try { wx.getFileSystemManager().unlink({ filePath: currentFile }); } catch (err) { /* ignore */ }
    currentFile = '';
  }
}

function stop() {
  cleanup();
}

function writeAudio(base64) {
  return new Promise((resolve, reject) => {
    const filePath = `${wx.env.USER_DATA_PATH}/tts_${Date.now()}.mp3`;
    wx.getFileSystemManager().writeFile({
      filePath,
      data: base64,
      encoding: 'base64',
      success: () => resolve(filePath),
      fail: () => reject(new Error('音频写入失败'))
    });
  });
}

async function speak(text, options = {}) {
  const content = String(text || '').trim();
  if (!content) throw new Error('没有可播报的内容');

  stop();

  const res = await api.tts({ text: content.slice(0, 500) });
  if (!res || !res.audio) throw new Error('语音合成失败，请稍后重试');

  const filePath = await writeAudio(res.audio);
  currentFile = filePath;

  return new Promise((resolve, reject) => {
    audio = wx.createInnerAudioContext();
    audio.src = filePath;
    audio.onEnded(() => {
      cleanup();
      if (options.onEnd) options.onEnd();
      resolve();
    });
    audio.onError(() => {
      cleanup();
      reject(new Error('语音播放失败'));
    });
    audio.play();
    if (options.onStart) options.onStart();
  });
}

module.exports = {
  speak,
  stop,
  isAvailable: () => true
};
