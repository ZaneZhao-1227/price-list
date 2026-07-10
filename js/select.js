/**
 * 用户端 — 选购页面逻辑
 * 每 30 秒自动刷新物品清单
 */

// ============================================================
// 状态
// ============================================================
let state = {
  username: '',
  selections: {},
  items: [],
  categories: [],
  lastLoadTime: null,
};

// DOM
const $ = s => document.querySelector(s);
const elUsername   = $('#username');
const elDate       = $('#date-badge');
const elContainer  = $('#items-container');
const elSaveBtn    = $('#btn-save');
const elResetBtn   = $('#btn-reset');
const elToast      = $('#toast');
const elPeople     = $('#people-count');
const elUpdateTime = $('#update-time');

let autoTimer = null;

// ============================================================
// 初始化
// ============================================================
async function init() {
  elDate.textContent = `明日采购 · ${formatDate(getTomorrowDate())}`;

  // 恢复上次用户名
  const savedUser = localStorage.getItem('last_username');
  if (savedUser) {
    state.username = savedUser;
    elUsername.value = savedUser;
  }

  await loadItems();
  state.selections = loadUser(state.username);

  renderItems();
  renderPeople();
  bindEvents();

  // 启动自动刷新（30 秒）
  startAutoRefresh();
}

function startAutoRefresh() {
  if (autoTimer) clearInterval(autoTimer);
  autoTimer = setInterval(async () => {
    await refreshItems();
  }, 15000);
}

// ============================================================
// 加载物品
// ============================================================
async function loadItems() {
  try {
    const data = await fetchItems();
    state.items = data.items || [];
    state.categories = data.categories || [];
    state.lastLoadTime = new Date();
  } catch {
    state.items = window.__fallbackItems || [];
    state.categories = window.__fallbackCategories || [];
  }
}

/** 刷新物品清单（保留用户已选数量） */
async function refreshItems() {
  const oldItems = state.items;
  await loadItems();

  // 检查物品是否有变化
  const changed = JSON.stringify(oldItems.map(i => i.id).sort()) !==
                  JSON.stringify(state.items.map(i => i.id).sort());
  if (changed && elUpdateTime) {
    const now = state.lastLoadTime;
    elUpdateTime.textContent = `物品已更新 (${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}:${now.getSeconds().toString().padStart(2,'0')})`;
    elUpdateTime.style.color = 'var(--color-accent)';
    setTimeout(() => { elUpdateTime.style.color = ''; }, 3000);
  }

  renderItems();
}

// ============================================================
// 渲染
// ============================================================
function renderItems() {
  if (state.items.length === 0) {
    elContainer.innerHTML = `<div class="empty-state">
      <div class="icon">📦</div>
      <p>暂无可选购的物品<br>请管理员先在「管理」页添加物品并同步</p>
    </div>`;
    return;
  }

  const grouped = {};
  for (const cat of state.categories) grouped[cat.id] = [];
  for (const item of state.items) {
    if (grouped[item.category]) grouped[item.category].push(item);
  }

  let html = '';
  for (const cat of state.categories) {
    const list = grouped[cat.id];
    if (!list || list.length === 0) continue;

    html += `<div class="category-section">`;
    html += `<div class="category-header">
      <span class="icon">${cat.icon || '📦'}</span>
      ${cat.name}
      <span class="count">${list.length} 种</span>
    </div>`;
    html += `<div class="items-grid">`;
    for (const item of list) {
      const qty = state.selections[item.id] || 0;
      html += cardHTML(item, qty);
    }
    html += `</div></div>`;
  }

  elContainer.innerHTML = html;
}

function cardHTML(item, qty) {
  const hasPhoto = item.photo && item.photo.startsWith('http');
  return `<div class="item-card" data-id="${item.id}">
    ${hasPhoto ? `<img class="item-photo" src="${item.photo}" alt="${item.name}" onerror="this.style.display='none'">` : ''}
    <div class="info">
      <div class="name">${item.name}</div>
      <div class="meta">¥${item.price.toFixed(1)} / ${item.unit}</div>
    </div>
    <div class="qty-control">
      <button class="btn-dec" data-id="${item.id}" ${qty <= 0 ? 'disabled' : ''}>−</button>
      <span class="qty">${qty}</span>
      <button class="btn-inc" data-id="${item.id}">+</button>
    </div>
  </div>`;
}

/** 显示已提交人数 */
async function renderPeople() {
  // 通过公开 API 读取选购人数（无需 token）
  try {
    const selections = await fetchSelections();
    const count = Object.keys(selections).length;
    elPeople.textContent = count > 0 ? `${count} 人已选购` : '暂无提交';
  } catch {
    elPeople.textContent = '';
  }
}

// ============================================================
// 事件
// ============================================================
function bindEvents() {
  elContainer.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const id = btn.dataset.id;
    if (!id) return;
    if (btn.classList.contains('btn-inc')) changeQty(id, 1);
    else if (btn.classList.contains('btn-dec')) changeQty(id, -1);
  });

  elUsername.addEventListener('input', () => {
    state.username = elUsername.value.trim();
    localStorage.setItem('last_username', state.username);
    state.selections = loadUser(state.username);
    renderItems();
  });

  elSaveBtn.addEventListener('click', save);
  elResetBtn.addEventListener('click', resetSelections);


}

function changeQty(id, delta) {
  const current = state.selections[id] || 0;
  const next = Math.max(0, current + delta);
  if (next === current) return;
  state.selections[id] = next;
  renderItems();
}

// ============================================================
// 保存
// ============================================================
async function save() {
  if (!state.username) {
    showToast('请先输入你的名字');
    return;
  }

  const cleaned = {};
  for (const [id, qty] of Object.entries(state.selections)) {
    if (qty > 0) cleaned[id] = qty;
  }
  state.selections = cleaned;

  saveUser(state.username, cleaned);

  // 没有 token 时弹窗让用户输入一次
  if (!hasGiteeConfig()) {
    const token = prompt('需要输入共享密钥才能同步。
请联系管理员获取密钥：');
    if (token && token.trim()) {
      const cfg = getGiteeConfig();
      cfg.token = token.trim();
      saveGiteeConfig(cfg);
    }
  }

  if (hasGiteeConfig()) {
    try {
      let all = {};
      try { all = await fetchSelections(); } catch { }
      all[state.username] = cleaned;
      await saveSelections(all);
      showToast('✅ 已保存');
    } catch (e) {
      showToast('⚠️ 已保存到本地，同步失败: ' + e.message);
    }
  } else {
    showToast('✅ 已保存到本地');
  }
  renderPeople();
}

function resetSelections() {
  if (!state.username) return;
  state.selections = {};
  renderItems();
  showToast('已清空选购');
}

// ============================================================
// Toast
// ============================================================
let toastTimer = null;
function showToast(msg) {
  elToast.textContent = msg;
  elToast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => elToast.classList.remove('show'), 2500);
}

// ============================================================
// 启动
// ============================================================
document.addEventListener('DOMContentLoaded', init);
