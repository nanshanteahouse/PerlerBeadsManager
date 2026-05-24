(function () {
  'use strict';

  var listView = document.getElementById('pattern-tbody');
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

  function renderPatternRow(pattern) {
    var colorCount = pattern.beads ? pattern.beads.length : 0;
    var totalBeads = pattern.totalBeads || 0;
    var boardSize = pattern.boardSize;
    var dateStr = pattern.createdAt ? new Date(pattern.createdAt).toLocaleDateString('zh-CN') : '';
    var boardDisplay = boardSize ? boardSize.width + '×' + boardSize.height : '—';
    var stockHTML = pattern._stockStatus ? getStockCheckHTML(pattern._stockStatus.items) : '<span class="spinner"></span>';

    var row = document.createElement('tr');
    row.className = 'pattern-row';
    row.dataset.patternId = pattern.id;

    row.innerHTML =
      '<td><input type="checkbox" class="pattern-checkbox" data-pattern-id="' + pattern.id + '"></td>' +
      '<td class="pattern-table__col-expand">' +
        '<button class="pattern-expand-btn" title="查看色号明细">▸</button>' +
      '</td>' +
      '<td><a href="/patterns/' + pattern.id + '/edit" class="pattern-row__name">📄 ' + pattern.name + '</a></td>' +
      '<td class="pattern-table__col-count">' + colorCount + '</td>' +
      '<td class="pattern-table__col-beads">' + totalBeads.toLocaleString() + '</td>' +
      '<td class="pattern-table__col-board">' + boardDisplay + '</td>' +
      '<td class="pattern-table__col-stock"><span class="pattern-row__stock">' + stockHTML + '</span></td>' +
      '<td class="pattern-table__col-date">' + dateStr + '</td>' +
      '<td class="pattern-table__col-actions">' +
        '<button class="btn btn--xs btn--ghost add-cart-btn" title="加入购物车">🛒</button>' +
        '<button class="btn btn--xs btn--ghost export-btn" title="导出JSON">📥</button>' +
        '<button class="btn btn--xs btn--ghost delete-btn" title="删除">🗑️</button>' +
      '</td>';

    return row;
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

    var tbody = listView;
    var allPatterns = [];
    var currentFilters = { stock: 'all', series: '', search: '', sort: 'createdAt', order: 'desc' };

    var loadingEl = document.getElementById('pattern-loading');
    var emptyEl = document.getElementById('pattern-empty');
    var tableWrapper = document.getElementById('pattern-table-wrapper');
    var filterBar = document.getElementById('pattern-filter-bar');
    var importBtn = document.getElementById('import-btn');
    var importForm = document.getElementById('import-form');
    var importFileForm = document.getElementById('import-file-form');
    var importCancelBtn = document.getElementById('import-cancel-btn');
    var confirmCartBtn = document.getElementById('confirm-add-to-cart');
    var searchInput = document.getElementById('pattern-search');
    var stockTags = document.getElementById('stock-tags');
    var seriesTags = document.getElementById('series-tags');

    var selectedPatternId = null;
    var selectedPatternName = '';
    var selectedIds = {};
    var currentPage = 1;
    var pageSize = 20;
    var currentFiltered = [];

    var toolbar = document.getElementById('pattern-toolbar');
    var selectionCount = document.getElementById('selection-count');
    var selectAllCheckbox = document.getElementById('select-all');
    var batchDeleteBtn = document.getElementById('batch-delete-btn');
    var batchExportBtn = document.getElementById('batch-export-btn');
    var batchCartBtn = document.getElementById('batch-cart-btn');
    var statsGrid = document.getElementById('pattern-stats');
    var statTotal = document.getElementById('stat-total-patterns');
    var statColors = document.getElementById('stat-color-types');
    var statInsufficient = document.getElementById('stat-insufficient');
    var checkAllBtn = document.getElementById('check-all-stock-btn');
    var pagination = document.getElementById('pagination');
    var prevPageBtn = document.getElementById('prev-page');
    var nextPageBtn = document.getElementById('next-page');
    var pageInfo = document.getElementById('page-info');

    readURLParams();

    window.addEventListener('popstate', function () {
      readURLParams();
      if (allPatterns.length > 0) {
        filterAndRender();
        syncURL();
      }
    });

    function computeStockStatus(pattern, inventory) {
      var items = [];
      var sufficient = true;
      (pattern.beads || []).forEach(function (b) {
        var stock = inventory[b.colorCode] || 0;
        var shortfall = b.quantity - stock;
        if (shortfall > 0) sufficient = false;
        items.push({ colorCode: b.colorCode, needed: b.quantity, stock: stock, shortfall: Math.max(0, shortfall) });
      });
      return { sufficient: sufficient, items: items };
    }

    function getPatternId(target) {
      var row = target.closest('.pattern-row');
      if (row) return row.dataset.patternId;
      var detailRow = target.closest('.pattern-detail-row');
      if (detailRow) return detailRow.dataset.parent;
      return null;
    }

    function findPattern(id) {
      return allPatterns.find(function (p) { return p.id === id; });
    }

    function updateSelectionUI() {
      var ids = Object.keys(selectedIds).filter(function (k) { return selectedIds[k]; });
      var count = ids.length;
      selectionCount.innerHTML = '已选 <strong>' + count + '</strong> 项';
      toolbar.style.display = count > 0 ? '' : 'none';
    }

    function renderPagination(totalItems) {
      var totalPages = Math.ceil(totalItems / pageSize) || 1;
      if (currentPage > totalPages) currentPage = totalPages;
      pageInfo.textContent = '第 ' + currentPage + ' / ' + totalPages + ' 页';
      prevPageBtn.disabled = currentPage <= 1;
      nextPageBtn.disabled = currentPage >= totalPages;
      pagination.style.display = totalPages > 1 ? '' : 'none';
    }

    function updateStats() {
      statTotal.textContent = allPatterns.length;
      var colorSet = {};
      var insufficientCount = 0;
      allPatterns.forEach(function (p) {
        if (p._stockStatus && !p._stockStatus.sufficient) insufficientCount++;
        (p.beads || []).forEach(function (b) { colorSet[b.colorCode] = true; });
      });
      statColors.textContent = Object.keys(colorSet).length;
      statInsufficient.textContent = insufficientCount;
    }

    function syncURL() {
      var params = [];
      if (currentFilters.search) params.push('q=' + encodeURIComponent(currentFilters.search));
      if (currentFilters.stock !== 'all') params.push('stock=' + currentFilters.stock);
      if (currentFilters.series) params.push('series=' + currentFilters.series);
      if (currentFilters.sort !== 'createdAt') params.push('sort=' + currentFilters.sort);
      if (currentFilters.order !== 'desc') params.push('order=' + currentFilters.order);
      var search = params.length > 0 ? '?' + params.join('&') : '';
      var url = window.location.pathname + search + window.location.hash;
      var current = window.location.pathname + window.location.search + window.location.hash;
      if (url !== current) history.pushState(null, '', url);
    }

    function readURLParams() {
      var params = new URLSearchParams(window.location.search);
      var q = params.get('q');
      if (q) {
        currentFilters.search = q;
        searchInput.value = q;
      }
      var stock = params.get('stock');
      if (stock === 'sufficient' || stock === 'insufficient') {
        currentFilters.stock = stock;
        stockTags.querySelectorAll('.filter-bar__tag').forEach(function (t) {
          t.classList.toggle('filter-bar__tag--active', t.dataset.stock === stock);
        });
      }
      var series = params.get('series');
      if (series) {
        currentFilters.series = series;
        seriesTags.querySelectorAll('.filter-bar__tag').forEach(function (t) {
          t.classList.toggle('filter-bar__tag--active', t.dataset.series === series);
        });
      }
      var sort = params.get('sort');
      if (sort && ['name', 'colorCount', 'totalBeads', 'createdAt'].indexOf(sort) !== -1) {
        currentFilters.sort = sort;
      }
      var order = params.get('order');
      if (order === 'asc') currentFilters.order = order;
    }

    function filterAndRender() {
      var filtered = allPatterns.slice();

      if (currentFilters.stock === 'sufficient') {
        filtered = filtered.filter(function (p) { return p._stockStatus && p._stockStatus.sufficient; });
      } else if (currentFilters.stock === 'insufficient') {
        filtered = filtered.filter(function (p) { return p._stockStatus && !p._stockStatus.sufficient; });
      }

      if (currentFilters.series) {
        var s = currentFilters.series;
        filtered = filtered.filter(function (p) {
          return (p.beads || []).some(function (b) { return b.colorCode.charAt(0) === s; });
        });
      }

      if (currentFilters.search) {
        var q = currentFilters.search;
        var qUpper = q.toUpperCase();
        filtered = filtered.filter(function (p) {
          if (p.name.indexOf(q) !== -1) return true;
          if (p.description && p.description.indexOf(q) !== -1) return true;
          return (p.beads || []).some(function (b) { return b.colorCode.indexOf(qUpper) !== -1; });
        });
      }

      var sortKey = currentFilters.sort;
      var order = currentFilters.order;
      filtered.sort(function (a, b) {
        var va, vb;
        switch (sortKey) {
          case 'name':
            va = a.name || ''; vb = b.name || '';
            return order === 'asc' ? va.localeCompare(vb, 'zh-CN') : vb.localeCompare(va, 'zh-CN');
          case 'colorCount':
            va = (a.beads || []).length; vb = (b.beads || []).length; break;
          case 'totalBeads':
            va = a.totalBeads || 0; vb = b.totalBeads || 0; break;
          default:
            va = a.createdAt || ''; vb = b.createdAt || ''; break;
        }
        if (va < vb) return order === 'asc' ? -1 : 1;
        if (va > vb) return order === 'asc' ? 1 : -1;
        return 0;
      });

      document.querySelectorAll('.sort-indicator').forEach(function (el) {
        el.textContent = '';
        el.classList.remove('sort-indicator--active');
      });
      var activeEl = document.getElementById('sort-' + sortKey);
      if (activeEl) {
        activeEl.textContent = order === 'asc' ? ' ▲' : ' ▼';
        activeEl.classList.add('sort-indicator--active');
      }

      currentFiltered = filtered;
      currentPage = 1;
      renderPage();
    }

    function renderPage() {
      var totalItems = currentFiltered.length;
      var start = (currentPage - 1) * pageSize;
      var paged = currentFiltered.slice(start, start + pageSize);

      renderPagination(totalItems);

      tbody.innerHTML = '';
      if (paged.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9"><div class="empty-state" style="padding:24px;"><div class="empty-state__text">没有匹配的图纸</div></div></td></tr>';
        return;
      }

      paged.forEach(function (pattern) {
        var row = renderPatternRow(pattern);
        tbody.appendChild(row);
      });

      selectedIds = {};
      selectAllCheckbox.checked = false;
      updateSelectionUI();
      syncURL();
    }

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
      var ids = Object.keys(selectedIds).filter(function (k) { return selectedIds[k]; });
      var qty = parseInt(document.getElementById('cart-quantity').value, 10) || 1;

      if (ids.length > 1) {
        var added = 0;
        var errors = [];
        var promises = ids.map(function (id) {
          var p = findPattern(id);
          var name = p ? p.name : id;
          return fetch('/api/cart', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ patternId: id, patternName: name, quantity: qty })
          })
            .then(function (res) {
              if (!res.ok) return res.json().then(function (d) { throw new Error(d.message); });
              added++;
            })
            .catch(function (err) { errors.push(name + ': ' + err.message); });
        });
        Promise.all(promises).then(function () {
          if (errors.length > 0) {
            showToast('部分失败：' + errors.join('；'), 'error');
          }
          showToast('已加入购物车（' + added + ' 张）');
          closeModal('add-to-cart-modal');
          if (window.PBM && window.PBM.updateCartBadge) {
            fetch('/api/cart').then(function (r) { return r.json(); }).then(function (cartData) {
              window.PBM.updateCartBadge(cartData.cart.length);
            });
          }
        });
        return;
      }

      if (!selectedPatternId) return;
      fetch('/api/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patternId: selectedPatternId, patternName: selectedPatternName, quantity: qty })
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

    var searchTimer;
    searchInput.addEventListener('input', function () {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(function () {
        currentFilters.search = searchInput.value.trim();
        filterAndRender();
      }, 300);
    });

    stockTags.addEventListener('click', function (e) {
      var tag = e.target.closest('.filter-bar__tag');
      if (!tag) return;
      stockTags.querySelectorAll('.filter-bar__tag').forEach(function (t) {
        t.classList.toggle('filter-bar__tag--active', t === tag);
      });
      currentFilters.stock = tag.dataset.stock;
      filterAndRender();
    });

    seriesTags.addEventListener('click', function (e) {
      var tag = e.target.closest('.filter-bar__tag');
      if (!tag) return;
      seriesTags.querySelectorAll('.filter-bar__tag').forEach(function (t) {
        t.classList.toggle('filter-bar__tag--active', t === tag);
      });
      currentFilters.series = tag.dataset.series;
      filterAndRender();
    });

    document.querySelector('#pattern-table thead').addEventListener('click', function (e) {
      var th = e.target.closest('th[data-sort]');
      if (!th) return;
      var sortKey = th.dataset.sort;
      if (currentFilters.sort === sortKey) {
        currentFilters.order = currentFilters.order === 'asc' ? 'desc' : 'asc';
      } else {
        currentFilters.sort = sortKey;
        currentFilters.order = sortKey === 'name' ? 'asc' : 'desc';
      }
      filterAndRender();
    });

    selectAllCheckbox.addEventListener('click', function () {
      var checked = selectAllCheckbox.checked;
      tbody.querySelectorAll('.pattern-checkbox').forEach(function (cb) {
        cb.checked = checked;
        selectedIds[cb.dataset.patternId] = checked;
      });
      updateSelectionUI();
    });

    batchDeleteBtn.addEventListener('click', function () {
      var ids = Object.keys(selectedIds).filter(function (k) { return selectedIds[k]; });
      if (ids.length === 0) return;
      if (!confirm('确定要删除选中的 ' + ids.length + ' 张图纸吗？此操作不可撤销。')) return;
      fetch('/api/patterns/batch-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: ids })
      })
        .then(function (res) {
          if (!res.ok) return res.json().then(function (d) { throw new Error(d.message); });
          return res.json();
        })
        .then(function () {
          showToast('已删除 ' + ids.length + ' 张图纸');
          loadPatterns();
        })
        .catch(function (err) {
          showToast(err.message, 'error');
        });
    });

    batchExportBtn.addEventListener('click', function () {
      var ids = Object.keys(selectedIds).filter(function (k) { return selectedIds[k]; });
      if (ids.length === 0) return;
      var selectedPatterns = allPatterns.filter(function (p) { return ids.indexOf(p.id) !== -1; });
      var json = JSON.stringify(selectedPatterns, null, 2);
      var blob = new Blob([json], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'patterns_export_' + Date.now() + '.json';
      a.click();
      URL.revokeObjectURL(url);
      showToast('已导出 ' + selectedPatterns.length + ' 张图纸');
    });

    batchCartBtn.addEventListener('click', function () {
      var ids = Object.keys(selectedIds).filter(function (k) { return selectedIds[k]; });
      if (ids.length === 0) return;
      selectedPatternId = ids[0];
      var names = ids.map(function (id) {
        var p = findPattern(id);
        return p ? p.name : id;
      });
      document.getElementById('cart-modal-pattern-name').textContent = names.join('、') + ' 共 ' + ids.length + ' 张';
      document.getElementById('cart-quantity').value = '1';
      openModal('add-to-cart-modal');
    });

    checkAllBtn.addEventListener('click', function () {
      loadPatterns();
    });

    prevPageBtn.addEventListener('click', function () {
      if (currentPage > 1) { currentPage--; renderPage(); }
    });

    nextPageBtn.addEventListener('click', function () {
      var totalPages = Math.ceil(currentFiltered.length / pageSize);
      if (currentPage < totalPages) { currentPage++; renderPage(); }
    });

    document.addEventListener('keydown', function (e) {
      if (!tableWrapper.style.display || tableWrapper.style.display === 'none') return;
      var activeTag = document.activeElement.tagName;
      if (activeTag === 'INPUT' || activeTag === 'TEXTAREA') return;

      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        selectAllCheckbox.checked = true;
        tbody.querySelectorAll('.pattern-checkbox').forEach(function (cb) {
          cb.checked = true;
          selectedIds[cb.dataset.patternId] = true;
        });
        updateSelectionUI();
        return;
      }

      if (e.key === 'Delete') {
        var ids = Object.keys(selectedIds).filter(function (k) { return selectedIds[k]; });
        if (ids.length === 0) return;
        if (!confirm('确定要删除选中的 ' + ids.length + ' 张图纸吗？此操作不可撤销。')) return;
        fetch('/api/patterns/batch-delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: ids })
        })
          .then(function (res) {
            if (!res.ok) return res.json().then(function (d) { throw new Error(d.message); });
            return res.json();
          })
          .then(function () {
            showToast('已删除 ' + ids.length + ' 张图纸');
            loadPatterns();
          })
          .catch(function (err) {
            showToast(err.message, 'error');
          });
        return;
      }

      if (e.key === 'Escape') {
        selectedIds = {};
        selectAllCheckbox.checked = false;
        tbody.querySelectorAll('.pattern-checkbox').forEach(function (cb) { cb.checked = false; });
        document.querySelectorAll('.pattern-detail-row--open').forEach(function (el) {
          el.style.display = 'none';
          el.classList.remove('pattern-detail-row--open');
          var pid = el.dataset.parent;
          var btn = document.querySelector('.pattern-row[data-pattern-id="' + pid + '"] .pattern-expand-btn');
          if (btn) btn.classList.remove('pattern-expand-btn--expanded');
        });
        updateSelectionUI();
        return;
      }
    });

    function expandRow(patternId) {
      var existing = document.querySelector('.pattern-detail-row[data-parent="' + patternId + '"]');
      var btn = document.querySelector('.pattern-row[data-pattern-id="' + patternId + '"] .pattern-expand-btn');

      if (existing) {
        var isOpen = existing.style.display !== 'none';
        existing.style.display = isOpen ? 'none' : '';
        existing.classList.toggle('pattern-detail-row--open', !isOpen);
        if (btn) btn.classList.toggle('pattern-expand-btn--expanded', !isOpen);
        return;
      }

      var pattern = findPattern(patternId);
      if (!pattern) return;

      if (btn) btn.classList.add('pattern-expand-btn--expanded');

      var detailRow = document.createElement('tr');
      detailRow.className = 'pattern-detail-row pattern-detail-row--open';
      detailRow.dataset.parent = patternId;

      var beadsHTML = '';
      if (pattern._stockStatus && pattern._stockStatus.items && pattern._stockStatus.items.length > 0) {
        beadsHTML = '<table class="detail-beads-table"><thead><tr><th>#</th><th>色号</th><th>用量</th><th>库存</th><th>缺口</th></tr></thead><tbody>';
        pattern._stockStatus.items.forEach(function (item, i) {
          var statusClass = item.shortfall > 0 ? 'stock-low' : 'stock-ok';
          beadsHTML += '<tr>' +
            '<td>' + (i + 1) + '</td>' +
            '<td>' + item.colorCode + '</td>' +
            '<td>' + item.needed.toLocaleString() + '</td>' +
            '<td class="' + statusClass + '">' + (item.stock > 0 ? item.stock.toLocaleString() : '0') + '</td>' +
            '<td class="' + statusClass + '">' + (item.shortfall > 0 ? '-' + item.shortfall.toLocaleString() : '—') + '</td>' +
            '</tr>';
        });
        beadsHTML += '</tbody></table>';
      }

      detailRow.innerHTML = '<td colspan="9">' +
        '<div class="pattern-detail-content">' +
          '<div class="detail-summary">' +
            '<div class="detail-section">' +
              '<div class="detail-section__title">描述</div>' +
              '<div class="text-sm">' + (pattern.description || '无描述') + '</div>' +
              (pattern.boardSize ? '<div class="text-sm text-secondary mt-8">底板尺寸：' + pattern.boardSize.width + ' × ' + pattern.boardSize.height + '</div>' : '') +
            '</div>' +
            '<div class="detail-section">' +
              '<div class="detail-section__title">色号用度 (' + (pattern._stockStatus && pattern._stockStatus.items ? pattern._stockStatus.items.length : 0) + '种)</div>' +
              beadsHTML +
            '</div>' +
          '</div>' +
          '<div class="detail-actions">' +
            '<a href="/patterns/' + patternId + '/edit" class="btn btn--sm btn--secondary">✏️ 编辑图纸</a>' +
            '<button class="btn btn--sm btn--secondary add-cart-btn">🛒 加入购物车</button>' +
          '</div>' +
        '</div>' +
        '</td>';

      var mainRow = document.querySelector('.pattern-row[data-pattern-id="' + patternId + '"]');
      if (mainRow) mainRow.parentNode.insertBefore(detailRow, mainRow.nextSibling);
    }

    function loadPatterns() {
      Promise.all([
        fetch('/api/patterns').then(function (r) { return r.json(); }),
        fetch('/api/inventory').then(function (r) { return r.json(); })
      ])
        .then(function (results) {
          var patterns = results[0];
          var inventoryArr = results[1];
          var inventoryMap = {};
          (inventoryArr || []).forEach(function (item) {
            inventoryMap[item.code] = item.quantity || 0;
          });

          allPatterns = patterns.map(function (p) {
            p._stockStatus = computeStockStatus(p, inventoryMap);
            return p;
          });

          loadingEl.style.display = 'none';

          if (allPatterns.length === 0) {
            emptyEl.style.display = '';
            tableWrapper.style.display = 'none';
            filterBar.style.display = 'none';
            statsGrid.style.display = 'none';
            return;
          }

          emptyEl.style.display = 'none';
          tableWrapper.style.display = '';
          filterBar.style.display = '';
          statsGrid.style.display = '';

          updateStats();
          filterAndRender();
        })
        .catch(function (err) {
          loadingEl.style.display = 'none';
          tableWrapper.style.display = '';
          statsGrid.style.display = 'none';
          tbody.innerHTML = '<tr><td colspan="9"><div class="alert alert--danger" style="margin:16px;">加载失败：' + err.message + '</div></td></tr>';
        });
    }

    tbody.addEventListener('click', function (e) {
      if (e.target.classList.contains('pattern-checkbox')) {
        var cb = e.target;
        selectedIds[cb.dataset.patternId] = cb.checked;
        var allChecked = tbody.querySelectorAll('.pattern-checkbox');
        var allSelected = Array.from(allChecked).every(function (c) { return c.checked; });
        selectAllCheckbox.checked = allSelected;
        updateSelectionUI();
        return;
      }

      var patternId = getPatternId(e.target);
      if (!patternId) return;

      if (e.target.closest('.pattern-expand-btn')) {
        expandRow(patternId);
        return;
      }

      if (e.target.closest('.add-cart-btn')) {
        selectedPatternId = patternId;
        var pattern = findPattern(patternId);
        if (pattern) {
          selectedPatternName = pattern.name;
          document.getElementById('cart-modal-pattern-name').textContent = pattern.name;
        }
        document.getElementById('cart-quantity').value = '1';
        openModal('add-to-cart-modal');
        return;
      }

      if (e.target.closest('.export-btn')) {
        window.location.href = '/api/patterns/' + patternId + '/export';
        return;
      }

      if (e.target.closest('.delete-btn')) {
        if (!confirm('确定要删除这个图纸吗？此操作不可撤销。')) return;
        fetch('/api/patterns/' + patternId, { method: 'DELETE' })
          .then(function (res) {
            if (!res.ok) return res.json().then(function (d) { throw new Error(d.message); });
            return res.json();
          })
          .then(function () {
            showToast('已删除');
            allPatterns = allPatterns.filter(function (p) { return p.id !== patternId; });
            var detailRow = document.querySelector('.pattern-detail-row[data-parent="' + patternId + '"]');
            if (detailRow) detailRow.remove();
            filterAndRender();
            if (allPatterns.length === 0) {
              tableWrapper.style.display = 'none';
              emptyEl.style.display = '';
              filterBar.style.display = 'none';
            }
          })
          .catch(function (err) {
            showToast(err.message, 'error');
          });
        return;
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
        // Skip mixed beads — cannot be used in patterns
        if (color.code === 'MIX') return;
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

    loadColorsForPicker();

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