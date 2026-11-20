// 极简 .xlsx 生成器：ZIP（未压缩存储）+ 内联字符串，无需第三方库。
// 导出 buildXlsx(sheetName, rows)，rows 为二维数组，返回 ArrayBuffer。

const CRC_TABLE = (function () {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function utf8Encode(str) {
  const out = [];
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    if (c < 0x80) {
      out.push(c);
    } else if (c < 0x800) {
      out.push(0xC0 | (c >> 6), 0x80 | (c & 0x3F));
    } else if (c >= 0xD800 && c <= 0xDBFF) {
      const next = str.charCodeAt(i + 1);
      if (next >= 0xDC00 && next <= 0xDFFF) {
        const cp = 0x10000 + ((c - 0xD800) << 10) + (next - 0xDC00);
        out.push(0xF0 | (cp >> 18), 0x80 | ((cp >> 12) & 0x3F), 0x80 | ((cp >> 6) & 0x3F), 0x80 | (cp & 0x3F));
        i++;
      } else {
        out.push(0xEF, 0xBF, 0xBD);
      }
    } else if (c >= 0xDC00 && c <= 0xDFFF) {
      out.push(0xEF, 0xBF, 0xBD);
    } else {
      out.push(0xE0 | (c >> 12), 0x80 | ((c >> 6) & 0x3F), 0x80 | (c & 0x3F));
    }
  }
  return new Uint8Array(out);
}

function u16(v) { return [v & 0xFF, (v >>> 8) & 0xFF]; }
function u32(v) { return [v & 0xFF, (v >>> 8) & 0xFF, (v >>> 16) & 0xFF, (v >>> 24) & 0xFF]; }

function buildZip(entries) {
  const chunks = [];
  const central = [];
  let offset = 0;

  entries.forEach(function (entry) {
    const nameBytes = utf8Encode(entry.name);
    const data = entry.data;
    const crc = crc32(data);
    const local = new Uint8Array(
      u32(0x04034b50)
        .concat(u16(20), u16(0x0800), u16(0), u16(0), u16(0))
        .concat(u32(crc), u32(data.length), u32(data.length))
        .concat(u16(nameBytes.length), u16(0))
    );
    chunks.push(local, nameBytes, data);
    central.push({ nameBytes: nameBytes, data: data, crc: crc, offset: offset });
    offset += local.length + nameBytes.length + data.length;
  });

  const centralStart = offset;
  const centralChunks = [];
  central.forEach(function (c) {
    const h = new Uint8Array(
      u32(0x02014b50)
        .concat(u16(20), u16(20), u16(0x0800), u16(0), u16(0), u16(0))
        .concat(u32(c.crc), u32(c.data.length), u32(c.data.length))
        .concat(u16(c.nameBytes.length), u16(0), u16(0), u16(0), u16(0))
        .concat(u32(0), u32(c.offset))
    );
    centralChunks.push(h, c.nameBytes);
  });

  const centralSize = centralChunks.reduce(function (s, c) { return s + c.length; }, 0);
  const eocd = new Uint8Array(
    u32(0x06054b50)
      .concat(u16(0), u16(0), u16(entries.length), u16(entries.length))
      .concat(u32(centralSize), u32(centralStart), u16(0))
  );

  chunks.push.apply(chunks, centralChunks);
  chunks.push(eocd);

  let total = 0;
  chunks.forEach(function (c) { total += c.length; });
  const result = new Uint8Array(total);
  let pos = 0;
  chunks.forEach(function (c) {
    result.set(c, pos);
    pos += c.length;
  });
  return result;
}

function escapeXml(str) {
  return String(str == null ? '' : str)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function colLetter(index) {
  let s = '';
  let i = index + 1;
  while (i > 0) {
    const rem = (i - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    i = Math.floor((i - 1) / 26);
  }
  return s;
}

function buildSheet(rows) {
  let rowsXml = '';
  rows.forEach(function (row, ri) {
    let cells = '';
    row.forEach(function (val, ci) {
      const ref = colLetter(ci) + (ri + 1);
      cells += '<c r="' + ref + '" t="inlineStr"><is><t>' + escapeXml(val) + '</t></is></c>';
    });
    rowsXml += '<row r="' + (ri + 1) + '">' + cells + '</row>';
  });
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>'
    + rowsXml + '</sheetData></worksheet>';
}

function buildXlsx(sheetName, rows) {
  const contentTypes = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
    + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
    + '<Default Extension="xml" ContentType="application/xml"/>'
    + '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
    + '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
    + '</Types>';

  const rootRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
    + '</Relationships>';

  const workbook = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
    + '<sheets><sheet name="' + escapeXml(sheetName) + '" sheetId="1" r:id="rId1"/></sheets></workbook>';

  const workbookRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'
    + '</Relationships>';

  const sheet = buildSheet(rows);

  const entries = [
    { name: '[Content_Types].xml', data: utf8Encode(contentTypes) },
    { name: '_rels/.rels', data: utf8Encode(rootRels) },
    { name: 'xl/workbook.xml', data: utf8Encode(workbook) },
    { name: 'xl/_rels/workbook.xml.rels', data: utf8Encode(workbookRels) },
    { name: 'xl/worksheets/sheet1.xml', data: utf8Encode(sheet) }
  ];

  return buildZip(entries).buffer;
}

module.exports = {
  buildXlsx: buildXlsx
};
