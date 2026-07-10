/**
 * Gitee API 封装层
 *
 * 通过 Gitee API v5 读写仓库中的 JSON 数据文件，
 * 实现多设备数据共享。
 *
 * 使用方法：
 *   1. 在 Gitee 生成 Personal Access Token（勾选 contents 权限）
 *   2. 在管理页配置仓库 owner、repo、token
 *   3. 物品数据存放在 repo 的 data/items.json
 *   4. 选购数据存放在 repo 的 data/selections.json
 */

// ============================================================
// 配置管理
// ============================================================

const CONFIG_KEY = 'gitee_config';

const defaultConfig = {
  owner: '',
  repo: '',
  branch: 'main',
  token: '',
};

/** 读取 Gitee 配置 */
function getGiteeConfig() {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    return raw ? { ...defaultConfig, ...JSON.parse(raw) } : { ...defaultConfig };
  } catch {
    return { ...defaultConfig };
  }
}

/** 保存 Gitee 配置 */
function saveGiteeConfig(config) {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}

/** 检查配置是否完整 */
function hasGiteeConfig() {
  const cfg = getGiteeConfig();
  return !!(cfg.owner && cfg.repo && cfg.token);
}

// ============================================================
// API 请求
// ============================================================

const API_BASE = 'https://gitee.com/api/v5';

/**
 * 从仓库读取文件内容
 * 使用 Gitee API v5（需 token），返回解析后的 JSON
 */
async function giteeGetFile(path) {
  const cfg = getGiteeConfig();
  const url = `${API_BASE}/repos/${cfg.owner}/${cfg.repo}/contents/${path}`;
  const resp = await fetch(url + `?access_token=${cfg.token}&ref=${cfg.branch}`);
  if (!resp.ok) {
    throw new Error(`读取失败: ${resp.status} ${resp.statusText}`);
  }
  const data = await resp.json();
  // API 返回的 content 是 base64 编码
  const decoded = atob(data.content);
  return { data: JSON.parse(decoded), sha: data.sha };
}

/**
 * 写入文件到仓库
 * 如果文件存在需传入 sha，不存在则新建
 */
async function giteePutFile(path, content, sha) {
  const cfg = getGiteeConfig();
  const url = `${API_BASE}/repos/${cfg.owner}/${cfg.repo}/contents/${path}`;
  const body = {
    access_token: cfg.token,
    content: btoa(unescape(encodeURIComponent(JSON.stringify(content, null, 2)))),
    message: `更新 ${path}`,
    branch: cfg.branch,
  };
  if (sha) body.sha = sha;
  const resp = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const errText = await resp.text().catch(() => '');
    throw new Error(`写入失败: ${resp.status} ${resp.statusText}${errText ? ' - ' + errText : ''}`);
  }
  return await resp.json();
}

/**
 * 从原始文件 URL 读取（无需 token，只读）
 * 适合部署后读取 items.json
 */
async function fetchRawFile(path) {
  const cfg = getGiteeConfig();
  // 依次尝试 Gitee Pages 和 Gitee raw
  const urls = [
    // Gitee Pages (如果是默认 Pages 域名)
    `https://${cfg.owner}.gitee.io/${cfg.repo}/${path}`,
    // Gitee raw 文件
    `https://gitee.com/${cfg.owner}/${cfg.repo}/raw/${cfg.branch}/${path}`,
  ];

  let lastErr = null;
  for (const url of urls) {
    try {
      const resp = await fetch(url, { mode: 'cors' });
      if (resp.ok) return await resp.json();
      // 403 或 404 可能是路径问题，继续尝试下一个
    } catch (e) {
      lastErr = e;
    }
  }
  throw new Error(`无法读取文件 ${path}，请确认仓库已部署 Pages 或检查配置`);
}

// ============================================================
// 物品管理 API
// ============================================================

const ITEMS_PATH = 'data/items.json';

/** 读取物品清单（优先从 Gitee 静态文件，回退到 data.js 内置数据） */
async function fetchItems() {
  try {
    return await fetchRawFile(ITEMS_PATH);
  } catch {
    // 回退：尝试用 API 读
    try {
      const result = await giteeGetFile(ITEMS_PATH);
      return result.data;
    } catch {
      // 最终回退
      throw new Error('无法读取物品清单，请先在管理页配置 Gitee 并保存物品');
    }
  }
}

/** 保存物品清单到仓库 */
async function saveItems(items) {
  if (!hasGiteeConfig()) throw new Error('请先在管理页配置 Gitee 仓库信息');

  let sha;
  try {
    const existing = await giteeGetFile(ITEMS_PATH);
    sha = existing.sha;
  } catch {
    sha = undefined; // 文件不存在，新建
  }
  await giteePutFile(ITEMS_PATH, items, sha);
}

// ============================================================
// 选购数据 API
// ============================================================

const SELECTIONS_PATH = 'data/selections.json';

/** 读取选购数据 */
async function fetchSelections() {
  try {
    const result = await giteeGetFile(SELECTIONS_PATH);
    return result.data;
  } catch {
    // 文件还不存在
    return {};
  }
}

/** 保存选购数据 */
async function saveSelections(selections) {
  if (!hasGiteeConfig()) throw new Error('请先在管理页配置 Gitee 仓库信息');

  let sha;
  try {
    const existing = await giteeGetFile(SELECTIONS_PATH);
    sha = existing.sha;
  } catch {
    sha = undefined;
  }
  await giteePutFile(SELECTIONS_PATH, selections, sha);
}
