const formatNumber = n => {
  n = n.toString()
  return n[1] ? n : `0${n}`
}

const formatTime = date => {
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()
  const hour = date.getHours()
  const minute = date.getMinutes()
  const second = date.getSeconds()

  return `${[year, month, day].map(formatNumber).join('/')} ${[hour, minute, second].map(formatNumber).join(':')}`
}

// 后端存的是 UTC 的 ISO 字符串，展示时按设备本地时区换算，避免固定少 8 小时
const toDate = value => {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

const formatDate = value => {
  const d = toDate(value)
  if (!d) return value ? String(value).slice(0, 10) : ''
  return `${d.getFullYear()}-${formatNumber(d.getMonth() + 1)}-${formatNumber(d.getDate())}`
}

const formatDateTime = value => {
  const raw = value == null ? '' : String(value)
  const d = toDate(value)
  if (!d) return raw ? raw.replace('T', ' ').slice(0, 16) : ''
  // 只到日期的旧记录不补造时间
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw.trim())) return formatDate(value)
  return `${formatDate(value)} ${formatNumber(d.getHours())}:${formatNumber(d.getMinutes())}`
}

module.exports = {
  formatTime,
  formatDate,
  formatDateTime
}
