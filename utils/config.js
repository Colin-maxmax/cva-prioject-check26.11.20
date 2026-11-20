// 后端地址：部署 CloudBase 后改成绑定到 HTTP 访问服务的自定义域名。
// 必须 HTTPS，末尾带 /api，例如：
//   https://api.yourdomain.com/api
// 并在微信公众平台 → 开发管理 → 开发设置 → 服务器域名 → request 合法域名
// 中添加该域名（不能带路径）。
module.exports = {
  API_BASE: 'https://significant-donkey-d5cfzd9b35604-1419360854.ap-shanghai.app.tcloudbase.com/api'
};
