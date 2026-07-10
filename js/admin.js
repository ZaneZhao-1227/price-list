/**
 * 管理页 — 物品管理逻辑
 */

// ============================================================
// 状态
// ============================================================
let state = {
  items: [],          // items array
  categories: [],     // categories array
  editingIndex: -1,   // -1 = 新增, >=0 = 编辑
};

// DOM 引用
const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

// ============================================================
// 默认分类（内置 / 不可删除，但可增）
// ============================================================
const DEFAULT_CATEGORIES = [
  { id: 'instant_noodles', name: '泡面',   icon: '🍜' },
  { id: 'breakfast',      name: '早餐',   icon: '🌅' },
  { id: 'snacks',         name: '零食',   icon: '🍪' },
  { id: 'drinks',         name: '饮料',   icon: '🥤' },
  { id: 'frozen',         name: '冻品',   icon: '🧊' },
  { id: 'condiment',      name: '调味品', icon: '🧂' },
  { id: 'toiletries',     name: '日用品', icon: '🧴' },
  { id: 'other',          name: '其他',   icon: '📦' },
];

// ============================================================
// 初始化
// ============================================================
async function init() {
  // 加载配置
  const cfg = getGiteeConfig();
  $('#gitee-owner').value  = cfg.owner || '';
  $('#gitee-repo').value   = cfg.repo || '';
  $('#gitee-token').value  = cfg.token || '';
  $('#gitee-branch').value = cfg.branch || 'main';

  // 加载物品数据
  await loadItems();
  renderItems();
  renderCategories();
  renderConfigStatus();

  // 默认选中第一个分类
  if (state.categories.length > 0) {
    $('#item-category').value = state.categories[0].id;
  }

  bindEvents();
}

// ============================================================
// 加载物品
// ============================================================
async function loadItems() {
  // 先从 localStorage 恢复上次的 categories（用户自定义的）
  const customCats = loadCustomCategories();

  // 尝试从 API 加载（优先用线上数据）
  if (hasGiteeConfig()) {
    try {
      const data = await fetchItems();
      if (data.items && data.items.length > 0) {
        // 线上有物品 → 用线上的（覆盖本地）
        state.items = data.items;
        state.categories = data.categories || [...DEFAULT_CATEGORIES, ...customCats];
        return;
      }
    } catch {
      // API 失败，fallback 到本地
    }
  }

  // 从 localStorage 加载（本地可能有未同步的物品）
  const local = loadLocalItems();
  if (local && local.items && local.items.length > 0) {
    state.items = local.items;
    state.categories = local.categories || [...DEFAULT_CATEGORIES, ...customCats];
  } else {
    state.items = [];
    state.categories = [...DEFAULT_CATEGORIES, ...customCats];
  }
}

// ============================================================
// 渲染
// ============================================================
function renderItems() {
  const container = $('#item-list');
  if (state.items.length === 0) {
    container.innerHTML = `<div class="empty-state"><p>还没有物品，点击上方「添加物品」开始</p></div>`;
    return;
  }

  // 按分类分组显示
  const grouped = {};
  for (const cat of state.categories) grouped[cat.id] = [];
  for (const item of state.items) {
    if (grouped[item.category]) grouped[item.category].push(item);
  }

  let html = '';
  for (const cat of state.categories) {
    const list = grouped[cat.id];
    if (!list || list.length === 0) continue;

    html += `<div class="admin-cat-section">
      <div class="admin-cat-title">${cat.icon} ${cat.name}（${list.length}）</div>`;

    for (let i = 0; i < list.length; i++) {
      const item = list[i];
      const globalIdx = state.items.indexOf(item);
      html += `<div class="admin-item-row">
        ${item.photo ? `<img class="admin-thumb" src="${item.photo}" alt="${item.name}" onerror="this.style.display='none'">` : ''}
        <div class="admin-item-info">
          <div class="admin-item-name">${item.name}</div>
          <div class="admin-item-meta">¥${item.price.toFixed(1)} / ${item.unit}</div>
        </div>
        <div class="admin-item-actions">
          <button class="btn-sm btn-edit" data-index="${globalIdx}">编辑</button>
          <button class="btn-sm btn-del" data-index="${globalIdx}">删除</button>
        </div>
      </div>`;
    }

    html += `</div>`;
  }

  container.innerHTML = html;

  // 绑定编辑/删除事件
  container.querySelectorAll('.btn-edit').forEach(btn => {
    btn.addEventListener('click', () => editItem(parseInt(btn.dataset.index)));
  });
  container.querySelectorAll('.btn-del').forEach(btn => {
    btn.addEventListener('click', () => deleteItem(parseInt(btn.dataset.index)));
  });
}

