(function () {
  'use strict';

  var allColors = [];
  var currentSeries = null;
  var searchQuery = '';

  var colorGrid = document.getElementById('color-grid');
  var seriesTags = document.querySelectorAll('.filter-bar__tag[data-series]');
  var searchInput = document.getElementById('search-input');
  var colorDetailModal = document.getElementById('color-detail-modal');

  function fetchColors() {
    return PBM.apiFetch('/api/colors').then(function (colors) {
      allColors = colors;
      renderColorGrid();
      updateCartBadge();
    }).catch(function (err) {
      PBM.showToast('加载色号失败: ' + err.message, 'error');
    });
  }

  function updateCartBadge() {
    PBM.apiFetch('/api/cart').then(function (cart) {
      var count = Array.isArray(cart) ? cart.length : 0;
      if (window.PBM && window.PBM.updateCartBadge) {
        window.PBM.updateCartBadge(count);
      }
    }).catch(function () {});
  }

  function getFilteredColors() {
    var filtered = allColors;

    if (currentSeries) {
      filtered = filtered.filter(function (c) {
        return c.series === currentSeries;
      });
    }

    if (searchQuery.trim()) {
      var q = searchQuery.trim().toLowerCase();
      filtered = filtered.filter(function (c) {
        return c.code.toLowerCase().indexOf(q) !== -1 ||
          (c.name && c.name.toLowerCase().indexOf(q) !== -1) ||
          (c.nameEn && c.nameEn.toLowerCase().indexOf(q) !== -1);
      });
    }

    return filtered;
  }

  function renderColorGrid() {
    if (!colorGrid) return;

    var colors = getFilteredColors();

    colorGrid.innerHTML = '';

    colors.forEach(function (color) {
      var item = document.createElement('div');
      item.className = 'color-grid__item';
      if (color.stock === 0) {
        item.classList.add('color-grid__item--out-of-stock');
      }
      item.style.backgroundColor = color.hex;
      item.style.color = PBM.getTextColor(color.hex);
      item.setAttribute('data-color-code', color.code);
      item.setAttribute('data-series', color.series);
      item.setAttribute('tabindex', '0');
      item.setAttribute('role', 'button');
      item.setAttribute('aria-label', color.code + ' ' + (color.name || ''));

      var code = document.createElement('span');
      code.className = 'color-grid__code';
      code.textContent = color.code;

      item.appendChild(code);
      item.addEventListener('click', function () {
        openColorDetail(color.code);
      });
      item.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openColorDetail(color.code);
        }
      });

      colorGrid.appendChild(item);
    });
  }

  function openColorDetail(code) {
    PBM.apiFetch('/api/colors/' + code).then(function (color) {
      renderColorDetailModal(color);
      PBM.openModal('color-detail-modal');
    }).catch(function (err) {
      PBM.showToast('加载色号详情失败: ' + err.message, 'error');
    });
  }

  function renderColorDetailModal(color) {
    var modalBody = colorDetailModal.querySelector('.modal__body');
    if (!modalBody) return;

    var textColor = PBM.getTextColor(color.hex);
    var rgbStr = color.rgb ? color.rgb.join(', ') : '';

    modalBody.innerHTML =
      '<div class="color-detail">' +
        '<div class="color-detail__swatch" style="background-color:' + color.hex + ';color:' + textColor + '">' +
          '<span class="color-detail__code">' + color.code + '</span>' +
        '</div>' +
        '<div class="color-detail__info">' +
          '<div class="form-group">' +
            '<label class="form-label">HEX</label>' +
            '<div class="font-mono" style="padding:6px 0">' + color.hex + '</div>' +
          '</div>' +
          '<div class="form-group">' +
            '<label class="form-label">RGB</label>' +
            '<div class="font-mono" style="padding:6px 0">' + rgbStr + '</div>' +
          '</div>' +
          '<div class="form-group">' +
            '<label class="form-label" for="color-name-cn">中文名称</label>' +
            '<input type="text" id="color-name-cn" class="form-input" value="' + escHtml(color.name || '') + '" placeholder="中文名称">' +
          '</div>' +
          '<div class="form-group">' +
            '<label class="form-label" for="color-name-en">英文名称</label>' +
            '<input type="text" id="color-name-en" class="form-input" value="' + escHtml(color.nameEn || '') + '" placeholder="English name">' +
          '</div>' +
          '<div class="form-group">' +
            '<label class="form-label">当前库存</label>' +
            '<div id="color-stock" style="padding:6px 0">' +
              (color.stock !== undefined ? color.stock : '—') +
            '</div>' +
          '</div>' +
          '<a href="/color-diff?hex=' + encodeURIComponent(color.hex) + '" class="btn btn--secondary" style="margin-top:8px">' +
            '色差计算器 →' +
          '</a>' +
        '</div>' +
      '</div>';

    var saveBtn = colorDetailModal.querySelector('.modal__footer .btn--primary');
    if (saveBtn) {
      saveBtn.onclick = function () {
        saveColorName(color.code);
      };
    }
  }

  function saveColorName(code) {
    var nameInput = document.getElementById('color-name-cn');
    var nameEnInput = document.getElementById('color-name-en');

    if (!nameInput || !nameEnInput) return;

    var name = nameInput.value.trim();
    var nameEn = nameEnInput.value.trim();

    PBM.apiFetch('/api/colors/' + code, {
      method: 'PUT',
      body: JSON.stringify({ name: name, nameEn: nameEn }),
      headers: { 'Content-Type': 'application/json' }
    }).then(function (result) {
      PBM.showToast('保存成功', 'success');
      PBM.closeModal('color-detail-modal');

      allColors = allColors.map(function (c) {
        if (c.code === code) {
          c.name = name;
          c.nameEn = nameEn;
        }
        return c;
      });

      renderColorGrid();
    }).catch(function (err) {
      PBM.showToast('保存失败: ' + err.message, 'error');
    });
  }

  function escHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;')
              .replace(/'/g, '&#039;');
  }

  function handleSeriesFilter(e) {
    var tag = e.target.closest('.filter-bar__tag');
    if (!tag) return;

    var series = tag.getAttribute('data-series');

    seriesTags.forEach(function (t) {
      t.classList.remove('filter-bar__tag--active');
    });

    if (series === currentSeries) {
      currentSeries = null;
    } else {
      currentSeries = series;
      tag.classList.add('filter-bar__tag--active');
    }

    renderColorGrid();
  }

  function handleSearchInput(e) {
    searchQuery = e.target.value;
    renderColorGrid();
  }

  var debouncedSearch = PBM.debounce(handleSearchInput, 300);

  seriesTags.forEach(function (tag) {
    tag.addEventListener('click', handleSeriesFilter);
  });

  if (searchInput) {
    searchInput.addEventListener('input', debouncedSearch);
  }

  var filterBar = document.querySelector('.filter-bar');
  if (filterBar && PBM.initFilterBar) {
    PBM.initFilterBar(filterBar);
  }

  if (colorDetailModal) {
    var closeBtn = colorDetailModal.querySelector('.modal__close');
    if (closeBtn) {
      closeBtn.addEventListener('click', function () {
        PBM.closeModal('color-detail-modal');
      });
    }
  }

  function start() {
    fetchColors();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();