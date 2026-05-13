(function () {
  'use strict';

  var listView = document.getElementById('pattern-list');
  var editorView = document.getElementById('pattern-form');

  function getTextColor(hex) {
    var clean = hex.replace('#', '');
    var vals = clean.match(/\w\w/g);
    if (!vals || vals.length < 3) return '#000';
    var rgb = vals.map(function (x) {
      var c = parseInt(x, 16) / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    var lum = 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
    return lum > 0.179 ? '#000000' : '#ffffff';
  }

  function showToast(message, type) {
    if (window.PBM && window.PBM.showToast) {
      window.PBM.showToast(message, type);
      return;
    }
    var container = document.querySelector('.toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
    var toast = document.createElement('div');
    toast.className = 'toast toast--' + (type || 'success');
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(function () {
      toast.style.opacity = '0';
      setTimeout(function () { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 300);
    }, 2500);
  }

  function openModal(id) {
    var el = document.getElementById(id);
    if (el) {
      el.classList.add('modal-overlay--active');
      document.body.classList.add('modal-open');
    }
  }

  function closeModal(id) {
    var el = document.getElementById(id);
    if (el) {
      el.classList.remove('modal-overlay--active');
      document.body.classList.remove('modal-open');
    }
  }

  function closeAllModals() {
    document.querySelectorAll('.modal-overlay--active').forEach(function (el) {
      el.classList.remove('modal-overlay--active');
    });
    document.body.classList.remove('modal-open');
  }

  document.addEventListener('click', function (e) {
    var closeBtn = e.target.closest('[data-close-modal]');
    if (closeBtn) {
      closeModal(closeBtn.getAttribute('data-close-modal'));
    }
    if (e.target.classList.contains('modal-overlay--active')) {
      closeAllModals();
    }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeAllModals();
  });

  function apiFetch(url, options) {
    options = options || {};
    var headers = options.headers || {};
    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }
    return fetch(url, Object.assign({}, options, { headers: headers }))
      .then(function (res) {
        if (!res.ok) {
          var ct = res.headers.get('Content-Type') || '';
          if (ct.includes('application/json')) {
            return res.json().then(function (err) { throw new Error(err.message || '请求失败'); });
          }
          return res.text().then(function () { throw new Error('请求失败 (HTTP ' + res.status + ')'); });
        }
        return res.json();
      });
  }

  function getStockCheckHTML(items) {
    var insufficient = items.filter(function (i) { return i.shortfall > 0; });
    if (insufficient.length === 0) {
      return '<span class="text-success">✅ 库存充足</span>';
    }
    var details = insufficient.slice(0, 3).map(function (i) {
      return i.colorCode + '(-' + i.shortfall + ')';
    }).join(', ');
    if (insufficient.length > 3) details += ' 等' + insufficient.length + '种';
    return '<span class="text-danger">⚠️ 库存不足：' + details + '</span>';
  }

  function renderPatternCard(pattern, colors, inventory) {
    var colorCount = pattern.beads ? pattern.beads.length : 0;
    var totalBeads = pattern.totalBeads || 0;
    var dateStr = pattern.createdAt ? new Date(pattern.createdAt).toLocaleDateString('zh-CN') : '';
    var stockStatusHTML = '';

    var card = document.createElement('div');
    card.className = 'pattern-card';
    card.dataset.patternId = pattern.id;

    stockStatusHTML = '<div class="pattern-card__meta" id="stock-status-' + pattern.id + '"><span class="spinner"></span> 检查库存...</div>';

    card.innerHTML =
      '<div class="pattern-card__header">' +
        '<span class="pattern-card__name">📄 ' + pattern.name + '</span>' +
        '<span class="text-sm text-secondary">' + colorCount + ' 种色号 · ' + totalBeads.toLocaleString() + ' 粒</span>' +
      '</div>' +
      '<div class="pattern-card__meta">创建于 ' + dateStr + '</div>' +
      stockStatusHTML +
      '<div class="pattern-card__actions">' +
        '<button class="btn btn--sm btn--secondary view-btn">查看</button>' +
        '<a href="/patterns/' + pattern.id + '/edit" class="btn btn--sm btn--secondary">编辑</a>' +
        '<button class="btn btn--sm btn--secondary add-cart-btn">加入购物车</button>' +
        '<button class="btn btn--sm btn--ghost export-btn">导出JSON</button>' +
        '<button class="btn btn--sm btn--danger delete-btn">删除</button>' +
      '</div>' +
      '<div class="pattern-detail" style="display:none; margin-top: 12px; padding: 12px; background: var(--bg-tertiary); border-radius: var(--radius-sm);"></div>';

    fetch('/api/patterns/' + pattern.id + '/check')
      .then(function (res) { return res.json(); })
      .then(function (result) {
        var statusEl = document.getElementById('stock-status-' + pattern.id);
        if (statusEl) statusEl.innerHTML = getStockCheckHTML(result.items);
      })
      .catch(function () {
        var statusEl = document.getElementById('stock-status-' + pattern.id);
        if (statusEl) statusEl.innerHTML = '<span class="text-secondary">库存检查失败</span>';
      });

    return card;
  }

  function renderBeadRow(bead, index, colorData, stock) {
    var tr = document.createElement('tr');
    tr.dataset.colorCode = bead.colorCode;

    var colorHex = '#cccccc';
    var colorName = bead.colorCode;
    if (colorData && colorData.hex) colorHex = colorData.hex;
    if (colorData && colorData.name) colorName = colorData.name;

    var textColor = getTextColor(colorHex);
    var stockClass = '';
    if (stock !== undefined) {
      if (stock === 0) stockClass = 'stock-value--out';
      else if (stock < 50) stockClass = 'stock-value--low';
    }

    tr.innerHTML =
      '<td>' + (index + 1) + '</td>' +
      '<td><span class="color-swatch" style="background:' + colorHex + '; color:' + textColor + ';">' + bead.colorCode + '</span></td>' +
      '<td>' + (colorName || '—') + '</td>' +
      '<td><input type="number" class="form-input form-input--sm bead-qty-input" value="' + bead.quantity + '" min="1" max="99999" style="width: 80px;"></td>' +
      '<td class="' + stockClass + '">' + (stock !== undefined ? stock : '—') + '</td>' +
      '<td><button type="button" class="btn btn--xs btn--danger remove-bead-btn">×</button></td>';

    return tr;
  }

  function initListView() {
    if (!listView) return;

    var importBtn = document.getElementById('import-btn');
    var importForm = document.getElementById('import-form');
    var importFileForm = document.getElementById('import-file-form');
    var importCancelBtn = document.getElementById('import-cancel-btn');
    var cartModal = document.getElementById('add-to-cart-modal');
    var confirmCartBtn = document.getElementById('confirm-add-to-cart');

    var selectedPatternId = null;

    importBtn.addEventListener('click', function () {
      importForm.style.display = importForm.style.display === 'none' ? 'block' : 'none';
    });

    importCancelBtn.addEventListener('click', function () {
      importForm.style.display = 'none';
    });

    importFileForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var fileInput = document.getElementById('import-file-input');
      if (!fileInput.files[0]) {
        showToast('请选择文件', 'error');
        return;
      }
      var reader = new FileReader();
      reader.onload = function (event) {
        try {
          var jsonData = JSON.parse(event.target.result);
          fetch('/api/patterns/import', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(jsonData)
          })
            .then(function (res) {
              if (!res.ok) return res.json().then(function (d) { throw new Error(d.message); });
              return res.json();
            })
            .then(function () {
              showToast('导入成功');
              importForm.style.display = 'none';
              fileInput.value = '';
              loadPatterns();
            })
            .catch(function (err) {
              showToast(err.message, 'error');
            });
        } catch (err) {
          showToast('无效的JSON文件', 'error');
        }
      };
      reader.readAsText(fileInput.files[0]);
    });

    confirmCartBtn.addEventListener('click', function () {
      if (!selectedPatternId) return;
      var qty = parseInt(document.getElementById('cart-quantity').value, 10) || 1;
      fetch('/api/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patternId: selectedPatternId, quantity: qty })
      })
        .then(function (res) {
          if (!res.ok) return res.json().then(function (d) { throw new Error(d.message); });
          return res.json();
        })
        .then(function () {
          showToast('已加入购物车');
          closeModal('add-to-cart-modal');
          if (window.PBM && window.PBM.updateCartBadge) {
            fetch('/api/cart').then(function (r) { return r.json(); }).then(function (cartData) {
              window.PBM.updateCartBadge(cartData.cart.length);
            });
          }
        })
        .catch(function (err) {
          showToast(err.message, 'error');
        });
    });

    function loadPatterns() {
      fetch('/api/patterns')
        .then(function (res) { return res.json(); })
        .then(function (patterns) {
          if (patterns.length === 0) {
            listView.innerHTML =
              '<div class="empty-state">' +
                '<div class="empty-state__icon">📋</div>' +
                '<div class="empty-state__text">暂无图纸</div>' +
                '<a href="/patterns/new" class="btn btn--primary">创建第一个图纸</a>' +
              '</div>';
            return;
          }
          listView.innerHTML = '';
          patterns.forEach(function (pattern) {
            var card = renderPatternCard(pattern);
            listView.appendChild(card);
          });
        })
        .catch(function (err) {
          listView.innerHTML = '<div class="alert alert--danger">加载失败：' + err.message + '</div>';
        });
    }

    listView.addEventListener('click', function (e) {
      var card = e.target.closest('.pattern-card');
      if (!card) return;
      var patternId = card.dataset.patternId;

      if (e.target.classList.contains('view-btn')) {
        var detail = card.querySelector('.pattern-detail');
        if (detail.style.display === 'none') {
          fetch('/api/patterns/' + patternId)
            .then(function (res) { return res.json(); })
            .then(function (pattern) {
              var beadsHTML = '';
              if (pattern.beads && pattern.beads.length > 0) {
                beadsHTML = '<table style="width:100%; font-size: 0.85rem;"><thead><tr><th>色号</th><th>用量</th></tr></thead><tbody>';
                pattern.beads.forEach(function (b) {
                  beadsHTML += '<tr><td>' + b.colorCode + '</td><td>' + b.quantity + '</td></tr>';
                });
                beadsHTML += '</tbody></table>';
              }
              detail.innerHTML =
                '<div class="text-sm"><strong>描述：</strong>' + (pattern.description || '无') + '</div>' +
                '<div class="text-sm" style="margin-top: 8px;"><strong>底板：</strong>' +
                  (pattern.boardSize ? pattern.boardSize.width + ' × ' + pattern.boardSize.height : '未设置') + '</div>' +
                '<div style="margin-top: 8px;">' + beadsHTML + '</div>';
              detail.style.display = 'block';
              e.target.textContent = '收起';
            });
        } else {
          detail.style.display = 'none';
          e.target.textContent = '查看';
        }
      }

      if (e.target.classList.contains('add-cart-btn')) {
        selectedPatternId = patternId;
        fetch('/api/patterns/' + patternId)
          .then(function (res) { return res.json(); })
          .then(function (pattern) {
            document.getElementById('cart-modal-pattern-name').textContent = pattern.name;
            document.getElementById('cart-quantity').value = '1';
            openModal('add-to-cart-modal');
          });
      }

      if (e.target.classList.contains('export-btn')) {
        window.location.href = '/api/patterns/' + patternId + '/export';
      }

      if (e.target.classList.contains('delete-btn')) {
        if (!confirm('确定要删除这个图纸吗？此操作不可撤销。')) return;
        fetch('/api/patterns/' + patternId, { method: 'DELETE' })
          .then(function (res) {
            if (!res.ok) return res.json().then(function (d) { throw new Error(d.message); });
            return res.json();
          })
          .then(function () {
            showToast('已删除');
            card.remove();
            if (listView.querySelectorAll('.pattern-card').length === 0) {
              listView.innerHTML =
                '<div class="empty-state">' +
                  '<div class="empty-state__icon">📋</div>' +
                  '<div class="empty-state__text">暂无图纸</div>' +
                  '<a href="/patterns/new" class="btn btn--primary">创建第一个图纸</a>' +
                '</div>';
            }
          })
          .catch(function (err) {
            showToast(err.message, 'error');
          });
      }
    });

    loadPatterns();
  }

  function initEditorView() {
    if (!editorView) return;

    var pattern = window.__PATTERN_DATA__;
    var beadsTbody = document.getElementById('beads-tbody');
    var beadsSummaryText = document.getElementById('beads-summary-text');
    var colorPickerModal = document.getElementById('color-picker-modal');
    var colorPickerGrid = document.getElementById('color-picker-grid');
    var colorSeriesTags = document.getElementById('color-series-tags');
    var colorSearchInput = document.getElementById('color-search-input');
    var quantityInputSection = document.getElementById('quantity-input-section');
    var selectedColorQuantity = document.getElementById('selected-color-quantity');
    var confirmColorBtn = document.getElementById('confirm-color-btn');
    var addColorBtn = document.getElementById('add-color-btn');
    var saveBtn = document.getElementById('save-btn');
    var saveCheckBtn = document.getElementById('save-check-btn');

    var currentSeries = '';
    var selectedColorCode = null;
    var beads = [];

    if (pattern && pattern.beads) {
      beads = pattern.beads.map(function (b) {
        return { colorCode: b.colorCode, quantity: b.quantity };
      });
    }

    function updateSummary() {
      var colorTypes = beads.length;
      var totalQty = beads.reduce(function (sum, b) { return sum + (parseInt(b.quantity, 10) || 0); }, 0);
      beadsSummaryText.innerHTML = '总计色号：<strong>' + colorTypes + '</strong> 种 | 总计颗粒：<strong>' + totalQty.toLocaleString() + '</strong> 粒';
    }

    function renderBeadsTable() {
      beadsTbody.innerHTML = '';
      beads.forEach(function (bead, index) {
        var colorData = null;
        if (window.__COLORS_DATA__ && window.__COLORS_DATA__.length > 0) {
          colorData = window.__COLORS_DATA__.find(function (c) { return c.code === bead.colorCode; });
        }
        var stock = window.__INVENTORY_DATA__ ? (window.__INVENTORY_DATA__[bead.colorCode] || 0) : null;
        var row = renderBeadRow(bead, index, colorData, stock);
        beadsTbody.appendChild(row);
      });
      updateSummary();
    }

    function loadColorsForPicker() {
      fetch('/api/colors')
        .then(function (res) { return res.json(); })
        .then(function (colors) {
          window.__COLORS_DATA__ = colors;
          renderColorPickerGrid();
        })
        .catch(function () {
          window.__COLORS_DATA__ = [];
        });
      fetch('/api/inventory')
        .then(function (res) { return res.json(); })
        .then(function (inv) {
          window.__INVENTORY_DATA__ = inv;
          renderBeadsTable();
        })
        .catch(function () {
          window.__INVENTORY_DATA__ = {};
        });
    }

    function renderColorPickerGrid() {
      var searchTerm = (colorSearchInput.value || '').toLowerCase();
      var filtered = window.__COLORS_DATA__.filter(function (c) {
        if (currentSeries && c.series !== currentSeries) return false;
        if (searchTerm) {
          return c.code.toLowerCase().indexOf(searchTerm) !== -1 ||
                 (c.name && c.name.toLowerCase().indexOf(searchTerm) !== -1);
        }
        return true;
      });

      colorPickerGrid.innerHTML = '';
      filtered.forEach(function (color) {
        var textColor = getTextColor(color.hex);
        var item = document.createElement('div');
        item.className = 'color-grid__item' + (selectedColorCode === color.code ? ' color-grid__item--selected' : '');
        item.style.background = color.hex;
        item.style.color = textColor;
        item.textContent = color.code;
        item.dataset.colorCode = color.code;
        item.dataset.colorHex = color.hex;
        item.dataset.colorName = color.name || '';

        item.addEventListener('click', function () {
          document.querySelectorAll('#color-picker-grid .color-grid__item').forEach(function (el) {
            el.classList.remove('color-grid__item--selected');
          });
          item.classList.add('color-grid__item--selected');
          selectedColorCode = color.code;
          quantityInputSection.style.display = 'block';
          selectedColorQuantity.value = '1';
          confirmColorBtn.disabled = false;
          setTimeout(function () { selectedColorQuantity.focus(); }, 50);
        });

        colorPickerGrid.appendChild(item);
      });
    }

    colorSeriesTags.addEventListener('click', function (e) {
      var tag = e.target.closest('.filter-bar__tag');
      if (!tag) return;
      currentSeries = tag.dataset.series || '';
      document.querySelectorAll('#color-series-tags .filter-bar__tag').forEach(function (t) {
        t.classList.toggle('filter-bar__tag--active', t === tag);
      });
      renderColorPickerGrid();
    });

    colorSearchInput.addEventListener('input', function () {
      renderColorPickerGrid();
    });

    addColorBtn.addEventListener('click', function () {
      selectedColorCode = null;
      confirmColorBtn.disabled = true;
      quantityInputSection.style.display = 'none';
      renderColorPickerGrid();
      openModal('color-picker-modal');
    });

    confirmColorBtn.addEventListener('click', function () {
      if (!selectedColorCode) return;
      var qty = parseInt(selectedColorQuantity.value, 10) || 1;
      if (beads.some(function (b) { return b.colorCode === selectedColorCode; })) {
        showToast('该色号已添加', 'warning');
        return;
      }
      beads.push({ colorCode: selectedColorCode, quantity: qty });
      renderBeadsTable();
      closeModal('color-picker-modal');
      selectedColorCode = null;
      quantityInputSection.style.display = 'none';
      confirmColorBtn.disabled = true;
    });

    beadsTbody.addEventListener('click', function (e) {
      if (e.target.classList.contains('remove-bead-btn')) {
        var tr = e.target.closest('tr');
        if (!tr) return;
        var code = tr.dataset.colorCode;
        beads = beads.filter(function (b) { return b.colorCode !== code; });
        tr.remove();
        var rows = beadsTbody.querySelectorAll('tr');
        rows.forEach(function (row, i) {
          row.cells[0].textContent = i + 1;
        });
        updateSummary();
      }
    });

    beadsTbody.addEventListener('input', function (e) {
      if (e.target.classList.contains('bead-qty-input')) {
        var tr = e.target.closest('tr');
        if (!tr) return;
        var code = tr.dataset.colorCode;
        var bead = beads.find(function (b) { return b.colorCode === code; });
        if (bead) {
          bead.quantity = parseInt(e.target.value, 10) || 0;
          updateSummary();
        }
      }
    });

    function getFormData() {
      var name = document.getElementById('pattern-name').value.trim();
      var width = parseInt(document.getElementById('board-width').value, 10);
      var height = parseInt(document.getElementById('board-height').value, 10);
      var description = document.getElementById('pattern-description').value.trim();

      var data = { name: name, beads: beads };
      if (description) data.description = description;
      if (width && height) {
        data.boardSize = { width: width, height: height };
      }

      return data;
    }

    function submitForm(checkStock) {
      var data = getFormData();
      if (!data.name) {
        showToast('请填写图纸名称', 'error');
        return;
      }
      if (beads.length === 0) {
        showToast('请至少添加一个色号', 'error');
        return;
      }

      var method = pattern ? 'PUT' : 'POST';
      var url = pattern ? '/api/patterns/' + pattern.id : '/api/patterns';

      fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
        .then(function (res) {
          if (!res.ok) return res.json().then(function (d) { throw new Error(d.message); });
          return res.json();
        })
        .then(function (result) {
          if (checkStock) {
            window.location.href = '/patterns/' + result.id + '/edit';
          } else {
            showToast('保存成功');
            setTimeout(function () { window.location.href = '/patterns'; }, 800);
          }
        })
        .catch(function (err) {
          showToast(err.message, 'error');
        });
    }

    saveBtn.addEventListener('click', function (e) {
      e.preventDefault();
      submitForm(false);
    });

    saveCheckBtn.addEventListener('click', function (e) {
      e.preventDefault();
      submitForm(true);
    });

    if (pattern) {
      loadColorsForPicker();
    }

    renderBeadsTable();
    updateSummary();
  }

  function start() {
    if (listView) {
      initListView();
    } else if (editorView) {
      initEditorView();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();