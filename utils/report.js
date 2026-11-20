// 生成评估报告图片（离屏 canvas），可保存到相册后打印
const WIDTH = 750;
const MAX_HEIGHT = 1700;

const RISK_STYLES = {
  '高风险': { color: '#D32F2F', bg: '#FEF2F2' },
  '中风险': { color: '#ED6C02', bg: '#FFF7ED' },
  '低风险': { color: '#2E7D32', bg: '#F0FDF4' },
  '极低风险': { color: '#2E7D32', bg: '#F0FDF4' }
};

function styleOf(level) {
  return RISK_STYLES[level] || { color: '#2F80ED', bg: '#EFF6FF' };
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapLines(ctx, text, maxWidth) {
  const chars = String(text || '').split('');
  const lines = [];
  let line = '';
  for (let i = 0; i < chars.length; i += 1) {
    const test = line + chars[i];
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = chars[i];
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function buildReportImage(data) {
  return new Promise((resolve, reject) => {
    let canvas;
    try {
      canvas = wx.createOffscreenCanvas({ type: '2d', width: WIDTH, height: MAX_HEIGHT });
    } catch (err) {
      reject(new Error('当前微信版本不支持生成报告图片'));
      return;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      reject(new Error('生成报告图片失败'));
      return;
    }

    const style = styleOf(data.riskLevel);

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, WIDTH, MAX_HEIGHT);

    // 顶部
    ctx.fillStyle = '#2F80ED';
    ctx.fillRect(0, 0, WIDTH, 190);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 42px sans-serif';
    ctx.fillText('脑卒中风险评估报告', 40, 88);
    ctx.font = '26px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText(data.subtitle || '卒防智控 · 脑卒中风险自评', 40, 138);

    // 患者信息
    let y = 250;
    ctx.fillStyle = '#111827';
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(String(data.name || '未命名'), 40, y);
    ctx.fillStyle = '#6b7280';
    ctx.font = '28px sans-serif';
    ctx.fillText(`${data.age || '--'} 岁 / ${data.gender || '--'}　${data.date || ''}`, 40, y + 46);

    // 风险卡片
    y += 90;
    const cardH = 170;
    roundRect(ctx, 40, y, WIDTH - 80, cardH, 20);
    ctx.fillStyle = style.bg;
    ctx.fill();

    ctx.fillStyle = '#6b7280';
    ctx.font = '26px sans-serif';
    ctx.fillText('风险等级', 72, y + 58);
    ctx.fillStyle = style.color;
    ctx.font = 'bold 52px sans-serif';
    ctx.fillText(String(data.riskLevel || '未分级'), 72, y + 126);

    if (data.probability != null && data.probability !== '') {
      ctx.fillStyle = '#6b7280';
      ctx.font = '26px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText('患病概率', WIDTH - 72, y + 58);
      ctx.fillStyle = style.color;
      ctx.font = 'bold 60px sans-serif';
      ctx.fillText(`${data.probability}%`, WIDTH - 72, y + 128);
      ctx.textAlign = 'left';
    }

    y += cardH + 60;

    // 风险因素
    ctx.fillStyle = '#111827';
    ctx.font = 'bold 32px sans-serif';
    ctx.fillText('主要风险因素', 40, y);
    y += 34;

    const factors = Array.isArray(data.riskFactors) ? data.riskFactors : [];
    if (factors.length) {
      ctx.font = '26px sans-serif';
      const lineH = 56;
      let x = 40;
      factors.forEach((factor) => {
        const text = String(factor);
        const w = ctx.measureText(text).width + 36;
        if (x + w > WIDTH - 40) {
          x = 40;
          y += lineH;
        }
        roundRect(ctx, x, y, w, 42, 21);
        ctx.fillStyle = '#eff6ff';
        ctx.fill();
        ctx.fillStyle = '#2F80ED';
        ctx.fillText(text, x + 18, y + 29);
        x += w + 12;
      });
      y += lineH;
    } else {
      ctx.fillStyle = '#9ca3af';
      ctx.font = '26px sans-serif';
      ctx.fillText('未发现明显风险因素', 40, y + 34);
      y += 60;
    }

    // 健康建议
    y += 50;
    ctx.fillStyle = '#111827';
    ctx.font = 'bold 32px sans-serif';
    ctx.fillText('健康建议', 40, y);
    y += 16;

    ctx.font = '26px sans-serif';
    ctx.fillStyle = '#4b5563';
    const adviceLines = wrapLines(ctx, data.advice || '', WIDTH - 80);
    adviceLines.forEach((line) => {
      y += 42;
      ctx.fillText(line, 40, y);
    });

    // 页脚
    y += 60;
    ctx.strokeStyle = '#e5e7eb';
    ctx.beginPath();
    ctx.moveTo(40, y);
    ctx.lineTo(WIDTH - 40, y);
    ctx.stroke();

    y += 40;
    ctx.font = '22px sans-serif';
    ctx.fillStyle = '#9ca3af';
    const footer = '本报告由「卒防智控」生成，结果仅供参考，不能替代专业医生诊断。如出现突然口角歪斜、肢体无力、言语不清等症状，请立即拨打 120。';
    wrapLines(ctx, footer, WIDTH - 80).forEach((line) => {
      ctx.fillText(line, 40, y);
      y += 34;
    });

    const height = Math.min(MAX_HEIGHT, y + 40);

    wx.canvasToTempFilePath({
      canvas,
      x: 0,
      y: 0,
      width: WIDTH,
      height,
      destWidth: WIDTH * 2,
      destHeight: height * 2,
      fileType: 'jpg',
      quality: 0.92,
      success: (res) => resolve(res.tempFilePath),
      fail: () => reject(new Error('生成报告图片失败'))
    });
  });
}

function saveToAlbum(filePath) {
  return new Promise((resolve, reject) => {
    wx.saveImageToPhotosAlbum({
      filePath,
      success: resolve,
      fail: (err) => reject(err)
    });
  });
}

module.exports = {
  buildReportImage,
  saveToAlbum
};
