(function () {
  'use strict';

  var hexInput = document.getElementById('hex-input');
  var targetSwatch = document.getElementById('target-swatch');
  var colorLibrarySelect = document.getElementById('color-library-select');
  var inStockOnlyCheckbox = document.getElementById('in-stock-only');
  var limitSelect = document.getElementById('limit-select');
  var resultsContainer = document.getElementById('results-container');

  var currentHex = window.PBM.preselectedHex || '';

  function updateSwatch(hex) {
    if (!hex || !/^#?[0-9A-Fa-f]{6}$/.test(hex)) {
      targetSwatch.style.background = '#cccccc';
      targetSwatch.style.color = '#000000';
      targetSwatch.textContent = '?';
      return;
    }
    var cleanHex = hex.startsWith('#') ? hex : '#' + hex;
    targetSwatch.style.background = cleanHex;
    var textColor = PBM.getTextColor(cleanHex);
    targetSwatch.style.color = textColor;
    targetSwatch.textContent = cleanHex.toUpperCase().replace('#', '');
  }

  function fetchColorsAndPopulate() {
    PBM.apiFetch('/api/colors').then(function (colors) {
      colors.forEach(function (color) {
        if (color.code === 'MIX') return;
        var option = document.createElement('option');
        option.value = color.hex;
        option.textContent = color.code + ' — ' + (color.name || color.code);
        colorLibrarySelect.appendChild(option);
      });
    }).catch(function (err) {
      console.error('Failed to load colors', err);
    });
  }

  function fetchAndRenderResults() {
    if (!currentHex) {
      resultsContainer.innerHTML = '<div class="empty-state"><div class="empty-state__icon">🎨</div><div class="empty-state__text">输入颜色代码或从色号库选择以计算色差</div></div>';
      return;
    }

    var params = {
      hex: currentHex.replace('#', ''),
      limit: limitSelect.value,
      inStockOnly: inStockOnlyCheckbox.checked,
    };

    var queryString = 'hex=' + encodeURIComponent(params.hex) +
      '&limit=' + encodeURIComponent(params.limit) +
      '&inStockOnly=' + params.inStockOnly;

    PBM.apiFetch('/api/color-diff?' + queryString).then(function (data) {
      renderResults(data);
    }).catch(function (err) {
      resultsContainer.innerHTML = '<div class="alert alert--danger">加载失败: ' + err.message + '</div>';
    });
  }

  function renderResults(data) {
    if (!data.results || data.results.length === 0) {
      resultsContainer.innerHTML = '<div class="empty-state"><div class="empty-state__icon">🔍</div><div class="empty-state__text">没有找到匹配的颜色</div></div>';
      return;
    }

    var html = '<div class="table-wrapper"><table><thead><tr><th>#</th><th>色号</th><th>名称</th><th>ΔE00</th><th>库存</th><th>操作</th></tr></thead><tbody>';

    data.results.forEach(function (result) {
      var deltaClass = 'delta-e--' + PBM.classifyDeltaE(result.deltaE);
      var textColor = PBM.getTextColor(result.hex);
      var stockClass = result.stock <= 0 ? 'stock-value--out' : (result.stock <= 50 ? 'stock-value--low' : '');
      var stockDisplay = result.stock > 0 ? result.stock : (result.stock === 0 ? '缺货' : result.stock);

      html += '<tr data-href="/inventory?color=' + result.colorCode + '">';
      html += '<td>' + result.rank + '</td>';
      html += '<td><span class="color-swatch" style="background:' + result.hex + '; color:' + textColor + ';">' + result.colorCode + '</span></td>';
      html += '<td>' + (result.name || '—') + '</td>';
      html += '<td class="' + deltaClass + '">' + result.deltaE.toFixed(2) + '</td>';
      html += '<td class="' + stockClass + '">' + stockDisplay + '</td>';
      html += '<td><a href="/inventory?color=' + result.colorCode + '" class="btn btn--sm btn--secondary">详情</a></td>';
      html += '</tr>';
    });

    html += '</tbody></table></div>';
    resultsContainer.innerHTML = html;

    resultsContainer.querySelectorAll('tr[data-href]').forEach(function (row) {
      row.style.cursor = 'pointer';
      row.addEventListener('click', function (e) {
        if (e.target.tagName !== 'A' && e.target.tagName !== 'BUTTON') {
          window.location.href = row.getAttribute('data-href');
        }
      });
    });
  }

  var debouncedFetch = PBM.debounce(fetchAndRenderResults, 300);

  hexInput.addEventListener('input', function (e) {
    var value = e.target.value.replace('#', '').toUpperCase();
    e.target.value = value;
    currentHex = value ? '#' + value : '';
    updateSwatch(currentHex);
    if (value && value.length === 6) {
      debouncedFetch();
    }
  });

  colorLibrarySelect.addEventListener('change', function (e) {
    if (e.target.value) {
      currentHex = e.target.value;
      hexInput.value = e.target.value.replace('#', '').toUpperCase();
      updateSwatch(currentHex);
      fetchAndRenderResults();
    }
  });

  inStockOnlyCheckbox.addEventListener('change', function () {
    if (currentHex && currentHex.length === 7) {
      fetchAndRenderResults();
    }
  });

  limitSelect.addEventListener('change', function () {
    if (currentHex && currentHex.length === 7) {
      fetchAndRenderResults();
    }
  });

  function start() {
    if (currentHex) {
      updateSwatch(currentHex);
      if (/^#?[0-9A-Fa-f]{6}$/.test(currentHex)) {
        fetchAndRenderResults();
      }
    }
    fetchColorsAndPopulate();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();