function renderCategories() {
  const sel = $('#item-category');
  // 保留当前选中
  const current = sel.value;
  sel.innerHTML = state.categories.map(c =>
    `<option value="${c.id}">${c.icon} ${c.name}</option>`
  ).join('');
  // 尝试恢复选中
  if (current && sel.querySelector(`option[value="${current}"]`)) {
    sel.value = current;
  }
}

function renderConfigStatus() {
  const el = $('#gitee-status');
  if (hasGiteeConfig()) {
    el.textContent = '✅ 已配置';
    el.style.color = 'var(--color-accent)';
  } else {
    el.textContent = '⚠️ 未配置';
    el.style.color = 'var(--color-warning)';
  }
}

// ============================================================
// 事件绑定
// ============================================================
function bindEvents() {
  // 新增物品
  $('#btn-add-item').addEventListener('click', () => {
    resetForm();
    state.editingIndex = -1;
    $('#form-title').textContent = '添加物品';
    $('#item-form').style.display = 'block';
  });

  // 取消
  $('#btn-cancel-form').addEventListener('click', () => {
    $('#item-form').style.display = 'none';
  });

  // 保存表单
  $('#btn-save-form').addEventListener('click', saveItemForm);

  // 从 GitHub 加载
  $('#btn-load-gitee').addEventListener('click', loadFromGitee);

  // 保存配置
  $('#btn-save-config').addEventListener('click', saveConfig);



  // 新增分类
  $('#btn-add-category').addEventListener('click', addCategory);
}

// ============================================================
// 物品表单
// ============================================================
function resetForm() {
  $('#item-id').value = '';
  $('#item-name').value = '';
  $('#item-price').value = '';
  $('#item-unit').value = '个';
  $('#item-photo').value = '';
  if (state.categories.length > 0) {
    $('#item-category').value = state.categories[0].id;
  }
}

function editItem(index) {
  const item = state.items[index];
  if (!item) return;

  state.editingIndex = index;
  $('#form-title').textContent = '编辑物品';
  $('#item-id').value = item.id || '';
  $('#item-name').value = item.name;
  $('#item-price').value = item.price;
  $('#item-unit').value = item.unit;
  $('#item-photo').value = item.photo || '';
  $('#item-category').value = item.category;
  $('#item-form').style.display = 'block';
}

function saveItemForm() {
  const name = $('#item-name').value.trim();
  const price = parseFloat($('#item-price').value);
  const unit = $('#item-unit').value.trim();
  const category = $('#item-category').value;
  const photo = $('#item-photo').value.trim();
  let id = $('#item-id').value.trim();

  if (!name) { showToast('请输入物品名称'); return; }
  if (isNaN(price) || price < 0) { showToast('请输入有效价格'); return; }
  if (!unit) { showToast('请输入单位'); return; }
  if (!category) { showToast('请选择分类'); return; }

  // 自动生成 ID
  if (!id) {
    id = name.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]/g, '_').slice(0, 30);
    // 去重
    let suffix = '';
    while (state.items.some(i => i.id === id + suffix && (state.editingIndex < 0 || state.items[state.editingIndex].id !== id + suffix))) {
      suffix = suffix ? (parseInt(suffix) + 1).toString() : '2';
    }
    id = id + suffix;
  }

  const item = { id, name, price, unit, category };
  if (photo) item.photo = photo;

  if (state.editingIndex >= 0) {
    state.items[state.editingIndex] = item;
  } else {
    state.items.push(item);
  }

  $('#item-form').style.display = 'none';
  renderItems();
  showToast(state.editingIndex >= 0 ? '已更新物品' : '已添加物品');
  autoSave();
  
  // 自动同步到 GitHub（有 token 时）
  if (hasGiteeConfig()) {
    // 延迟同步，避免 UI 卡顿
    setTimeout(async () => {
      try {
        const data = { categories: state.categories, items: state.items };
        await saveItems(data);
        showToast('✅ 已添加并同步');
      } catch (e) {
        showToast('⚠️ 已保存本地，同步失败: ' + e.message);
      }
    }, 100);
  } else {
    showToast('已添加，别忘了同步到 GitHub');
  }
}

