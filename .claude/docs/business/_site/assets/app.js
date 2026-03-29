/* === Theme Toggle === */
(function() {
  const saved = localStorage.getItem('theme');
  const preferred = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  document.documentElement.dataset.theme = saved || preferred;
})();

document.addEventListener('DOMContentLoaded', function() {
  const themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) {
    function updateIcon() {
      themeToggle.textContent = document.documentElement.dataset.theme === 'dark' ? '\u2600\uFE0F' : '\uD83C\uDF19';
    }
    updateIcon();
    themeToggle.addEventListener('click', function() {
      const current = document.documentElement.dataset.theme;
      const next = current === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = next;
      localStorage.setItem('theme', next);
      updateIcon();
    });
  }

  /* === Domain Nav Toggle === */
  document.querySelectorAll('.nav-domain-toggle').forEach(function(btn) {
    btn.addEventListener('click', function() {
      const expanded = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', !expanded);
    });
  });

  /* === Mobile Sidebar Toggle === */
  const sidebarToggle = document.getElementById('sidebar-toggle');
  if (sidebarToggle) {
    sidebarToggle.addEventListener('click', function() {
      document.body.classList.toggle('sidebar-open');
    });
  }
  var content = document.querySelector('.content');
  if (content) {
    content.addEventListener('click', function() {
      document.body.classList.remove('sidebar-open');
    });
  }

  /* === Search === */
  var searchIndex = typeof SEARCH_INDEX !== 'undefined' ? SEARCH_INDEX : [];
  var searchInput = document.getElementById('search-input');
  var searchResults = document.getElementById('search-results');
  var debounceTimer = null;

  // Determine base path for link URLs
  var scripts = document.querySelectorAll('script[src*="app.js"]');
  var basePath = '';
  if (scripts.length > 0) {
    var src = scripts[0].getAttribute('src');
    basePath = src.replace('assets/app.js', '').replace('app.js', '');
  }

  function escapeHtml(str) {
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function highlightMatch(text, terms) {
    var result = escapeHtml(text);
    terms.forEach(function(t) {
      var re = new RegExp('(' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
      result = result.replace(re, '<mark>$1</mark>');
    });
    return result;
  }

  function handleSearch(query) {
    if (!query || query.length < 2) {
      searchResults.classList.remove('active');
      searchResults.innerHTML = '';
      return;
    }
    var terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    var results = searchIndex.filter(function(entry) {
      return terms.every(function(t) {
        var c = (entry.content || entry.summary || '').toLowerCase();
        return entry.title.toLowerCase().indexOf(t) !== -1 || c.indexOf(t) !== -1;
      });
    }).slice(0, 10);

    if (results.length === 0) {
      searchResults.innerHTML = '<div class="search-no-results">\uAC80\uC0C9 \uACB0\uACFC\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4</div>';
      searchResults.classList.add('active');
      return;
    }

    var urlPrefix = basePath;
    searchResults.innerHTML = results.map(function(r) {
      return '<a class="search-result-item" href="' + urlPrefix + r.url + '">' +
        '<span class="search-result-title">' + highlightMatch(r.title, terms) + '</span>' +
        '<span class="search-result-excerpt">' + highlightMatch((r.content || r.summary || '').substring(0, 120), terms) + '</span>' +
        '<span class="search-result-meta">' + r.type + ' \u00B7 ' + (r.domainLabel || (r.domain === '_global' ? '\uC804\uCCB4' : r.domain)) + '</span>' +
        '</a>';
    }).join('');
    searchResults.classList.add('active');
  }

  if (searchInput) {
    searchInput.addEventListener('input', function() {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(function() {
        handleSearch(searchInput.value.trim());
      }, 200);
    });
    document.addEventListener('click', function(e) {
      if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
        searchResults.classList.remove('active');
      }
    });
  }
});
