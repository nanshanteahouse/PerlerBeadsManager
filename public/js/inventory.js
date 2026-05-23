(function () {
  'use strict';

  const LOW_STOCK_THRESHOLD = 50;

  let inventoryData = [];
  let colorsData = {};
  let storesData = [];
  let currentSeries = 'all';
  let searchQuery = '';
  let sortBy = 'code';
  let sortOrder = 'asc';
  let currentStockFilter = 'all';

  function init() {
    loadData();
    bindEvents();
    PBM.initFilterBar(document.getElementById('filter-bar'));
  }

  function loadData() {
    Promise.all([
      PBM.apiFetch('/api/inventory'),
      PBM.apiFetch('/api/colors'),
      PBM.apiFetch('/api/inventory/stores'),
      PBM.apiFetch('/api/transactions?_limit=10'),
      PBM.apiFetch('/api/inventory/stats'),
    ])
      .then(([inventory, colors, stores, transactions, stats]) => {
        inventoryData = inventory;
        colorsData = {};
        (colors || []).forEach(function (c) { colorsData[c.code] = c; });
        storesData = stores;
        renderStats(stats);
        renderInventory();
        renderTransactions(transactions);
        populateColorSelect();
        populateStoreSelect();
      })
      .catch((err) => {
        PBM.showToast('加载数据失败: ' + err.message, 'error');
      });
  }

  function renderStats(stats) {
    document.getElementById('stat-total-colors').textContent = stats.totalColors;
    document.getElementById('stat-total-beads').textContent = formatNumber(stats.totalBeads);
    document.getElementById('stat-low-stock').textContent = stats.lowStockCount;
    document.getElementById('stat-out-stock').textContent = stats.outOfStockCount;
    document.getElementById('stat-mixed-beads').textContent = formatNumber(stats.mixedBeads || 0);
  }

  function formatNumber(num) {
    if (num >= 10000) {
      return (num / 10000).toFixed(1) + '万';
    }
    return num.toLocaleString();
  }

  function sortInventory(items) {
    var order = sortOrder === 'asc' ? 1 : -1;
    return items.slice().sort(function (a, b) {
      if (sortBy === 'quantity') {
        return (a.quantity - b.quantity) * order || a.code.localeCompare(b.code);
      }
      return a.code.localeCompare(b.code) * order;
    });
  }

  function filterInventory(items) {
    let filtered = items;

    if (currentSeries !== 'all') {
      filtered = filtered.filter((item) => item.series === currentSeries);
    }

    if (currentStockFilter !== 'all') {
      filtered = filtered.filter((item) => {
        if (currentStockFilter === 'in-stock') return item.quantity > 0;
        if (currentStockFilter === 'low') return item.quantity > 0 && item.quantity <= LOW_STOCK_THRESHOLD;
        if (currentStockFilter === 'out') return item.quantity === 0;
        return true;
      });
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((item) => {
        const color = colorsData[item.code] || {};
        return (
          item.code.toLowerCase().includes(q) ||
          (color.name && color.name.toLowerCase().includes(q))
        );
      });
    }

    return filtered;
  }

  function updateSortIndicators() {
    document.querySelectorAll('.sort-indicator').forEach(function (el) {
      el.textContent = '';
      el.className = 'sort-indicator';
    });
    var activeIndicator = document.getElementById('sort-' + sortBy);
    if (activeIndicator) {
      activeIndicator.textContent = sortOrder === 'asc' ? ' \u25B2' : ' \u25BC';
      activeIndicator.classList.add('sort-indicator--active');
    }
  }

  function renderInventory() {
    const tbody = document.getElementById('inventory-tbody');
    const filtered = filterInventory(inventoryData);
    const sorted = sortInventory(filtered);

    updateSortIndicators();

    if (sorted.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="empty-state">暂无数据</td></tr>';
      return;
    }

    tbody.innerHTML = sorted.map((item) => {
      const color = colorsData[item.code] || {};
      const hex = color.hex || '#cccccc';
      const textColor = PBM.getTextColor(hex);
      const isLow = item.quantity > 0 && item.quantity <= LOW_STOCK_THRESHOLD;
      const isOut = item.quantity === 0;
      if (item.code === 'MIX') {
        return `
          <tr class="inventory-row--mixed" data-code="${item.code}">
            <td>
              <div class="color-swatch color-swatch--mixed">
                MIX
              </div>
            </td>
            <td>混豆</td>
            <td>${item.quantity}</td>
            <td>
              <div class="flex gap-4 flex-wrap">
                <button class="btn btn--xs btn--secondary" data-action="add" data-qty="1">+1</button>
                <button class="btn btn--xs btn--secondary" data-action="add" data-qty="10">+10</button>
                <button class="btn btn--xs btn--secondary" data-action="add" data-qty="50">+50</button>
                <button class="btn btn--xs btn--secondary" data-action="sub" data-qty="1">-1</button>
                <button class="btn btn--xs btn--secondary" data-action="sub" data-qty="10">-10</button>
                <button class="btn btn--xs btn--secondary" data-action="sub" data-qty="50">-50</button>
                <button class="btn btn--xs btn--secondary" data-action="adjust">调整</button>
                <button class="btn btn--xs btn--ghost" data-action="record">记录</button>
              </div>
            </td>
          </tr>
        `;
      }
      const rowClass = isOut ? 'inventory-row--out' : isLow ? 'inventory-row--low' : '';
      const qtyClass = isOut ? 'stock-value--out' : isLow ? 'stock-value--low' : '';

      return `
        <tr class="${rowClass}" data-code="${item.code}">
          <td>
            <div class="color-swatch" style="background-color: ${hex}; color: ${textColor};">
              ${item.code}
            </div>
          </td>
          <td>${color.name || '-'}</td>
          <td class="${qtyClass}">${item.quantity}</td>
          <td>
            <div class="flex gap-4 flex-wrap">
              <button class="btn btn--xs btn--secondary" data-action="add" data-qty="1">+1</button>
              <button class="btn btn--xs btn--secondary" data-action="add" data-qty="10">+10</button>
              <button class="btn btn--xs btn--secondary" data-action="add" data-qty="50">+50</button>
              <button class="btn btn--xs btn--secondary" data-action="sub" data-qty="1">-1</button>
              <button class="btn btn--xs btn--secondary" data-action="sub" data-qty="10">-10</button>
              <button class="btn btn--xs btn--secondary" data-action="sub" data-qty="50">-50</button>
              <button class="btn btn--xs btn--ghost" data-action="adjust">调整</button>
              <button class="btn btn--xs btn--ghost" data-action="record">记录</button>
              <button class="btn btn--xs btn--ghost" data-action="mix-transfer">→混豆</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    addResponsiveLabels(tbody);
  }

  function addResponsiveLabels(tbody) {
    if (window.innerWidth <= 767) {
      tbody.querySelectorAll('tr').forEach((row) => {
        const cells = row.querySelectorAll('td');
        const headers = ['色号', '名称', '当前库存', '操作'];
        cells.forEach((cell, i) => {
          if (!cell.querySelector('.color-swatch')) {
            cell.setAttribute('data-label', headers[i]);
          }
        });
      });
    }
  }

  function renderTransactions(transactions) {
    const tbody = document.getElementById('transactions-tbody');

    if (!transactions || transactions.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="empty-state">暂无交易记录</td></tr>';
      return;
    }

    tbody.innerHTML = transactions.map((tx) => {
      const color = colorsData[tx.colorCode] || {};
      const typeLabels = { purchase: '购买', consumption: '消耗', adjustment: '调整' };
      const qtyPrefix = tx.quantity >= 0 ? '+' : '';

      return `
        <tr data-id="${tx.id}">
          <td>${tx.date}</td>
          <td class="font-mono">${tx.colorCode}</td>
          <td>${typeLabels[tx.type] || tx.type}</td>
          <td class="${tx.quantity >= 0 ? 'text-success' : 'text-danger'}">${qtyPrefix}${tx.quantity}</td>
          <td>${tx.store || '-'}</td>
          <td class="truncate" style="max-width: 150px;">${tx.note || '-'}</td>
          <td>
            <button class="btn btn--xs btn--ghost" data-action="edit-tx" data-id="${tx.id}">编辑</button>
            <button class="btn btn--xs btn--danger" data-action="delete-tx" data-id="${tx.id}">删除</button>
          </td>
        </tr>
      `;
    }).join('');
  }

  function populateColorSelect() {
    const select = document.getElementById('purchase-color');
    const items = inventoryData.slice();
    items.sort(function (a, b) { return a.code < b.code ? -1 : a.code > b.code ? 1 : 0; });

    select.innerHTML = '<option value="">选择色号...</option>' +
      items.map(function (item) {
        const color = colorsData[item.code] || {};
        const hex = color.hex || '#cccccc';
        const prefix = item.code === 'MIX' ? '\u2605 ' : '';
        return '<option value="' + item.code + '" data-hex="' + hex + '">' + prefix + item.code + ' - ' + (color.name || '未命名') + '</option>';
      }).join('');
  }

  function populateStoreSelect() {
    const select = document.getElementById('purchase-store');
    select.innerHTML = '<option value="">选择店家...</option>' +
      storesData.map((store) => `<option value="${store}">${store}</option>`).join('');
  }

  function openMixTransferModal(code) {
    var item = inventoryData.find(function (i) { return i.code === code; });
    if (!item) return;

    var currentStock = item.quantity;
    var defaultQty = Math.min(currentStock, 100);

    document.getElementById('mix-transfer-code').value = code;
    document.getElementById('mix-transfer-current').value = currentStock;
    document.getElementById('mix-transfer-quantity').value = defaultQty;
    document.getElementById('mix-transfer-quantity').max = currentStock;
    updateMixTransferPreview();

    PBM.openModal('mix-transfer-modal');
  }

  function updateMixTransferPreview() {
    var code = document.getElementById('mix-transfer-code').value;
    var current = parseInt(document.getElementById('mix-transfer-current').value, 10);
    var qty = parseInt(document.getElementById('mix-transfer-quantity').value, 10) || 0;
    var remaining = current - qty;
    document.getElementById('mix-transfer-preview').textContent =
      code + ': ' + current + ' \u2192 ' + remaining + ' | MIX: +' + qty;
  }

  function submitMixTransfer() {
    var code = document.getElementById('mix-transfer-code').value;
    var qty = parseInt(document.getElementById('mix-transfer-quantity').value, 10);

    if (!qty || qty <= 0) {
      PBM.showToast('请输入有效数量', 'error');
      return;
    }

    PBM.apiFetch('/api/inventory/mix-transfer', {
      method: 'POST',
      body: JSON.stringify({ from: code, quantity: qty }),
    })
      .then(function (result) {
        var sourceItem = inventoryData.find(function (i) { return i.code === code; });
        if (sourceItem) {
          sourceItem.quantity = result.source.quantity;
        }
        var mixItem = inventoryData.find(function (i) { return i.code === 'MIX'; });
        if (mixItem) {
          mixItem.quantity = result.mixed.quantity;
        }
        renderInventory();
        PBM.closeModal('mix-transfer-modal');
        PBM.showToast(code + ' \u2192 MIX: ' + qty + ' \u2713', 'success');
        refreshStats();
        refreshTransactions();
      })
      .catch(function (err) {
        PBM.showToast(err.message, 'error');
      });
  }

  function bindEvents() {
    document.getElementById('series-tags').addEventListener('click', (e) => {
      const tag = e.target.closest('.filter-bar__tag');
      if (!tag) return;

      document.querySelectorAll('#series-tags .filter-bar__tag').forEach((t) => t.classList.remove('filter-bar__tag--active'));
      tag.classList.add('filter-bar__tag--active');
      currentSeries = tag.dataset.series;
      renderInventory();
    });

    document.getElementById('stock-tags').addEventListener('click', (e) => {
      const tag = e.target.closest('.filter-bar__tag');
      if (!tag) return;

      document.querySelectorAll('#stock-tags .filter-bar__tag').forEach((t) => t.classList.remove('filter-bar__tag--active'));
      tag.classList.add('filter-bar__tag--active');
      currentStockFilter = tag.dataset.stock;
      renderInventory();
    });

    document.querySelectorAll('.th-sortable').forEach((th) => {
      th.addEventListener('click', () => {
        var newSortBy = th.dataset.sortBy;
        if (sortBy === newSortBy) {
          sortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
        } else {
          sortBy = newSortBy;
          sortOrder = 'asc';
        }
        renderInventory();
      });
    });

    const searchInput = document.getElementById('search-input');
    searchInput.addEventListener('input', PBM.debounce((e) => {
      searchQuery = e.target.value;
      renderInventory();
    }, 300));

    document.getElementById('inventory-tbody').addEventListener('click', handleInventoryAction);
    document.getElementById('transactions-tbody').addEventListener('click', handleTransactionAction);

    document.getElementById('add-purchase-btn').addEventListener('click', () => PBM.openModal('purchase-modal'));
    document.getElementById('manage-stores-btn').addEventListener('click', openStoresModal);

    document.getElementById('submit-purchase').addEventListener('click', submitPurchase);
    document.getElementById('submit-adjustment').addEventListener('click', submitAdjustment);
    document.getElementById('save-stores').addEventListener('click', saveStores);

    document.querySelectorAll('[data-close-modal]').forEach((btn) => {
      btn.addEventListener('click', () => PBM.closeModal(btn.dataset.closeModal));
    });

    document.getElementById('purchase-color').addEventListener('change', function () {
      const option = this.selectedOptions[0];
      if (option && option.dataset.hex) {
        this.style.borderLeftColor = option.dataset.hex;
      }
    });

    document.getElementById('submit-mix-transfer').addEventListener('click', submitMixTransfer);

    document.getElementById('mix-transfer-quantity').addEventListener('input', updateMixTransferPreview);

    document.getElementById('mix-transfer-all').addEventListener('click', function (e) {
      e.preventDefault();
      var current = parseInt(document.getElementById('mix-transfer-current').value, 10);
      document.getElementById('mix-transfer-quantity').value = current;
      updateMixTransferPreview();
    });
  }

  function handleInventoryAction(e) {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;

    const row = btn.closest('tr');
    const code = row.dataset.code;
    const action = btn.dataset.action;

    if (action === 'add' || action === 'sub') {
      const qty = parseInt(btn.dataset.qty, 10);
      const delta = action === 'add' ? qty : -qty;
      quickAdjust(code, delta);
    } else if (action === 'adjust') {
      openAdjustmentModal(code);
    } else if (action === 'record') {
      document.getElementById('purchase-color').value = code;
      PBM.openModal('purchase-modal');
    } else if (action === 'mix-transfer') {
      openMixTransferModal(code);
    }
  }

  function handleTransactionAction(e) {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;

    const row = btn.closest('tr');
    const id = row.dataset.id;
    const action = btn.dataset.action;

    if (action === 'edit-tx') {
      PBM.showToast('编辑功能开发中', 'warning');
    } else if (action === 'delete-tx') {
      if (confirm('确定要删除这条记录吗？库存将相应回滚。')) {
        deleteTransaction(id);
      }
    }
  }

  function quickAdjust(code, delta) {
    PBM.apiFetch(`/api/inventory/${code}`, {
      method: 'PUT',
      body: JSON.stringify({ quantity: delta, reason: '快速调整', delta: true }),
    })
      .then((result) => {
        const item = inventoryData.find((i) => i.code === code);
        if (item) {
          item.quantity = result.inventory.quantity;
        }
        renderInventory();
        PBM.showToast(`${code}: ${delta >= 0 ? '+' : ''}${delta} = ${result.inventory.quantity}`, 'success');
        refreshStats();
        refreshTransactions();
      })
      .catch((err) => {
        PBM.showToast(err.message, 'error');
      });
  }

  function openAdjustmentModal(code) {
    const item = inventoryData.find((i) => i.code === code);
    if (!item) return;

    document.getElementById('adjustment-code').value = code;
    document.getElementById('adjustment-current').value = item.quantity;
    document.getElementById('adjustment-quantity').value = '';
    document.getElementById('adjustment-reason').value = '';
    document.querySelector('input[name="adjustment-mode"][value="delta"]').checked = true;

    PBM.openModal('adjustment-modal');
  }

  function submitAdjustment() {
    const code = document.getElementById('adjustment-code').value;
    const current = parseInt(document.getElementById('adjustment-current').value, 10);
    const mode = document.querySelector('input[name="adjustment-mode"]:checked').value;
    const qty = parseInt(document.getElementById('adjustment-quantity').value, 10);
    const reason = document.getElementById('adjustment-reason').value.trim();

    if (!reason) {
      PBM.showToast('请填写调整原因', 'error');
      return;
    }

    let delta;
    if (mode === 'delta') {
      delta = qty;
    } else {
      delta = qty - current;
    }

    PBM.apiFetch(`/api/inventory/${code}`, {
      method: 'PUT',
      body: JSON.stringify({ quantity: delta, reason, delta: true }),
    })
      .then((result) => {
        const item = inventoryData.find((i) => i.code === code);
        if (item) {
          item.quantity = result.inventory.quantity;
        }
        renderInventory();
        PBM.closeModal('adjustment-modal');
        PBM.showToast(`${code}: ${delta >= 0 ? '+' : ''}${delta} = ${result.inventory.quantity}`, 'success');
        refreshStats();
        refreshTransactions();
      })
      .catch((err) => {
        PBM.showToast(err.message, 'error');
      });
  }

  function submitPurchase() {
    const colorCode = document.getElementById('purchase-color').value;
    const quantity = parseInt(document.getElementById('purchase-quantity').value, 10);
    const newStore = document.getElementById('purchase-new-store').value.trim();
    const storeSelect = document.getElementById('purchase-store').value;
    const store = newStore || storeSelect || null;
    const date = document.getElementById('purchase-date').value;
    const note = document.getElementById('purchase-note').value.trim();

    if (!colorCode) {
      PBM.showToast('请选择色号', 'error');
      return;
    }

    if (!quantity || quantity <= 0) {
      PBM.showToast('请输入有效数量', 'error');
      return;
    }

    if (!store) {
      PBM.showToast('请选择或输入店家', 'error');
      return;
    }

    PBM.apiFetch('/api/transactions', {
      method: 'POST',
      body: JSON.stringify({
        type: 'purchase',
        colorCode,
        quantity,
        store,
        date: date || undefined,
        note: note || undefined,
      }),
    })
      .then((tx) => {
        if (newStore && !storesData.includes(newStore)) {
          storesData.push(newStore);
          populateStoreSelect();
        }

        const item = inventoryData.find((i) => i.code === colorCode);
        if (item) {
          item.quantity += quantity;
        }

        renderInventory();
        PBM.closeModal('purchase-modal');
        document.getElementById('purchase-form').reset();
        PBM.showToast(`已添加 ${colorCode} x${quantity}`, 'success');
        refreshStats();
        refreshTransactions();
      })
      .catch((err) => {
        PBM.showToast(err.message, 'error');
      });
  }

  function openStoresModal() {
    document.getElementById('stores-list').value = storesData.join('\n');
    PBM.openModal('stores-modal');
  }

  function saveStores() {
    const text = document.getElementById('stores-list').value;
    const stores = text.split('\n').map((s) => s.trim()).filter((s) => s);

    PBM.apiFetch('/api/inventory/stores', {
      method: 'PUT',
      body: JSON.stringify({ stores }),
    })
      .then((updated) => {
        storesData = updated;
        populateStoreSelect();
        PBM.closeModal('stores-modal');
        PBM.showToast('店家列表已保存', 'success');
      })
      .catch((err) => {
        PBM.showToast(err.message, 'error');
      });
  }

  function deleteTransaction(id) {
    PBM.apiFetch(`/api/transactions/${id}`, { method: 'DELETE' })
      .then(() => {
        PBM.showToast('记录已删除', 'success');
        refreshInventory();
        refreshTransactions();
        refreshStats();
      })
      .catch((err) => {
        PBM.showToast(err.message, 'error');
      });
  }

  function refreshInventory() {
    return PBM.apiFetch('/api/inventory')
      .then((data) => {
        inventoryData = data;
        renderInventory();
      });
  }

  function refreshTransactions() {
    return PBM.apiFetch('/api/transactions?_limit=10')
      .then((data) => renderTransactions(data));
  }

  function refreshStats() {
    return PBM.apiFetch('/api/inventory/stats')
      .then((data) => renderStats(data));
  }

  window.refreshInventory = refreshInventory;
  window.refreshTransactions = refreshTransactions;
  window.refreshStats = refreshStats;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