function deleteItem(index) {
  if (!confirm('确定删除该物品？')) return;
  state.items.splice(index, 1);
  renderItems();
  showToast('已删除');
  autoSave();
  
  if (hasGiteeConfig()) {
    setTimeout(async () => {
      try {
        const data = { categories: state.categories, items: state.items };
        await saveItems(data);
      } catch { }
    }, 100);
  }
}

// ============================================================
// 分类管理
// ============================================================
function addCategory() {
  const name = prompt('请输入新分类名称：');
  if (!name || !name.trim()) return;
  const id = name.trim().toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]/g, '_');
  if (state.categories.some(c => c.id === id)) {
    showToast('该分类已存在');
    return;
  }
  state.categories.push({ id, name: name.trim(), icon: '📦' });
  saveCustomCategories(state.categories.filter(c => !DEFAULT_CATEGORIES.some(d => d.id === c.id)));
  renderCategories();
  renderConfigStatus();
  $('#item-category').value = id;
  showToast(`已添加分类「${name.trim()}」`);
  autoSave();
}

// ============================================================
// 配置管理
// ============================================================
function saveConfig() {
  const config = {
    owner:  $('#gitee-owner').value.trim(),
    repo:   $('#gitee-repo').value.trim(),
    token:  $('#gitee-token').value.trim(),
    branch: $('#gitee-branch').value.trim() || 'main',
  };
  saveGiteeConfig(config);
  renderConfigStatus();
  showToast('配置已保存');
}

// ============================================================
// Gitee 同步
// ============================================================
async function saveToGitee() {
  if (!hasGiteeConfig()) {
    showToast('请先配置 Gitee 仓库信息');
    return;
  }

  try {
    const data = { categories: state.categories, items: state.items };
    await saveItems(data);
    showToast('✅ 已同步到 Gitee 仓库');
  } catch (e) {
    showToast('❌ 同步失败: ' + e.message);
    console.error(e);
  }
}

async function loadFromGitee() {
  if (!hasGiteeConfig()) {
    showToast('请先配置 Gitee 仓库信息');
    return;
  }

  try {
    const data = await fetchItems();
    state.items = data.items || [];
    state.categories = data.categories || [...DEFAULT_CATEGORIES];
    renderItems();
    renderCategories();
  renderConfigStatus();
    showToast('✅ 已从 Gitee 加载');
  } catch (e) {
    showToast('❌ 加载失败: ' + e.message);
    console.error(e);
  }
}

// ============================================================
// 本地回退存储
// ============================================================
const LOCAL_ITEMS_KEY = 'admin_items';

/** 数据变更时自动保存到本地（防止意外丢失） */
function autoSave() {
  saveLocalItems({ categories: state.categories, items: state.items });
}

function saveLocalItems(data) {
  localStorage.setItem(LOCAL_ITEMS_KEY, JSON.stringify(data));
}

function loadLocalItems() {
  try {
    const raw = localStorage.getItem(LOCAL_ITEMS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

const CUSTOM_CATS_KEY = 'admin_custom_categories';

function saveCustomCategories(cats) {
  localStorage.setItem(CUSTOM_CATS_KEY, JSON.stringify(cats));
}

function loadCustomCategories() {
  try {
    const raw = localStorage.getItem(CUSTOM_CATS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

// ============================================================
// Toast
// ============================================================
let toastTimer = null;
function showToast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2500);
}

// ============================================================
// 启动
// ============================================================
document.addEventListener('DOMContentLoaded', init);
