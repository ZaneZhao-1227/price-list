/**
 * 汇总端 — 采购汇总页面逻辑
 */

// ============================================================
// DOM
// ============================================================
const $ = s => document.querySelector(s);

const elDate      = $('#date-badge');
const elSummary   = $('#summary-container');
const elUsers     = $('#user-list');
const elRefresh   = $('#btn-refresh');
const elToast     = $('#toast');
const elConfigTip = $('#config-tip');

// ============================================================
// 状态
// ============================================================
let items = [];
let categories = [];

// ============================================================
// 初始化
// ============================================================
async function init() {
  elDate.textContent = `明日采购 · ${formatDate(getTomorrowDate())}`;

  if (!hasGiteeConfig()) {
    elConfigTip.style.display = 'block';
  }

  await loadData();
  render();
  bindEvents();
}

function bindEvents() {
  elRefresh.addEventListener('click', async () => {
    await loadData();
    render();
    showToast('已刷新');
  });
}

// ============================================================
// 加载数据
// ============================================================
async function loadData() {
  // 加载物品清单
  try {
    const data = await fetchItems();
    items = data.items || [];
    categories = data.categories || [];
  } catch {
    items = window.__fallbackItems || [];
    categories = window.__fallbackCategories || [];
  }
}

// ============================================================
// 渲染
// ============================================================
async function render() {
  let selections = {};

  if (hasGiteeConfig()) {
    try {
      selections = await fetchSelections();
    } catch { /* 文件还不存在 */ }
  }

  // 同时也合并本地数据（如果同一浏览器）
  mergeLocalSelections(selections);

  const userList = Object.keys(selections);
  renderUserList(userList);
  renderSummary(selections, userList);
}

function mergeLocalSelections(selections) {
  try {
    const raw = localStorage.getItem('purchase_selections');
    if (raw) {
      const local = JSON.parse(raw);
      for (const [user, sel] of Object.entries(local)) {
        if (!selections[user]) {
          selections[user] = sel;
        }
      }
    }
  } catch { /* ignore */ }
}

function renderUserList(userList) {
  if (userList.length === 0) {
    elUsers.innerHTML = '<span style="color:var(--color-text-secondary);font-size:13px;">暂无用户提交</span>';
    return;
  }
  elUsers.innerHTML = userList.map(name =>
    `<span class="user-tag">${name}</span>`
  ).join('');
}

function renderSummary(selections, userList) {
  if (userList.length === 0) {
    elSummary.innerHTML = `<div class="empty-state">
      <div class="icon">📋</div>
      <p>还没有人提交选购清单<br>去「选购」页面填写吧</p>
    </div>`;
    return;
  }

  if (items.length === 0) {
    elSummary.innerHTML = `<div class="empty-state">
      <div class="icon">📦</div>
      <p>暂无物品数据<br>请管理员在「管理」页添加物品</p>
    </div>`;
    return;
  }

  // 按分类分组
  const grouped = {};
  for (const cat of categories) grouped[cat.id] = [];
  for (const item of items) {
    if (grouped[item.category]) grouped[item.category].push(item);
  }

  let html = '';
  let grandTotalQty = 0;
  let grandTotalAmount = 0;

  for (const cat of categories) {
    const catItems = grouped[cat.id];
    if (!catItems || catItems.length === 0) continue;

    // 统计这个分类的选购情况
    const rows = [];
    let catTotalQty = 0;
    let catTotalAmount = 0;

    for (const item of catItems) {
      let totalQty = 0;
      const perUser = [];

      for (const user of userList) {
        const qty = selections[user][item.id] || 0;
        if (qty > 0) {
          totalQty += qty;
          perUser.push({ user, qty });
        }
      }

      if (totalQty === 0) continue;
      const amount = totalQty * item.price;
      catTotalQty += totalQty;
      catTotalAmount += amount;

      rows.push({ item, totalQty, amount, perUser });
    }

    if (rows.length === 0) continue;

    grandTotalQty += catTotalQty;
    grandTotalAmount += catTotalAmount;

    html += `<div class="category-section">
      <div class="category-header">
        <span class="icon">${cat.icon || '📦'}</span>
        ${cat.name}
      </div>
      <table class="summary-table">
        <thead>
          <tr>
            <th style="width:40px;"></th>
            <th>物品</th>
            <th>单价</th>
            <th>数量</th>
            <th>小计</th>
            <th>选购人</th>
          </tr>
        </thead>
        <tbody>`;

    for (const { item, totalQty, amount, perUser } of rows) {
      const hasPhoto = item.photo && item.photo.startsWith('http');
      html += `<tr>
        <td>${hasPhoto ? `<img class="summary-photo" src="${item.photo}" alt="${item.name}" onerror="this.style.display='none'">` : ''}</td>
        <td>${item.name}</td>
        <td>¥${item.price.toFixed(1)}</td>
        <td>${totalQty} ${item.unit}</td>
        <td>¥${amount.toFixed(1)}</td>
        <td>${perUser.map(p => `<span class="user-tag">${p.user}×${p.qty}</span>`).join('')}</td>
      </tr>`;
    }

    html += `<tr class="total-row">
      <td colspan="2">小计</td>
      <td></td>
      <td>${catTotalQty}</td>
      <td>¥${catTotalAmount.toFixed(1)}</td>
      <td></td>
    </tr>`;

    html += `</tbody></table></div>`;
  }

  // 全局总计
  html += renderGrandTotal(userList, grandTotalQty, grandTotalAmount);
  elSummary.innerHTML = html;
}

function renderGrandTotal(userList, totalQty, totalAmount) {
  return `<div class="grand-total">
    <div>
      <div class="grand-label">参与人数</div>
      <div class="grand-value">${userList.length}</div>
    </div>
    <div>
      <div class="grand-label">物品总数</div>
      <div class="grand-value">${totalQty}</div>
    </div>
    <div>
      <div class="grand-label">总金额</div>
      <div class="grand-value grand-amount">¥${totalAmount.toFixed(1)}</div>
    </div>
  </div>`;
}

// ============================================================
// Toast
// ============================================================
let toastTimer = null;
function showToast(msg) {
  elToast.textContent = msg;
  elToast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => elToast.classList.remove('show'), 2000);
}

// ============================================================
// 启动
// ============================================================
document.addEventListener('DOMContentLoaded', init);
