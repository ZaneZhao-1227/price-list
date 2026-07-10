/**
 * 采购汇总系统 — 物品分类与价格数据（本地回退数据）
 *
 * 当 Gitee 未配置或网络不可用时，使用此文件内置的默认数据。
 * 管理员在管理页配置 Gitee 后，数据会从云端加载，此文件不再生效。
 */

const __fallbackCategories = [
  { id: 'instant_noodles', name: '泡面',   icon: '🍜' },
  { id: 'breakfast',      name: '早餐',   icon: '🌅' },
  { id: 'snacks',         name: '零食',   icon: '🍪' },
  { id: 'drinks',         name: '饮料',   icon: '🥤' },
  { id: 'frozen',         name: '冻品',   icon: '🧊' },
  { id: 'condiment',      name: '调味品', icon: '🧂' },
  { id: 'toiletries',     name: '日用品', icon: '🧴' },
  { id: 'other',          name: '其他',   icon: '📦' },
];

const __fallbackItems = [
  { id: 'ksf_hnb',  name: '康师傅红烧牛肉面', category: 'instant_noodles', price: 0, unit: '包' },
  { id: 'ty_ltss',  name: '统一老坛酸菜面',   category: 'instant_noodles', price: 0, unit: '包' },
  { id: 'bread',    name: '面包',             category: 'breakfast', price: 0, unit: '个' },
  { id: 'milk',     name: '纯牛奶',           category: 'breakfast', price: 0, unit: '盒' },
  { id: 'yogurt',   name: '酸奶',             category: 'breakfast', price: 0, unit: '杯' },
  { id: 'egg',      name: '水煮蛋',           category: 'breakfast', price: 0, unit: '个' },
  { id: 'chips',    name: '薯片',             category: 'snacks', price: 0, unit: '袋' },
  { id: 'choco',    name: '巧克力',           category: 'snacks', price: 0, unit: '条' },
  { id: 'cola',     name: '可口可乐',         category: 'drinks', price: 0, unit: '瓶' },
  { id: 'water',    name: '矿泉水',           category: 'drinks', price: 0, unit: '瓶' },
  { id: 'oj',       name: '橙汁',             category: 'drinks', price: 0, unit: '盒' },
  { id: 'salt',     name: '食盐',             category: 'condiment', price: 0, unit: '袋' },
  { id: 'soysauce', name: '生抽酱油',         category: 'condiment', price: 0, unit: '瓶' },
  { id: 'vinegar',  name: '醋',               category: 'condiment', price: 0, unit: '瓶' },
  { id: 'tissue',   name: '纸巾',             category: 'toiletries', price: 0, unit: '包' },
  { id: 'soap',     name: '肥皂',             category: 'toiletries', price: 0, unit: '块' },
];

// 暴露到全局，供 select.js / summary.js 在 Gitee 不可用时回退
window.__fallbackCategories = __fallbackCategories;
window.__fallbackItems = __fallbackItems;
