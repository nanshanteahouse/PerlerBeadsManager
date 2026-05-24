(function () {
  'use strict';

  let cartData = { cart: [], demandSummary: [] };

  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

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
      const isMixedBeads = !item.patternId;
      const sufficient = isItemSufficient(item);
      const statusClass = sufficient ? 'text-success' : 'text-danger';
      const statusText = sufficient ? '✅ 充足' : '⚠️ 不足';
      const nameDisplay = isMixedBeads
        ? '♻️ ' + escapeHtml(item.patternName)
        : '📄 ' + escapeHtml(item.patternName);

      if (isMixedBeads) {
        return `
          <tr data-item-id="${item.id}">
            <td data-label="图纸名称">${nameDisplay}</td>
            <td data-label="混豆数量">
              <div class="form-inline items-center">
                <button class="btn btn--xs btn--secondary qty-dec" data-id="${item.id}">-</button>
                <span class="font-mono" style="min-width:32px;text-align:center">${item.quantity}</span>
                <button class="btn btn--xs btn--secondary qty-inc" data-id="${item.id}">+</button>
              </div>
            </td>
            <td data-label="涉及色号">-</td>
            <td data-label="状态"><span class="${statusClass}">${statusText}</span></td>
            <td data-label="操作">
              <button class="btn btn--xs btn--ghost remove-item" data-id="${item.id}">移除</button>
            </td>
          </tr>
        `;
      }

      return `
        <tr data-item-id="${item.id}">
          <td data-label="图纸名称">${nameDisplay}</td>
          <td data-label="图案件数">
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
    }).join('');

    renderDemandSummary(summaryItems);
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
      const statusClass = entry.sufficient ? 'cart-summary__status--ok' : 'cart-summary__status--fail';
      const statusText = entry.sufficient
        ? '✅ 充足'
        : `❌ 缺 ${entry.shortfall}`;

      return `
        <div class="cart-summary__item">
          <span class="flex items-center gap-8">
            <span class="color-swatch color-swatch--sm" style="background:${entry.hex};color:${PBM.getTextColor(entry.hex)}">${entry.colorCode}</span>
            <span>${escapeHtml(entry.name || entry.colorCode)}: 需 <strong>${entry.demand.toLocaleString()}</strong> 粒, 存 <strong>${entry.stock.toLocaleString()}</strong> 粒 →</span>
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

    // Mixed beads modal
    document.getElementById('add-mixed-beads-btn').addEventListener('click', function () {
      PBM.openModal('mixed-beads-modal');
    });

    document.getElementById('submit-mixed-beads').addEventListener('click', function () {
      var qty = parseInt(document.getElementById('mixed-beads-quantity').value, 10);
      if (!qty || qty <= 0) {
        PBM.showToast('请输入有效数量', 'error');
        return;
      }

      PBM.apiFetch('/api/cart/mixed-beads', {
        method: 'POST',
        body: JSON.stringify({ quantity: qty }),
      })
        .then(function (result) {
          PBM.closeModal('mixed-beads-modal');
          document.getElementById('mixed-beads-quantity').value = '';
          PBM.showToast('混豆已添加到购物车', 'success');
          // Refresh cart list
          fetchCart();
        })
        .catch(function (err) {
          PBM.showToast(err.message, 'error');
        });
    });
  });
})();