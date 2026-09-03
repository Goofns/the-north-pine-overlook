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

/* ---------------- gallery: room slideshows + lightbox ---------------- */
(function () {
  var grid = document.getElementById('gal-grid');
  var lbox = document.getElementById('lbox');
  if (!grid || !lbox) return;

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var lbImg = document.getElementById('lbox-img');
  var lbCap = document.getElementById('lbox-cap');
  var lastFocus = null;

  /* Build a model: one entry per tile, each with its list of photos. */
  var tiles = [];
  Array.prototype.forEach.call(grid.querySelectorAll('.gal-item'), function (el) {
    var imgs = el.querySelectorAll('.gal-slide');
    var label = el.querySelector('.gal-label b');
    var photos = [];
    if (imgs.length) {
      Array.prototype.forEach.call(imgs, function (im) {
        photos.push({ thumb: im.getAttribute('src'), alt: im.getAttribute('alt') });
      });
    } else {
      var solo = el.querySelector('img');
      photos.push({ thumb: solo.getAttribute('src'), alt: solo.getAttribute('alt') });
    }
    tiles.push({
      el: el,
      name: label ? label.textContent : '',
      photos: photos,
      slides: imgs,
      badge: el.querySelector('.gal-count-badge'),
      i: 0,
      timer: null
    });
  });

  function fullSrc(thumb) { return thumb.replace('/thumb/', '/'); }

  function paint(t) {
    if (!t.slides.length) return;
    Array.prototype.forEach.call(t.slides, function (s, n) {
      s.classList.toggle('is-active', n === t.i);
    });
    if (t.badge) t.badge.textContent = (t.i + 1) + '/' + t.photos.length;
  }

  function step(t, d) {
    t.i = (t.i + d + t.photos.length) % t.photos.length;
    paint(t);
  }

  function autoplay(t) {
    if (reduce || t.photos.length < 2) return;
    stop(t);
    t.timer = setInterval(function () { step(t, 1); }, 4200 + Math.random() * 1200);
  }
  function stop(t) { if (t.timer) { clearInterval(t.timer); t.timer = null; } }

  tiles.forEach(function (t) {
    var prev = t.el.querySelector('.gal-nav-prev');
    var next = t.el.querySelector('.gal-nav-next');
    if (prev) prev.addEventListener('click', function (e) { e.stopPropagation(); stop(t); step(t, -1); });
    if (next) next.addEventListener('click', function (e) { e.stopPropagation(); stop(t); step(t, 1); });

    t.el.addEventListener('mouseenter', function () { stop(t); });
    t.el.addEventListener('mouseleave', function () { autoplay(t); });

    var opener = t.el.querySelector('.gal-open') || t.el;
    opener.addEventListener('click', function () { open(t, t.i); });

    autoplay(t);
  });

  /* ---- lightbox, scoped to one room ---- */
  var cur = null;

  function show(t, i) {
    cur = { tile: t, i: (i + t.photos.length) % t.photos.length };
    var p = t.photos[cur.i];
    lbImg.src = fullSrc(p.thumb);
    lbImg.alt = p.alt || '';
    lbCap.innerHTML = '';
    var b = document.createElement('b');
    b.textContent = t.name + (t.photos.length > 1 ? '  ' + (cur.i + 1) + ' of ' + t.photos.length : '');
    lbCap.appendChild(b);
    lbCap.appendChild(document.createTextNode(p.alt || ''));
  }

  function open(t, i) {
    lastFocus = document.activeElement;
    lbox.hidden = false;
    lbox.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    show(t, i);
    document.getElementById('lbox-close').focus();
  }

  function close() {
    lbox.classList.remove('is-open');
    lbox.hidden = true;
    document.body.style.overflow = '';
    lbImg.src = '';
    cur = null;
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  document.getElementById('lbox-close').addEventListener('click', close);
  document.getElementById('lbox-prev').addEventListener('click', function () { if (cur) show(cur.tile, cur.i - 1); });
  document.getElementById('lbox-next').addEventListener('click', function () { if (cur) show(cur.tile, cur.i + 1); });
  lbox.addEventListener('click', function (e) { if (e.target === lbox) close(); });

  document.addEventListener('keydown', function (e) {
    if (lbox.hidden || !cur) return;
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowLeft') show(cur.tile, cur.i - 1);
    else if (e.key === 'ArrowRight') show(cur.tile, cur.i + 1);
  });
})();
