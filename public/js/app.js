/**
 * Perler Beads Manager — Shared Client-Side Utilities
 */

(function () {
  'use strict';

  /* ── Theme ─────────────────────────────────────────── */
  const THEME_KEY = 'theme';
  const themeBtn = document.getElementById('theme-toggle');
  const ICONS = { light: '☀️', dark: '🌙', system: '💻' };
  const LABELS = { light: '亮色模式', dark: '暗色模式', system: '跟随系统' };

  function applyTheme(mode) {
    document.documentElement.setAttribute('data-theme', mode);
    if (themeBtn) {
      themeBtn.textContent = ICONS[mode] || '☀️';
      themeBtn.title = LABELS[mode] || '切换主题';
    }
  }

  function cycleTheme() {
    const current = localStorage.getItem(THEME_KEY) || 'system';
    const next = current === 'light' ? 'dark' : current === 'dark' ? 'system' : 'light';
    localStorage.setItem(THEME_KEY, next);
    applyTheme(next);
  }

  if (themeBtn) {
    themeBtn.addEventListener('click', cycleTheme);
  }

  const savedTheme = localStorage.getItem(THEME_KEY);
  if (savedTheme) {
    applyTheme(savedTheme);
  }

  const colorSchemeQuery = window.matchMedia('(prefers-color-scheme: dark)');
  colorSchemeQuery.addEventListener('change', function () {
    if (localStorage.getItem(THEME_KEY) === 'system' || !localStorage.getItem(THEME_KEY)) {
      applyTheme('system');
    }
  });

  /* ── Nav Toggle (mobile) ──────────────────────────── */
  const navToggle = document.getElementById('nav-toggle');
  const navLinks = document.getElementById('nav-links');
  if (navToggle && navLinks) {
    navToggle.addEventListener('click', function () {
      const isOpen = navLinks.classList.toggle('navbar__links--open');
      navToggle.setAttribute('aria-expanded', isOpen);
    });

    document.addEventListener('click', function (e) {
      if (!navToggle.contains(e.target) && !navLinks.contains(e.target)) {
        navLinks.classList.remove('navbar__links--open');
        navToggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  /* ── Cart Badge ───────────────────────────────────── */
  function updateCartBadge(count) {
    const badge = document.getElementById('cart-badge');
    if (!badge) return;
    count = Math.max(0, parseInt(count, 10) || 0);
    badge.textContent = count;
    badge.classList.toggle('navbar__badge--zero', count === 0);
  }

  function fetchCartBadge() {
    apiFetch('/api/cart')
      .then(function (data) {
        if (data && Array.isArray(data.cart)) {
          updateCartBadge(data.cart.length);
        }
      })
      .catch(function () {});
  }

  /* ── Color Utilities ──────────────────────────────── */
  function getLuminance(hex) {
    const clean = hex.replace('#', '');
    const vals = clean.match(/\w\w/g);
    if (!vals || vals.length < 3) return 0.5;
    const [r, g, b] = vals.map(function (x) {
      const c = parseInt(x, 16) / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  function getTextColor(hex) {
    return getLuminance(hex) > 0.179 ? '#000000' : '#ffffff';
  }

  /* ── Delta-E Classification ───────────────────────── */
  function classifyDeltaE(value) {
    if (value <= 1.0) return 'green';
    if (value <= 3.0) return 'yellow';
    if (value <= 5.0) return 'orange';
    return 'red';
  }

  /* ── Toast Notifications ──────────────────────────── */
  function showToast(message, type) {
    type = type || 'success';
    var container = document.querySelector('.toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    var toast = document.createElement('div');
    toast.className = 'toast toast--' + type;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(function () {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(20px)';
      toast.style.transition = 'opacity 0.3s, transform 0.3s';
      setTimeout(function () {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }, 2500);
  }

  /* ── Modal Utilities ──────────────────────────────── */
  function openModal(modalId) {
    var overlay = document.getElementById(modalId);
    if (overlay) {
      overlay.classList.add('modal-overlay--active');
      document.body.classList.add('modal-open');
    }
  }

  function closeModal(modalId) {
    var overlay = document.getElementById(modalId);
    if (overlay) {
      overlay.classList.remove('modal-overlay--active');
      document.body.classList.remove('modal-open');
    }
  }

  function closeAllModals() {
    document.querySelectorAll('.modal-overlay--active').forEach(function (el) {
      el.classList.remove('modal-overlay--active');
    });
    document.body.classList.remove('modal-open');
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      closeAllModals();
    }
  });

  document.addEventListener('click', function (e) {
    if (e.target.classList.contains('modal-overlay--active')) {
      closeAllModals();
    }
  });

  /* ── API helper ───────────────────────────────────── */
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
            return res.json().then(function (err) {
              throw new Error(err.message || '请求失败 (' + res.status + ')');
            });
          }
          return res.text().then(function () {
            throw new Error('请求失败 (HTTP ' + res.status + ')');
          });
        }
        return res.json();
      });
  }

  /* ── Debounce ─────────────────────────────────────── */
  function debounce(fn, delay) {
    var timer;
    return function () {
      var context = this;
      var args = arguments;
      clearTimeout(timer);
      timer = setTimeout(function () {
        fn.apply(context, args);
      }, delay);
    };
  }

  /* ── Filter Bar Toggle (compact mode) ─────────────── */
  function initFilterBar(filterBarEl) {
    if (!filterBarEl) return;
    var searchBtn = filterBarEl.querySelector('.filter-bar__search-btn');
    var searchInput = filterBarEl.querySelector('.filter-bar__search-input');
    var searchWrapper = filterBarEl.querySelector('.filter-bar__search');

    function updateMode() {
      if (filterBarEl.offsetWidth < 540) {
        filterBarEl.setAttribute('data-filter-bar', 'compact');
      } else {
        filterBarEl.setAttribute('data-filter-bar', '');
      }
    }

    var ro = new ResizeObserver(debounce(updateMode, 100));
    ro.observe(filterBarEl);
    updateMode();

    if (searchBtn && searchInput && searchWrapper) {
      searchBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        searchWrapper.classList.toggle('filter-bar__search--expanded');
        if (searchWrapper.classList.contains('filter-bar__search--expanded')) {
          setTimeout(function () { searchInput.focus(); }, 100);
        }
      });

      document.addEventListener('click', function (e) {
        if (!searchWrapper.contains(e.target)) {
          searchWrapper.classList.remove('filter-bar__search--expanded');
        }
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fetchCartBadge);
  } else {
    fetchCartBadge();
  }

  /* ── Exports ──────────────────────────────────────── */
  window.PBM = {
    getLuminance: getLuminance,
    getTextColor: getTextColor,
    classifyDeltaE: classifyDeltaE,
    showToast: showToast,
    openModal: openModal,
    closeModal: closeModal,
    closeAllModals: closeAllModals,
    apiFetch: apiFetch,
    debounce: debounce,
    initFilterBar: initFilterBar,
    updateCartBadge: updateCartBadge,
  };
})();
