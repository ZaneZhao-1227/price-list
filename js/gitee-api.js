/**
 * GitHub API 封装层
 *
 * 通过 GitHub REST API 读写仓库中的 JSON 数据文件，
 * 实现多设备数据共享。
 *
 * 使用方法：
 *   1. 在 GitHub → Settings → Developer settings → Personal access tokens
 *      生成 classic token（勾选 repo 权限）
 *   2. 在管理页配置仓库 owner、repo、token
 *   3. 物品数据存放在 repo 的 data/items.json
 *   4. 选购数据存放在 repo 的 data/selections.json
 */

// ============================================================
// 配置管理
// ============================================================

const CONFIG_KEY = 'gitee_config';

function b64DecodeUtf8(b64) {
  // atob 产生 Latin-1 字节，需要转换回 UTF-16
  try {
    return decodeURIComponent(escape(atob(b64)));
  } catch {
    // 纯 ASCII 回退
    return atob(b64);
  }
}

function b64EncodeUtf8(str) {
  return btoa(unescape(encodeURIComponent(str)));
}

const defaultConfig = {
  owner: 'ZaneZhao-1227',
  repo: 'price-list',
  branch: 'main',
  token: '',
};

/** 读取 GitHub 配置 */
function getGiteeConfig() {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    return raw ? { ...defaultConfig, ...JSON.parse(raw) } : { ...defaultConfig };
  } catch {
    return { ...defaultConfig };
  }
}

/** 保存 GitHub 配置 */
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

const API_BASE = 'https://api.github.com';
const RAW_BASE = 'https://raw.githubusercontent.com';

/**
 * 从仓库读取文件内容（通过 GitHub API）
 */
/** 公开读：无需 token，适合选购页/汇总页 */
async function gitHubGetFilePublic(path) {
  const cfg = getGiteeConfig();
  const url = `${API_BASE}/repos/${cfg.owner}/${cfg.repo}/contents/${path}`;
  const resp = await fetch(url, {
    headers: { 'Accept': 'application/vnd.github.v3+json' },
  });
  if (!resp.ok) {
    if (resp.status === 404) throw new Error('文件不存在');
    throw new Error(`读取失败: ${resp.status}`);
  }
  const data = await resp.json();
  const decoded = b64DecodeUtf8(data.content);
  return JSON.parse(decoded);
}

/** 认证读：需要 token，获取 SHA 用于写入 */
async function gitHubGetFile(path) {
  const cfg = getGiteeConfig();
  if (!cfg.token) throw new Error('需要配置 token');
  const url = `${API_BASE}/repos/${cfg.owner}/${cfg.repo}/contents/${path}?ref=${cfg.branch}`;
  const resp = await fetch(url, {
    headers: {
      'Authorization': `token ${cfg.token}`,
      'Accept': 'application/vnd.github.v3+json',
    },
  });
  if (!resp.ok) {
    if (resp.status === 404) throw new Error('文件不存在');
    throw new Error(`读取失败: ${resp.status}`);
  }
  const data = await resp.json();
  const decoded = b64DecodeUtf8(data.content);
  return { data: JSON.parse(decoded), sha: data.sha };
}

/**
 * 写入文件到仓库
 */
async function gitHubPutFile(path, content, sha) {
  const cfg = getGiteeConfig();
  const url = `${API_BASE}/repos/${cfg.owner}/${cfg.repo}/contents/${path}`;
  const body = {
    message: `更新 ${path}`,
    content: b64EncodeUtf8(JSON.stringify(content, null, 2)),
    branch: cfg.branch,
  };
  if (sha) body.sha = sha;
  const resp = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `token ${cfg.token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/vnd.github.v3+json',
    },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const errText = await resp.text().catch(() => '');
    throw new Error(`写入失败: ${resp.status} ${resp.statusText}${errText ? ' - ' + errText.slice(0, 200) : ''}`);
  }
  return await resp.json();
}

/**
 * 从 raw.githubusercontent.com 读取 JSON 文件（无需 token，适合 GitHub Pages）
 */
async function fetchRawFile(path) {
  const cfg = getGiteeConfig();
  const t = Date.now() + Math.random();  // 唯一时间戳，彻底防缓存
  const rawUrl = `https://raw.githubusercontent.com/${cfg.owner}/${cfg.repo}/${cfg.branch}/${path}?t=${t}`;
  const pagesUrl = `https://${cfg.owner}.github.io/${cfg.repo}/${path}?t=${t}`;
  
  for (const url of [rawUrl, pagesUrl]) {
    for (let retry = 0; retry < 2; retry++) {
      try {
        const resp = await fetch(url, { mode: 'cors', cache: 'no-store' });
        if (resp.ok) return await resp.json();
      } catch (e) {}
      if (retry === 0) {
        // 第一次失败后等待 500ms 重试
        await new Promise(r => setTimeout(r, 500));
      }
    }
  }
  throw new Error('无法读取文件 ' + path + '，请检查网络');
}

// ============================================================
// 物品管理 API
// ============================================================

const ITEMS_PATH = 'data/items.json';

/** 读取物品清单 */
async function fetchItems() {
  // 优先公开 API 读（无需 token，实时返回）
  try {
    return await gitHubGetFilePublic(ITEMS_PATH);
  } catch { }
  // 回退 raw URL
  try {
    return await fetchRawFile(ITEMS_PATH);
  } catch {
    throw new Error('无法读取物品清单');
  }
}

/** 保存物品清单到仓库 */
async function saveItems(items) {
  if (!hasGiteeConfig()) throw new Error('请先在管理页配置仓库信息');
  
  let sha;
  try {
    const existing = await gitHubGetFile(ITEMS_PATH);
    sha = existing.sha;
  } catch { }
  
  const maxRetries = 3;
  for (let i = 0; i <= maxRetries; i++) {
    try {
      await gitHubPutFile(ITEMS_PATH, items, sha);
      return;
    } catch (e) {
      const msg = e.message;
      // SHA 过期或缺失 → 重新获取 SHA 后重试
      if ((sha === undefined && msg.includes('422')) || msg.includes('409') || msg.includes('does not match')) {
        try {
          const existing = await gitHubGetFile(ITEMS_PATH);
          sha = existing.sha;
          await new Promise(r => setTimeout(r, 500));
          continue;
        } catch { }
      }
      if (i >= maxRetries) throw e;
      await new Promise(r => setTimeout(r, 1000));
    }
  }
}

// ============================================================
// 选购数据 API
// ============================================================

const SELECTIONS_PATH = 'data/selections.json';

/** 读取选购数据 */
async function fetchSelections() {
  try {
    return await gitHubGetFilePublic(SELECTIONS_PATH);
  } catch {
    try {
      const result = await gitHubGetFile(SELECTIONS_PATH);
      return result.data;
    } catch { return {}; }
  }
}

/** 保存选购数据 */
async function saveSelections(selections) {
  if (!hasGiteeConfig()) throw new Error('请先在管理页配置仓库信息');
  let sha;
  try {
    const existing = await gitHubGetFile(SELECTIONS_PATH);
    sha = existing.sha;
  } catch { }
  for (let i = 0; i <= 3; i++) {
    try {
      await gitHubPutFile(SELECTIONS_PATH, selections, sha);
      return;
    } catch (e) {
      if ((sha === undefined && e.message.includes('422')) || e.message.includes('409') || e.message.includes('does not match')) {
        try {
          const existing = await gitHubGetFile(SELECTIONS_PATH);
          sha = existing.sha;
          continue;
        } catch { }
      }
      if (i >= 3) throw e;
      await new Promise(r => setTimeout(r, 1000));
    }
  }
}
