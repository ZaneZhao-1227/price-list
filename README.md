# 🛒 明日采购 · 采购汇总系统

一个基于 Gitee Pages 托管的采购汇总工具。支持多人选购物品并按类别自动汇总。

## 功能

- **选购页** (`index.html`)：用户输入姓名后，选择明日需要的物品及数量
- **汇总页** (`summary.html`)：按类别（泡面、早餐、饮料等）自动分组展示所有用户的选购汇总
- 数据存储在浏览器本地（localStorage），后续可扩展 Gitee API 实现多端同步

## 使用方式

### 方式一：本地打开

直接双击 `index.html` 或 `summary.html` 即可使用（需现代浏览器）。

### 方式二：部署到 Gitee Pages

1. 在 Gitee 创建仓库并推送本代码
2. 进入仓库 → 「服务」→「Gitee Pages」→ 选择部署分支和目录
3. 开启后即可通过 `https://你的用户名.gitee.io/仓库名/` 访问

## 自定义物品清单

编辑 `js/data.js`，修改 `categories` 和 `items` 数组：

```js
// 添加分类
{ id: 'fruits', name: '水果', icon: '🍎' },

// 添加物品（price > 0 才会在页面显示）
{ id: 'apple', name: '苹果', category: 'fruits', price: 3.5, unit: '个' },
```

## 技术栈

纯 HTML + CSS + JavaScript（ES Module），无外部依赖，兼容所有现代浏览器。
