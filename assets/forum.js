/*
 * Convoro Events — forum bundle (vanilla JS, shipped prebuilt).
 * Adds an "Events" link to the header nav and an "Upcoming events" widget to the
 * forum sidebar. The pages themselves are server-rendered by the provider.
 */
(function () {
  var c = window.Convoro;
  if (!c || typeof c.registerSlot !== 'function') return;

  // ── Header nav link ──
  c.registerSlot('header:nav', {
    ext: 'convoro-calendar',
    order: 6,
    mount: function (el) {
      var a = document.createElement('a');
      a.href = '/events';
      a.className = 'rounded-lg px-3 py-2 text-sm font-semibold text-ink-2 hover:bg-surface-2';
      a.textContent = (c.trans && c.trans('Events')) || 'Events';
      el.appendChild(a);
    },
  });

  // ── "Upcoming events" sidebar widget ──
  c.registerSlot('forum:sidebar', {
    ext: 'convoro-calendar',
    order: 30,
    mount: function (el) {
      var card = document.createElement('div');
      card.className = 'overflow-hidden rounded-c border border-line bg-surface shadow-sm';
      card.innerHTML = '<h4 class="border-b border-line px-4 py-3 text-xs font-semibold uppercase tracking-wide text-ink-muted">' +
        ((c.trans && c.trans('Upcoming events')) || 'Upcoming events') + '</h4><div class="p-2" data-list></div>';
      var list = card.querySelector('[data-list]');

      function fmt(iso) {
        try {
          var d = new Date(iso.replace(' ', 'T'));
          return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' · ' +
            d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
        } catch (e) { return ''; }
      }

      fetch('/api/ext/events/upcoming', { headers: { Accept: 'application/json' } })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (d) {
          if (!d || !d.events || !d.events.length) { card.remove(); return; }
          list.innerHTML = d.events.map(function (ev) {
            var loc = ev.location ? ' · ' + esc(ev.location) : '';
            return '<a href="/events/' + ev.id + '" class="block rounded-lg px-3 py-2 hover:bg-surface-2">' +
              '<div class="text-sm font-semibold text-ink line-clamp-1">' + esc(ev.title) + '</div>' +
              '<div class="text-xs text-ink-muted">' + esc(fmt(ev.starts_at)) + loc + '</div></a>';
          }).join('');
          el.appendChild(card);
        })
        .catch(function () { /* silent */ });

      function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"]/g, function (m) {
          return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m];
        });
      }
    },
  });
})();
