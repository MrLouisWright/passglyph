(function () {
  var P = window.passglyph; if (!P) return;
  var $ = function (id) { return document.getElementById(id); };
  // alphabet sample (static legend, unrelated to anything typed)
  var a = $('alphabet'), r = new Uint16Array(24); crypto.getRandomValues(r);
  for (var i = 0; i < 24; i++) { var d = document.createElement('div'); d.innerHTML = P.opsToSVG(P.glyphOps(r[i] & 1023, 10, '#9ca3af'), 48); a.appendChild(d); }
  var bits = 10, off = null, st = $('visible-status');
  function fmt(n) { return n.toLocaleString('en-GB'); }
  function trade() {
    var n = Math.pow(2, bits);
    $('bits-v').textContent = bits;
    $('t-glyphs').textContent = fmt(n);
    $('t-miss').textContent = (100 / n).toPrecision(2) + ' % (1 in ' + fmt(n) + ')';
    $('t-leak').textContent = 'guesses ÷ ' + fmt(n);
    $('t-left').textContent = (40 - bits) + ' bits left';
    $('bar-miss').style.width = Math.round(100 * (1 - (bits - 4) / 8) * 0.5 + 10) + '%';
    $('bar-leak').style.width = Math.round(((bits - 4) / 8) * 50 + 10) + '%';
  }
  function start() {
    if (off) off();
    // a new attach() = a new salt, so moving the slider also re-salts
    off = P.attach($('pw'), $('pw2'), {
      bits: bits, size: 30,
      onChange: function (m) {
        st.className = 'pg-status' + (m === true ? ' ok' : m === false ? ' bad' : '');
        st.textContent = m === true ? '✔ Same glyph: passwords match' : m === false ? "✖ Different glyph: passwords don't match" : 'Type at least 8 characters in both fields.';
      }
    });
    ['pw', 'pw2'].forEach(function (id) { if ($(id).value) $(id).dispatchEvent(new Event('input')); });
  }
  $('bits').addEventListener('input', function (e) { bits = +e.target.value; trade(); start(); });
  $('show').addEventListener('change', function (e) { $('pw').type = $('pw2').type = e.target.checked ? 'text' : 'password'; });
  trade(); start();
})();
