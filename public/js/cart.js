(function () {
  'use strict';

  let cartData = { cart: [], demandSummary: [] };

  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
  var escHtml = escapeHtml;

  function renderCart() {
    const tbody = document.getElementById('cart-tbody');
    const cartContent = document.getElementById('cart-content');
    const emptyState = document.getElementById('empty-state');
    const summaryItems = document.getElementById('summary-items');

    if (!cartData.cart || cartData.cart.length === 0) {
      cartContent.style.display = 'none';
      emptyState.style.display = 'block';
      PBM.updateCartBadge(0);
      return;
    }

    cartContent.style.display = 'block';
    emptyState.style.display = 'none';
    PBM.updateCartBadge(cartData.cart.length);

    tbody.innerHTML = cartData.cart.map(item => {
      if (item.type === 'manual-adjustment') {
        return renderAdjustmentRow(item);
      }
      return renderPatternRow(item);
    }).join('');

    renderDemandSummary(summaryItems);
  }

  function renderPatternRow(item) {
    const isLegacyMixed = !item.patternId;
    const sufficient = isItemSufficient(item);
    const statusClass = sufficient ? 'text-success' : 'text-danger';
    const statusText = sufficient ? '✅ 充足' : '⚠️ 不足';
    const nameDisplay = isLegacyMixed
      ? '♻️ ' + escapeHtml(item.patternName || '混豆')
      : '📄 ' + escapeHtml(item.patternName);
    const qtyColLabel = isLegacyMixed ? '混豆数量' : '图案件数';

    return `
      <tr data-item-id="${item.id}">
        <td data-label="图纸名称">${nameDisplay}</td>
        <td data-label="${qtyColLabel}">
          <div class="form-inline items-center">
            <button class="btn btn--xs btn--secondary qty-dec" data-id="${item.id}">-</button>
            <span class="font-mono" style="min-width:32px;text-align:center">${item.quantity}</span>
            <button class="btn btn--xs btn--secondary qty-inc" data-id="${item.id}">+</button>
          </div>
        </td>
        <td data-label="涉及色号">${item.colorCount || 0} 种</td>
        <td data-label="状态"><span class="${statusClass}">${statusText}</span></td>
        <td data-label="操作">
          <button class="btn btn--xs btn--ghost remove-item" data-id="${item.id}">移除</button>
        </td>
      </tr>
    `;
  }

  function renderAdjustmentRow(item) {
    const beadCount = item.beads ? item.beads.length : 0;
    const totalQty = item.beads
      ? item.beads.reduce(function (sum, b) { return sum + b.quantity; }, 0)
      : 0;
    const totalSign = totalQty >= 0 ? '+' : '';
    const noteText = item.note ? ' — ' + escapeHtml(item.note) : '';

    var beadsHtml = '';
    if (item.beads && item.beads.length > 0) {
      beadsHtml = item.beads.map(function (b) {
        var hex = '#888888';
        var name = b.colorCode;
        var sign = b.quantity >= 0 ? '+' : '';
        var qtyClass = b.quantity >= 0 ? 'text-success' : 'text-danger';

        var colorInfo = getColorInfo(b.colorCode);
        if (colorInfo) {
          hex = colorInfo.hex || hex;
          name = colorInfo.name || b.colorCode;
        }
        if (b.colorCode === 'MIX') {
          name = '混豆';
          hex = '#a0a0a0';
        }

        return '<div class="adjustment-bead-row">' +
          '<span class="color-swatch color-swatch--sm" style="background:' + hex + ';color:' + PBM.getTextColor(hex) + '">' + b.colorCode + '</span>' +
          '<span class="text-sm">' + name + '</span>' +
          '<span class="font-mono ' + qtyClass + '">' + sign + b.quantity.toLocaleString() + '</span>' +
        '</div>';
      }).join('');
    }

    return `
      <tr data-item-id="${item.id}" class="cart-adjustment-row">
        <td data-label="名称" colspan="5">
          <div class="adjustment-summary">
            <span class="adjustment-summary__toggle" data-id="${item.id}">▶</span>
            <span>📝 ${escapeHtml(item.patternName)} — ${beadCount} 项调整 | 净变化 ${totalSign}${totalQty.toLocaleString()}${noteText}</span>
          </div>
          <div class="adjustment-details" id="adj-detail-${item.id}" style="display:none">
            ${beadsHtml}
          </div>
        </td>
        <td data-label="操作">
          <button class="btn btn--xs btn--ghost remove-item" data-id="${item.id}">移除</button>
        </td>
      </tr>
    `;
  }

  function isItemSufficient(item) {
    if (!item.beads) return true;
    return item.beads.every(bead => {
      const demandEntry = cartData.demandSummary.find(d => d.colorCode === bead.colorCode);
      if (!demandEntry) return true;
      const totalDemand = bead.quantity * item.quantity;
      return demandEntry.stock >= totalDemand;
    });
  }

  function renderDemandSummary(container) {
    if (!cartData.demandSummary || cartData.demandSummary.length === 0) {
      container.innerHTML = '<p class="text-secondary text-sm">暂无需求汇总</p>';
      return;
    }

    container.innerHTML = cartData.demandSummary.map(entry => {
      const hasNegative = entry.demand < 0;
      const surplus = hasNegative ? -entry.demand : 0;
      const effective = hasNegative ? 0 : entry.demand;

      if (hasNegative) {
        return `
          <div class="cart-summary__item cart-summary__item--surplus">
            <span class="flex items-center gap-8">
              <span class="color-swatch color-swatch--sm" style="background:${entry.hex};color:${PBM.getTextColor(entry.hex)}">${entry.colorCode}</span>
              <span>${escapeHtml(entry.name || entry.colorCode)}: 净冲抵 <strong>${surplus.toLocaleString()}</strong> 粒, 库存 <strong>${entry.stock.toLocaleString()}</strong> →</span>
            </span>
            <span class="cart-summary__status--surplus">🔵 冲抵</span>
          </div>
        `;
      }

      const statusClass = entry.sufficient ? 'cart-summary__status--ok' : 'cart-summary__status--fail';
      const statusText = entry.sufficient
        ? '✅ 充足'
        : `❌ 缺 ${entry.shortfall}`;

      return `
        <div class="cart-summary__item">
          <span class="flex items-center gap-8">
            <span class="color-swatch color-swatch--sm" style="background:${entry.hex};color:${PBM.getTextColor(entry.hex)}">${entry.colorCode}</span>
            <span>${escapeHtml(entry.name || entry.colorCode)}: 需 <strong>${effective.toLocaleString()}</strong> 粒, 存 <strong>${entry.stock.toLocaleString()}</strong> 粒 →</span>
          </span>
          <span class="${statusClass}">${statusText}</span>
        </div>
      `;
    }).join('');
  }

  function showSubmitConfirmation(insufficient) {
    const modalBody = document.getElementById('submit-modal-body');

    if (insufficient && insufficient.length > 0) {
      const list = insufficient.map(e =>
        `<div class="flex items-center gap-8" style="padding:4px 0">
          <span class="color-swatch color-swatch--sm" style="background:${e.hex};color:${PBM.getTextColor(e.hex)}">${e.colorCode}</span>
          <span>${escapeHtml(e.name || e.colorCode)}: 需求 ${e.demand}, 库存 ${e.stock}, 缺 ${e.shortfall}</span>
        </div>`
      ).join('');

      modalBody.innerHTML = `
        <div class="alert alert--warning">库存不足，以下色号将变为负库存：</div>
        ${list}
        <p class="text-sm text-secondary" style="margin-top:12px">确认是否仍要提交？</p>
      `;
    } else {
      modalBody.innerHTML = `
        <p>确认提交购物车？库存将按需求扣减。</p>
      `;
    }

    PBM.openModal('submit-confirm-modal');
  }

  async function fetchCart() {
    try {
      cartData = await PBM.apiFetch('/api/cart');
      if (colorsList.length === 0) {
        colorsList = await PBM.apiFetch('/api/colors');
      }
      renderCart();
    } catch (err) {
      PBM.showToast(err.message, 'error');
    }
  }

  async function updateQuantity(id, newQty) {
    if (newQty < 1) return;
    try {
      await PBM.apiFetch(`/api/cart/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ quantity: newQty })
      });
      await fetchCart();
    } catch (err) {
      PBM.showToast(err.message, 'error');
    }
  }

  async function removeItem(id) {
    if (!confirm('确认移除此项？')) return;
    try {
      await PBM.apiFetch(`/api/cart/${id}`, { method: 'DELETE' });
      PBM.showToast('已移除', 'success');
      await fetchCart();
    } catch (err) {
      PBM.showToast(err.message, 'error');
    }
  }

  async function submitCart() {
    try {
      const result = await PBM.apiFetch('/api/cart/submit', { method: 'POST' });
      PBM.closeModal('submit-confirm-modal');
      PBM.showToast('购物车已提交', 'success');
      setTimeout(() => { window.location.href = '/inventory'; }, 500);
    } catch (err) {
      PBM.showToast(err.message, 'error');
    }
  }

  async function clearCart() {
    if (!confirm('确认清空购物车？')) return;
    try {
      await PBM.apiFetch('/api/cart', { method: 'DELETE' });
      PBM.showToast('购物车已清空', 'success');
      await fetchCart();
    } catch (err) {
      PBM.showToast(err.message, 'error');
    }
  }

  var adjustmentRows = [];
  var colorsList = [];

  function getColorInfo(code) {
    for (var i = 0; i < colorsList.length; i++) {
      if (colorsList[i].code === code) return colorsList[i];
    }
    return null;
  }

  async function openAdjustmentModal() {
    try {
      colorsList = await PBM.apiFetch('/api/colors');
      adjustmentRows = [{ colorCode: '', quantity: '' }];
      renderAdjustmentRows();
      PBM.openModal('adjustment-modal');
    } catch (err) {
      PBM.showToast('加载色号失败: ' + err.message, 'error');
    }
  }

  function addAdjustmentRow() {
    if (adjustmentRows.length >= 50) {
      PBM.showToast('最多添加 50 项调整', 'warning');
      return;
    }
    adjustmentRows.push({ colorCode: '', quantity: '' });
    renderAdjustmentRows();
  }

  function buildColorOptions(selectedCode) {
    var codes = colorsList.slice().sort(function (a, b) {
      return a.code < b.code ? -1 : a.code > b.code ? 1 : 0;
    });
    var options = codes.map(function (c) {
      var selected = c.code === selectedCode ? ' selected' : '';
      return '<option value="' + escAttr(c.code) + '" data-hex="' + (c.hex || '#cccccc') + '"' + selected + '>' +
        c.code + ' - ' + escHtml(c.name || '未命名') + '</option>';
    }).join('');
    var mixSelected = selectedCode === 'MIX' ? ' selected' : '';
    return '<option value="">选择色号...</option>' +
      '<option value="MIX" data-hex="#a0a0a0"' + mixSelected + '>★ MIX - 混豆</option>' +
      options;
  }

  function renderAdjustmentRows() {
    var tbody = document.getElementById('adjustment-tbody');
    if (!tbody) return;

    if (adjustmentRows.length === 0) {
      adjustmentRows.push({ colorCode: '', quantity: '' });
    }

    tbody.innerHTML = adjustmentRows.map(function (row, index) {
      return '<tr class="adjustment-form-row" data-index="' + index + '">' +
        '<td>' +
          '<select class="form-select adjustment-row__color" data-index="' + index + '" data-field="colorCode">' +
            buildColorOptions(row.colorCode) +
          '</select>' +
        '</td>' +
        '<td>' +
          '<input type="number" class="form-input adjustment-row__quantity" ' +
            'data-index="' + index + '" data-field="quantity" ' +
            'value="' + (row.quantity !== undefined && row.quantity !== '' ? row.quantity : '') + '" ' +
            'placeholder="±数量" step="1">' +
        '</td>' +
        '<td>' +
          '<button class="btn btn--xs btn--ghost adjustment-row__delete" data-index="' + index + '" ' +
            (adjustmentRows.length <= 1 ? 'disabled' : '') + '>✕</button>' +
        '</td>' +
      '</tr>';
    }).join('');

    bindAdjustmentRowEvents();
  }

  function bindAdjustmentRowEvents() {
    var tbody = document.getElementById('adjustment-tbody');
    if (!tbody) return;

    tbody.querySelectorAll('.adjustment-row__color, .adjustment-row__quantity').forEach(function (input) {
      input.addEventListener('change', handleAdjustmentFieldChange);
    });

    tbody.querySelectorAll('.adjustment-row__delete').forEach(function (btn) {
      btn.addEventListener('click', handleAdjustmentRowDelete);
    });
  }

  function handleAdjustmentFieldChange(e) {
    var index = parseInt(e.target.dataset.index, 10);
    var field = e.target.dataset.field;
    var value = e.target.value;

    if (field === 'quantity') {
      value = value === '' ? '' : parseInt(value, 10);
    }

    if (index >= 0 && index < adjustmentRows.length) {
      adjustmentRows[index][field] = value;
    }
  }

  function handleAdjustmentRowDelete(e) {
    var index = parseInt(e.target.dataset.index, 10);
    if (adjustmentRows.length <= 1) return;
    adjustmentRows.splice(index, 1);
    renderAdjustmentRows();
  }

  async function submitAdjustment() {
    var beads = adjustmentRows.filter(function (row) {
      return row.colorCode && row.quantity !== '' && row.quantity !== 0;
    }).map(function (row) {
      return { colorCode: row.colorCode, quantity: row.quantity };
    });

    if (beads.length === 0) {
      PBM.showToast('请至少填写一个有效的色号和数量', 'error');
      return;
    }

    var note = document.getElementById('adjustment-note').value.trim();

    try {
      await PBM.apiFetch('/api/cart/manual-adjustment', {
        method: 'POST',
        body: JSON.stringify({ beads: beads, note: note }),
      });
      PBM.closeModal('adjustment-modal');
      document.getElementById('adjustment-note').value = '';
      PBM.showToast('用量调整已添加到购物车', 'success');
      await fetchCart();
    } catch (err) {
      PBM.showToast(err.message, 'error');
    }
  }

  function escAttr(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/"/g, '&quot;');
  }

  document.addEventListener('DOMContentLoaded', function () {
    fetchCart();

    document.getElementById('cart-tbody').addEventListener('click', function (e) {
      const target = e.target;
      const id = target.dataset.id;

      if (target.classList.contains('qty-dec')) {
        const item = cartData.cart.find(i => i.id === id);
        if (item) updateQuantity(id, item.quantity - 1);
      } else if (target.classList.contains('qty-inc')) {
        const item = cartData.cart.find(i => i.id === id);
        if (item) updateQuantity(id, item.quantity + 1);
      } else if (target.classList.contains('remove-item')) {
        removeItem(id);
      }
    });

    document.getElementById('submit-cart-btn').addEventListener('click', function () {
      if (cartData.demandSummary && cartData.demandSummary.some(d => !d.sufficient)) {
        showSubmitConfirmation(cartData.demandSummary.filter(d => !d.sufficient));
      } else {
        showSubmitConfirmation([]);
      }
    });

    document.getElementById('confirm-submit-btn').addEventListener('click', submitCart);

    document.getElementById('clear-cart-btn').addEventListener('click', clearCart);

    document.querySelectorAll('[data-close-modal]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        PBM.closeAllModals();
      });
    });

    // Toggle adjustment detail expand/collapse
    document.getElementById('cart-tbody').addEventListener('click', function (e) {
      const toggle = e.target.closest('.adjustment-summary__toggle');
      if (toggle) {
        const id = toggle.dataset.id;
        const detail = document.getElementById('adj-detail-' + id);
        if (detail) {
          const isOpen = detail.style.display !== 'none';
          detail.style.display = isOpen ? 'none' : 'block';
          toggle.textContent = isOpen ? '▶' : '▼';
        }
        return;
      }
    });

    // Adjustment modal
    document.getElementById('add-adjustment-btn').addEventListener('click', openAdjustmentModal);

    document.getElementById('submit-adjustment').addEventListener('click', submitAdjustment);

    document.getElementById('adjustment-modal').addEventListener('click', function (e) {
      if (e.target.id === 'add-adjustment-row-btn') {
        addAdjustmentRow();
      }
    });
  });
})();