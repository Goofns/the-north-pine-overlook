/* The North Pine Overlook — shared behaviour for every page.
   Kept dependency-free and defensive: each block no-ops if its markup is absent. */
(function () {
  'use strict';

  var REDUCE = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---- sticky nav shading + scroll progress + hero parallax ---- */
  (function () {
    var nav = document.querySelector('.nav');
    var bar = document.getElementById('progress');
    var stars = document.getElementById('stars');
    var moon = document.getElementById('moon');
    var ticking = false;
    var winH = 0, scrollable = 0;

    function measure() {
      winH = window.innerHeight;
      scrollable = document.documentElement.scrollHeight - winH;
    }
    function update() {
      var y = window.scrollY || window.pageYOffset;
      if (nav) nav.classList.toggle('scrolled', y > 40);
      if (bar) bar.style.transform = 'scaleX(' + (scrollable > 0 ? Math.min(y / scrollable, 1) : 0) + ')';
      if (!REDUCE && y < winH) {
        if (stars) stars.style.transform = 'translateY(' + (y * 0.28) + 'px)';
        if (moon) moon.style.transform = 'translateY(' + (y * 0.18) + 'px)';
      }
      ticking = false;
    }
    measure();
    update();
    window.addEventListener('load', measure);
    window.addEventListener('resize', function () {
      if (!ticking) { window.requestAnimationFrame(function () { measure(); update(); }); ticking = true; }
    }, { passive: true });
    window.addEventListener('scroll', function () {
      if (!ticking) { window.requestAnimationFrame(update); ticking = true; }
    }, { passive: true });
  })();

  /* ---- mobile nav drawer + dropdown ---- */
  (function () {
    var nav = document.querySelector('.nav');
    var toggle = document.querySelector('.nav-toggle');
    if (!nav || !toggle) return;

    function setOpen(open) {
      nav.classList.toggle('open', open);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    }
    toggle.addEventListener('click', function () {
      setOpen(!nav.classList.contains('open'));
    });
    // close the drawer after tapping any link inside it
    nav.querySelectorAll('.nav-links a').forEach(function (a) {
      a.addEventListener('click', function () { setOpen(false); });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') setOpen(false);
    });

    // on touch/narrow screens the dropdown expands in place instead of hovering
    var drop = nav.querySelector('.nav-drop');
    if (drop) {
      var btn = drop.querySelector('button');
      if (btn) {
        btn.addEventListener('click', function (e) {
          if (window.matchMedia('(max-width: 880px)').matches) {
            e.preventDefault();
            drop.classList.toggle('open');
          }
        });
      }
    }
  })();

  /* ---- reveal on scroll ---- */
  (function () {
    var items = document.querySelectorAll('.reveal');
    if (!items.length) return;
    if (REDUCE || !('IntersectionObserver' in window)) {
      items.forEach(function (el) { el.classList.add('in'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    items.forEach(function (el) { io.observe(el); });
  })();

  /* ---- hero starfield ---- */
  (function () {
    var sky = document.getElementById('stars');
    if (!sky) return;
    var n = window.innerWidth < 600 ? 48 : 88;
    var frag = document.createDocumentFragment();
    for (var i = 0; i < n; i++) {
      var s = document.createElement('span');
      s.className = 'star';
      var size = (Math.random() * 1.8 + 1).toFixed(2);
      s.style.width = size + 'px';
      s.style.height = size + 'px';
      s.style.left = (Math.random() * 100).toFixed(2) + '%';
      s.style.top = (Math.random() * 64).toFixed(2) + '%';
      s.style.opacity = (Math.random() * 0.5 + 0.3).toFixed(2);
      if (!REDUCE && Math.random() < 0.5) {
        s.classList.add('tw');
        s.style.animationDelay = (Math.random() * 4).toFixed(2) + 's';
      }
      frag.appendChild(s);
    }
    sky.appendChild(frag);
  })();

  /* ---- map: one finger scrolls the page, two fingers pan the map ---- */
  (function () {
    var frame = document.querySelector('.map-frame');
    if (!frame) return;
    var cover = frame.querySelector('.map-cover');
    var hint = frame.querySelector('.map-hint');
    if (!cover) return;
    var t;
    function flash() {
      if (!hint) return;
      hint.classList.add('show');
      clearTimeout(t);
      t = setTimeout(function () { hint.classList.remove('show'); }, 1600);
    }
    function reset() { cover.style.pointerEvents = ''; }
    cover.addEventListener('touchstart', function (e) {
      if (e.touches.length >= 2) {
        cover.style.pointerEvents = 'none';
        if (hint) hint.classList.remove('show');
      } else {
        flash();
      }
    }, { passive: true });
    cover.addEventListener('touchend', reset);
    cover.addEventListener('touchcancel', reset);
    document.addEventListener('touchend', function (e) {
      if (e.touches.length === 0) reset();
    }, { passive: true });
  })();

  /* ---- inquiry form -> opens a pre-filled email (no backend needed) ---- */
  window.sendInquiry = function () {
    var v = function (id) {
      var el = document.getElementById(id);
      return el ? (el.value || '').trim() : '';
    };
    var name = v('f-name'), email = v('f-email');
    if (!name || !email) {
      alert('Please add your name and email so we can write back.');
      return;
    }
    var body = [
      'Name: ' + name,
      'Email: ' + email,
      'Arrive: ' + (v('f-arrive') || '(not set)'),
      'Depart: ' + (v('f-depart') || '(not set)'),
      'Guests: ' + (v('f-guests') || '(not set)'),
      '',
      v('f-msg')
    ].join('\n');
    window.location.href = 'mailto:honkytonkiesproperties@gmail.com'
      + '?subject=' + encodeURIComponent('Direct booking inquiry - The North Pine Overlook')
      + '&body=' + encodeURIComponent(body);
  };
})();

/* ---------------- gallery + lightbox ---------------- */
(function () {
  var grid = document.getElementById('gal-grid');
  var lbox = document.getElementById('lbox');
  if (!grid || !lbox) return;

  var items = Array.prototype.slice.call(grid.querySelectorAll('.gal-item'));
  var img = document.getElementById('lbox-img');
  var cap = document.getElementById('lbox-cap');
  var toggle = document.getElementById('gal-toggle');
  var count = document.getElementById('gal-count');
  var current = 0;
  var lastFocus = null;
  var INITIAL = 12;

  /* show-all toggle */
  if (toggle) {
    toggle.addEventListener('click', function () {
      var expanded = toggle.getAttribute('aria-expanded') === 'true';
      items.forEach(function (el, i) { if (i >= INITIAL) el.hidden = expanded; });
      toggle.setAttribute('aria-expanded', String(!expanded));
      toggle.textContent = expanded ? 'Show all ' + items.length + ' photos' : 'Show fewer photos';
      if (count) {
        count.textContent = expanded
          ? 'Showing ' + INITIAL + ' of ' + items.length
          : 'Showing all ' + items.length;
      }
      if (expanded) grid.scrollIntoView({ block: 'start', behavior: 'smooth' });
    });
  }

  function show(i) {
    if (i < 0) i = items.length - 1;
    if (i >= items.length) i = 0;
    current = i;
    var el = items[i];
    img.src = el.getAttribute('data-full');
    img.alt = el.getAttribute('data-caption') || '';
    cap.textContent = (i + 1) + ' of ' + items.length + ' · ' + (el.getAttribute('data-caption') || '');
  }

  function open(i) {
    lastFocus = document.activeElement;
    lbox.hidden = false;
    lbox.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    show(i);
    document.getElementById('lbox-close').focus();
  }

  function close() {
    lbox.classList.remove('is-open');
    lbox.hidden = true;
    document.body.style.overflow = '';
    img.src = '';
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  items.forEach(function (el, i) {
    el.addEventListener('click', function () { open(i); });
  });

  document.getElementById('lbox-close').addEventListener('click', close);
  document.getElementById('lbox-prev').addEventListener('click', function () { show(current - 1); });
  document.getElementById('lbox-next').addEventListener('click', function () { show(current + 1); });
  lbox.addEventListener('click', function (e) { if (e.target === lbox) close(); });

  document.addEventListener('keydown', function (e) {
    if (lbox.hidden) return;
    if (e.key === 'Escape') { close(); }
    else if (e.key === 'ArrowLeft') { show(current - 1); }
    else if (e.key === 'ArrowRight') { show(current + 1); }
  });
})();
