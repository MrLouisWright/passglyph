(function () {
  var P = window.passglyph; if (!P) return;
  var $ = function (id) { return document.getElementById(id); };
  var ink = getComputedStyle(document.body).color || '#d1d5db';
  function draw(ctx, i, x, y, s) { ctx.setTransform(s / 32, 0, 0, s / 32, x, y); ctx.fill(new Path2D(P.hieroglyphPath(i))); }
  // alphabet legend (static, unrelated to anything typed)
  var a = $('alphabet'), ac = a.getContext('2d'), dpr = Math.min(3, window.devicePixelRatio || 1);
  a.width = 384 * dpr; a.height = 192 * dpr; ac.fillStyle = ink;
  for (var i = 0; i < 64; i++) draw(ac, i, ((i % 16) * 24 + 2) * dpr, (Math.floor(i / 16) * 48 + 10) * dpr, 20 * dpr);
  var bits = 5, mode = 'inline', off = null, st = $('visible-status');
  function fmt(n) { return n.toLocaleString('en-GB'); }
  function trade() {
    var n = Math.pow(2, bits);
    $('bits-v').textContent = bits;
    if (mode == 'inline') {
      $('t-glyphs').textContent = n + ' hieroglyphs';
      $('t-miss').textContent = '1 in ' + n;
      $('t-miss10').innerHTML = '1 in 10<sup>' + Math.round(bits * 10 * Math.LOG10E * Math.LN2) + '</sup>';
      $('t-leak').textContent = bits + ' bits per position';
      $('trade-note').textContent = 'With ' + bits + ' bits a single mistyped position is caught ' + (n - 1) + ' times out of ' + n + ', and the following positions almost always differ as well. The glyphs reveal nothing without the per-page key, which is non-extractable and never leaves memory.';
    } else {
      $('t-glyphs').textContent = fmt(n) + ' badge glyphs';
      $('t-miss').textContent = (100 / n).toPrecision(2) + ' %';
      $('t-miss10').textContent = 'n/a (one glyph per field)';
      $('t-leak').textContent = bits + ' bits in total (PBKDF2, 60k iterations)';
      $('trade-note').textContent = 'Badge mode (v1) shows one glyph per field derived from the whole password. Leaks less (≤ 12 bits in total) but doesn\u2019t show where a typo is.';
    }
  }
  function start() {
    if (off) off();
    // a new attach() = a new key: changing settings also re-keys
    off = P.attach($('pw'), $('pw2'), {
      mode: mode, bits: bits, size: mode == 'badge' ? 30 : 1.1,
      onChange: function (m) {
        st.className = 'pg-status' + (m === true ? ' ok' : m === false ? ' bad' : '');
        st.textContent = m === true ? '✔ Same glyphs: passwords match' : m === false ? "✖ Glyphs differ from the first wrong character: passwords don't match" : 'Type at least 8 characters in both fields.';
      },
      onFallback: function (r) { st.textContent = 'Fallback to normal dots (' + r + ' unsupported).'; }
    });
    ['pw', 'pw2'].forEach(function (id) { if ($(id).value) $(id).dispatchEvent(new Event('input')); });
  }
  // --- the UNSAFE alternative, for illustration only ---
  var cv = $('naive-cv'), nc = cv.getContext('2d');
  cv.width = 600 * dpr; cv.height = 40 * dpr;
  function naive() {
    if ($('naive-box').hidden) return;
    var v = Array.from($('pw').value), seen = {}, rep = 0;
    nc.setTransform(1, 0, 0, 1, 0, 0); nc.clearRect(0, 0, cv.width, cv.height);
    v.forEach(function (ch, k) {
      var cp = ch.codePointAt(0), idx = cp % 32;
      if (seen[cp] != null) { rep++; nc.setTransform(1, 0, 0, 1, 0, 0); nc.fillStyle = 'rgba(213,94,0,.35)'; nc.fillRect((k * 26) * dpr, 0, 24 * dpr, 40 * dpr); }
      seen[cp] = k; nc.fillStyle = ink; draw(nc, idx, (k * 26 + 2) * dpr, 8 * dpr, 22 * dpr);
    });
    $('naive-note').textContent = v.length ? (rep ? rep + ' glyph(s) repeat an earlier one (highlighted): an observer learns which characters are equal, i.e. the password\u2019s structure, and across sessions the mapping can be learned outright.' : 'Type a password with a repeated letter (e.g. "balloon") to see the pattern leak.') : '';
  }
  $('naive').addEventListener('change', function (e) { $('naive-box').hidden = !e.target.checked; naive(); });
  $('pw').addEventListener('input', naive);
  $('bits').addEventListener('input', function (e) { bits = +e.target.value; trade(); start(); });
  [].forEach.call(document.querySelectorAll('input[name=mode]'), function (r) { r.addEventListener('change', function () {
    mode = r.value; var s = $('bits');
    if (mode == 'inline') { s.min = 4; s.max = 6; bits = 5; } else { s.min = 4; s.max = 12; bits = 10; }
    s.value = bits; trade(); start(); }); });
  trade(); start();
})();
