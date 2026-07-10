/**
 * 数据持久化层
 *
 * 当前实现：localStorage
 * 后续可切换为 Gitee API 实现
 */

const STORAGE_KEY = 'purchase_selections';

// ============================================================
// 公开接口
// ============================================================

/** 加载所有用户的选购数据 */
function loadAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/** 保存所有用户的选购数据 */
function saveAll(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

/** 获取某个用户的选购数据 */
function loadUser(username) {
  const all = loadAll();
  return all[username] || {};
}

/** 保存某个用户的选购数据 */
function saveUser(username, selections) {
  const all = loadAll();
  all[username] = selections;
  saveAll(all);
}

/** 删除某个用户的选购数据 */
function removeUser(username) {
  const all = loadAll();
  delete all[username];
  saveAll(all);
}

/** 获取所有用户名列表 */
function getUserList() {
  return Object.keys(loadAll());
}

// ============================================================
// 日期相关
// ============================================================

/** 获取明天的日期字符串 YYYY-MM-DD */
function getTomorrowDate() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** 格式化日期为中文 */
function formatDate(dateStr) {
  const [y, m, d] = dateStr.split('-');
  return `${y}年${parseInt(m)}月${parseInt(d)}日`;
}
