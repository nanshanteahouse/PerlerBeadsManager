(function () {
  'use strict';

  const MAX_ROWS = 50;
  let batchRows = [];
  let colorsData = {};
  let storesData = [];

  function init() {
    bindEvents();
  }

  function bindEvents() {
    document.getElementById('batch-purchase-btn').addEventListener('click', openBatchModal);
    document.getElementById('submit-batch-purchase').addEventListener('click', submitBatchPurchase);
    document.getElementById('batch-purchase-modal').addEventListener('click', handleModalClick);
    document.getElementById('shared-store').addEventListener('change', applySharedStore);
    document.getElementById('shared-date').addEventListener('change', applySharedDate);
  }

  function openBatchModal() {
    batchRows = [{ colorCode: '', quantity: '', store: '', date: '', note: '' }];
    loadReferenceData().then(function () {
      renderBatchRows();
      PBM.openModal('batch-purchase-modal');
    });
  }

  function loadReferenceData() {
    return Promise.all([
      PBM.apiFetch('/api/colors'),
      PBM.apiFetch('/api/inventory/stores'),
    ]).then(function (results) {
      var colors = results[0] || [];
      var stores = results[1] || [];

      colorsData = {};
      colors.forEach(function (c) { colorsData[c.code] = c; });

      storesData = stores;
      populateSharedStoreSelect();
      populateSharedDateInput();
    }).catch(function (err) {
      PBM.showToast('加载数据失败: ' + err.message, 'error');
    });
  }

  function populateSharedStoreSelect() {
    var select = document.getElementById('shared-store');
    if (!select) return;
    select.innerHTML = '<option value="">选择店家...</option>' +
      storesData.map(function (s) { return '<option value="' + escAttr(s) + '">' + escHtml(s) + '</option>'; }).join('');
  }

  function populateSharedDateInput() {
    var input = document.getElementById('shared-date');
    if (input) {
      input.value = new Date().toISOString().split('T')[0];
    }
  }

  function applySharedStore() {
    var sharedStore = document.getElementById('shared-store').value;
    batchRows.forEach(function (row) {
      if (!row.store) {
        row.store = sharedStore;
      }
    });
    renderBatchRows();
  }

  function applySharedDate() {
    var sharedDate = document.getElementById('shared-date').value;
    batchRows.forEach(function (row) {
      if (!row.date) {
        row.date = sharedDate;
      }
    });
    renderBatchRows();
  }

  function renderBatchRows() {
    var tbody = document.getElementById('batch-purchase-tbody');
    if (!tbody) return;

    if (batchRows.length === 0) {
      batchRows.push({ colorCode: '', quantity: '', store: '', date: '', note: '' });
    }

    tbody.innerHTML = batchRows.map(function (row, index) {
      var colorOptions = buildColorOptions(row.colorCode);
      var storeValue = row.store || document.getElementById('shared-store').value;
      var storeOptions = buildStoreOptions(storeValue);
      var dateValue = row.date || document.getElementById('shared-date').value;
      var hasColor = !!row.colorCode;
      var rowClass = hasColor ? '' : 'batch-row--empty';
      var duplicateWarning = hasColor ? getDuplicateWarning(row.colorCode, index) : '';

      return '<tr class="batch-row ' + rowClass + '" data-index="' + index + '">' +
        '<td class="batch-row__index">' + (index + 1) + '</td>' +
        '<td>' +
          '<select class="form-select batch-row__color" data-index="' + index + '" data-field="colorCode">' +
            '<option value="">选择色号...</option>' +
            colorOptions +
          '</select>' +
          duplicateWarning +
        '</td>' +
        '<td>' +
          '<input type="number" class="form-input batch-row__quantity form-input--sm" ' +
            'data-index="' + index + '" data-field="quantity" ' +
            'value="' + (row.quantity !== undefined ? row.quantity : '') + '" ' +
            'min="1" placeholder="数量">' +
        '</td>' +
        '<td>' +
          '<select class="form-select batch-row__store" data-index="' + index + '" data-field="store">' +
            '<option value="">选择店家...</option>' +
            storeOptions +
          '</select>' +
        '</td>' +
        '<td>' +
          '<input type="date" class="form-input batch-row__date" ' +
            'data-index="' + index + '" data-field="date" ' +
            'value="' + dateValue + '">' +
        '</td>' +
        '<td>' +
          '<button class="btn btn--xs btn--danger batch-row__delete" data-index="' + index + '" ' +
            (batchRows.length <= 1 ? 'disabled' : '') + '>删除</button>' +
        '</td>' +
        '</tr>';
    }).join('');

    updateSubmitButton();
    bindRowEvents();
  }

  function buildColorOptions(selectedCode) {
    var codes = Object.keys(colorsData).sort();
    return codes.map(function (code) {
      var color = colorsData[code] || {};
      var hex = color.hex || '#cccccc';
      var name = color.name || '未命名';
      var selected = code === selectedCode ? ' selected' : '';
      return '<option value="' + escAttr(code) + '" data-hex="' + escAttr(hex) + '"' + selected + '>' +
        code + ' - ' + escHtml(name) + '</option>';
    }).join('');
  }

  function buildStoreOptions(selectedStore) {
    return storesData.map(function (s) {
      var selected = s === selectedStore ? ' selected' : '';
      return '<option value="' + escAttr(s) + '"' + selected + '>' + escHtml(s) + '</option>';
    }).join('');
  }

  function getDuplicateWarning(colorCode, currentIndex) {
    var seen = {};
    batchRows.forEach(function (row, i) {
      if (row.colorCode && i !== currentIndex) {
        if (seen[row.colorCode] !== undefined) {
          seen[colorCode] = seen[colorCode] || [seen[row.colorCode]];
          seen[colorCode].push(i);
        } else {
          seen[row.colorCode] = i;
        }
      }
    });
    if (seen[colorCode] !== undefined && typeof seen[colorCode] === 'number') {
      return '<div class="batch-row__warning">注意：色号 ' + escHtml(colorCode) + ' 已出现在第 ' + (seen[colorCode] + 1) + ' 行</div>';
    }
    return '';
  }

  function bindRowEvents() {
    var tbody = document.getElementById('batch-purchase-tbody');
    if (!tbody) return;

    tbody.querySelectorAll('.batch-row__color, .batch-row__quantity, .batch-row__store, .batch-row__date').forEach(function (input) {
      input.addEventListener('change', handleRowFieldChange);
      input.addEventListener('input', handleRowFieldChange);
    });

    tbody.querySelectorAll('.batch-row__delete').forEach(function (btn) {
      btn.addEventListener('click', handleRowDelete);
    });
  }

  function handleRowFieldChange(e) {
    var row = e.target.closest('.batch-row');
    var index = parseInt(row.dataset.index, 10);
    var field = e.target.dataset.field;
    var value = e.target.value;

    if (field === 'quantity') {
      value = value === '' ? '' : parseInt(value, 10);
    }

    if (index >= 0 && index < batchRows.length) {
      batchRows[index][field] = value;
    }

    if (field === 'colorCode') {
      updateRowWarning(index);
    }

    if (field === 'quantity') {
      updateSubmitButton();
    }
  }

  function updateRowWarning(index) {
    var row = document.querySelector('.batch-row[data-index="' + index + '"]');
    if (!row) return;
    var warningEl = row.querySelector('.batch-row__warning');
    var colorCode = batchRows[index] ? batchRows[index].colorCode : '';
    if (colorCode) {
      var warning = getDuplicateWarning(colorCode, index);
      if (warningEl) {
        warningEl.outerHTML = warning;
      } else {
        var colorCell = row.querySelector('.batch-row__color').parentNode;
        colorCell.insertAdjacentHTML('beforeend', warning);
      }
    } else if (warningEl) {
      warningEl.remove();
    }
  }

  function handleRowDelete(e) {
    var index = parseInt(e.target.dataset.index, 10);
    if (batchRows.length <= 1) return;
    batchRows.splice(index, 1);
    renderBatchRows();
  }

  function handleModalClick(e) {
    if (e.target.id === 'add-batch-row-btn') {
      addBatchRow();
    }
  }

  function addBatchRow() {
    if (batchRows.length >= MAX_ROWS) {
      PBM.showToast('最多添加 ' + MAX_ROWS + ' 条记录', 'warning');
      return;
    }
    var sharedStore = document.getElementById('shared-store').value;
    var sharedDate = document.getElementById('shared-date').value;
    batchRows.push({ colorCode: '', quantity: '', store: sharedStore, date: sharedDate, note: '' });
    renderBatchRows();
    scrollToBottom();
  }

  function scrollToBottom() {
    var tbody = document.getElementById('batch-purchase-tbody');
    if (tbody) {
      tbody.scrollTop = tbody.scrollHeight;
    }
  }

  function updateSubmitButton() {
    var btn = document.getElementById('submit-batch-purchase');
    if (!btn) return;
    var count = countValidRows();
    btn.textContent = count > 0 ? '确认添加 ' + count + ' 条' : '确认添加';
    btn.disabled = count === 0;
  }

  function countValidRows() {
    return batchRows.filter(function (row) {
      return row.colorCode && row.quantity > 0;
    }).length;
  }

  function submitBatchPurchase() {
    var validRows = batchRows.filter(function (row) {
      return row.colorCode && row.quantity > 0;
    });

    if (validRows.length === 0) {
      PBM.showToast('请至少填写一条完整的购买记录', 'error');
      return;
    }

    var sharedStore = document.getElementById('shared-store').value;
    var sharedDate = document.getElementById('shared-date').value;

    PBM.apiFetch('/api/transactions/batch', {
      method: 'POST',
      body: JSON.stringify({
        purchases: batchRows,
        sharedStore: sharedStore || undefined,
        sharedDate: sharedDate || undefined,
      }),
    }).then(function (result) {
      PBM.showToast('已添加 ' + result.created + ' 条购买记录（共 ' + result.totalQuantity + ' 件）', 'success');
      PBM.closeModal('batch-purchase-modal');
      if (typeof refreshInventory === 'function') refreshInventory();
      if (typeof refreshTransactions === 'function') refreshTransactions();
      if (typeof refreshStats === 'function') refreshStats();
    }).catch(function (err) {
      PBM.showToast(err.message, 'error');
    });
  }

  function escHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function escAttr(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/"/g, '&quot;');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();