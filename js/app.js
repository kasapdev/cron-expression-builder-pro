/* =====================================================================
   Cron Expression Builder Pro — app.js
   Visual 5-field cron builder with bidirectional raw <-> picker sync,
   a from-scratch human-readable explainer, and a from-scratch next-run
   calculator. Classic script (no modules). Depends on window.WUS (core.js).
   ===================================================================== */
(function () {
  'use strict';

  var WUS = window.WUS;
  var STORE_KEY = 'cronbuilder.state';
  var DEFAULT_RAW = '0 9 * * 1-5';

  var MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var DOW_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  /* =================================================================
     FIELD DEFINITIONS — order matches standard 5-field cron syntax
     ================================================================= */
  var FIELD_DEFS = [
    { key: 'minute', min: 0, max: 59 },
    { key: 'hour', min: 0, max: 23 },
    { key: 'dom', min: 1, max: 31 },
    { key: 'month', min: 1, max: 12, aliasSevenToZero: false },
    { key: 'dow', min: 0, max: 7, aliasSevenToZero: true } // 7 accepted as alias for Sunday (0)
  ];

  function defByKey(key) {
    for (var i = 0; i < FIELD_DEFS.length; i++) { if (FIELD_DEFS[i].key === key) return FIELD_DEFS[i]; }
    return null;
  }

  /* =================================================================
     CRON FIELD PARSER (from scratch)
     Handles: star, star-slash-n, a, a-b, a-b-slash-n, a-slash-n, and comma
     lists combining any of the above (e.g. "1-5,10,every-15th").
     Returns a Set<number> of matching values, or throws Error.
     ================================================================= */
  function parseCronField(raw, def) {
    if (raw === undefined || raw === null || raw === '') {
      throw new Error('field is empty');
    }
    var min = def.min, max = def.max;
    var boundsMax = def.aliasSevenToZero ? 7 : max;
    var set = new Set();

    function normalize(v) {
      return (def.aliasSevenToZero && v === 7) ? 0 : v;
    }
    function checkBounds(v, ctx) {
      if (isNaN(v) || v < min || v > boundsMax) {
        throw new Error('value out of range (' + min + '-' + max + '): "' + ctx + '"');
      }
    }

    var parts = String(raw).split(',');
    for (var i = 0; i < parts.length; i++) {
      var part = parts[i].trim();
      if (part === '') throw new Error('empty item in list');
      var m;

      if (part === '*') {
        for (var v0 = min; v0 <= max; v0++) set.add(normalize(v0));
        continue;
      }
      if ((m = /^\*\/(\d+)$/.exec(part))) {
        var step0 = parseInt(m[1], 10);
        if (step0 <= 0) throw new Error('step must be positive: "' + part + '"');
        for (var v1 = min; v1 <= max; v1 += step0) set.add(normalize(v1));
        continue;
      }
      if ((m = /^(\d+)-(\d+)\/(\d+)$/.exec(part))) {
        var a1 = parseInt(m[1], 10), b1 = parseInt(m[2], 10), step1 = parseInt(m[3], 10);
        if (step1 <= 0) throw new Error('step must be positive: "' + part + '"');
        checkBounds(a1, part); checkBounds(b1, part);
        if (a1 > b1) throw new Error('range start greater than end: "' + part + '"');
        for (var v2 = a1; v2 <= b1; v2 += step1) set.add(normalize(v2));
        continue;
      }
      if ((m = /^(\d+)-(\d+)$/.exec(part))) {
        var a2 = parseInt(m[1], 10), b2 = parseInt(m[2], 10);
        checkBounds(a2, part); checkBounds(b2, part);
        if (a2 > b2) throw new Error('range start greater than end: "' + part + '"');
        for (var v3 = a2; v3 <= b2; v3++) set.add(normalize(v3));
        continue;
      }
      if ((m = /^(\d+)\/(\d+)$/.exec(part))) {
        var a3 = parseInt(m[1], 10), step3 = parseInt(m[2], 10);
        if (step3 <= 0) throw new Error('step must be positive: "' + part + '"');
        checkBounds(a3, part);
        for (var v4 = a3; v4 <= max; v4 += step3) set.add(normalize(v4));
        continue;
      }
      if (/^\d+$/.test(part)) {
        var v5 = parseInt(part, 10);
        checkBounds(v5, part);
        set.add(normalize(v5));
        continue;
      }
      throw new Error('invalid value "' + part + '"');
    }
    return set;
  }

  var FIELD_LABELS = { minute: 'Minute', hour: 'Hour', dom: 'Day-of-month', month: 'Month', dow: 'Day-of-week' };

  function parseCronExpression(raw) {
    var trimmed = (raw || '').trim();
    if (!trimmed) throw new Error('Expression is empty');
    var parts = trimmed.split(/\s+/);
    if (parts.length !== 5) {
      throw new Error('Expected 5 space-separated fields (minute hour day-of-month month day-of-week), got ' + parts.length);
    }
    var result = { minute: null, hour: null, dom: null, month: null, dow: null, raw: {} };
    for (var i = 0; i < FIELD_DEFS.length; i++) {
      var def = FIELD_DEFS[i];
      try {
        result[def.key] = parseCronField(parts[i], def);
      } catch (e) {
        throw new Error(FIELD_LABELS[def.key] + ' field: ' + e.message);
      }
      result.raw[def.key] = parts[i];
    }
    result.domRestricted = result.raw.dom !== '*';
    result.dowRestricted = result.raw.dow !== '*';
    return result;
  }

  /* =================================================================
     HUMAN-READABLE EXPLANATION (from scratch, no library)
     ================================================================= */
  function pad2(n) { n = parseInt(n, 10); return (n < 10 ? '0' : '') + n; }

  function ordinal(n) {
    var suf = ['th', 'st', 'nd', 'rd'], v = n % 100;
    return n + (suf[(v - 20) % 10] || suf[v] || suf[0]);
  }

  function isStar(s) { return s === '*'; }
  function isSingle(s) { return /^\d+$/.test(s); }

  function describeMinuteOrHour(raw, singular, plural, ordinalForStep) {
    if (raw === '*') return 'every ' + singular;
    var m;
    if ((m = /^\*\/(\d+)$/.exec(raw))) {
      return ordinalForStep ? ('every ' + ordinal(parseInt(m[1], 10)) + ' ' + singular) : ('every ' + m[1] + ' ' + plural);
    }
    if (/^\d+$/.test(raw)) return singular + ' ' + raw;
    if ((m = /^(\d+)-(\d+)\/(\d+)$/.exec(raw))) return 'every ' + m[3] + ' ' + plural + ' from ' + m[1] + ' to ' + m[2];
    if ((m = /^(\d+)-(\d+)$/.exec(raw))) return plural + ' ' + m[1] + ' through ' + m[2];
    if ((m = /^(\d+)\/(\d+)$/.exec(raw))) return 'every ' + m[2] + ' ' + plural + ' starting at ' + m[1];
    var items = raw.split(',');
    return plural + ' ' + items.join(', ');
  }

  function normalizeDow(v) { return v === 7 ? 0 : v; }

  function describeDom(raw) {
    var m;
    if (/^\d+$/.test(raw)) return 'day ' + raw + ' of the month';
    if ((m = /^(\d+)-(\d+)\/(\d+)$/.exec(raw))) return 'every ' + m[3] + ' days of the month from ' + m[1] + ' to ' + m[2];
    if ((m = /^(\d+)-(\d+)$/.exec(raw))) return 'days ' + m[1] + ' through ' + m[2] + ' of the month';
    if ((m = /^\*\/(\d+)$/.exec(raw))) return 'every ' + m[1] + ' days of the month';
    if ((m = /^(\d+)\/(\d+)$/.exec(raw))) return 'every ' + m[2] + ' days of the month starting on day ' + m[1];
    var items = raw.split(',');
    return 'days ' + items.join(', ') + ' of the month';
  }

  function describeDow(raw) {
    if (raw === '1-5') return 'weekdays';
    if (raw === '0,6' || raw === '6,0') return 'weekends';
    var m;
    if (/^\d+$/.test(raw)) return DOW_NAMES[normalizeDow(parseInt(raw, 10))];
    if ((m = /^(\d+)-(\d+)$/.exec(raw))) return 'from ' + DOW_NAMES[normalizeDow(parseInt(m[1], 10))] + ' through ' + DOW_NAMES[normalizeDow(parseInt(m[2], 10))];
    if ((m = /^\*\/(\d+)$/.exec(raw))) return 'every ' + m[1] + ' days of the week';
    var items = raw.split(',').map(function (it) {
      return /^\d+$/.test(it) ? DOW_NAMES[normalizeDow(parseInt(it, 10))] : it;
    });
    return items.join(', ');
  }

  function describeMonth(raw) {
    var m;
    if (/^\d+$/.test(raw)) return 'in ' + MONTH_NAMES[parseInt(raw, 10) - 1];
    if ((m = /^(\d+)-(\d+)$/.exec(raw))) return 'from ' + MONTH_NAMES[parseInt(m[1], 10) - 1] + ' through ' + MONTH_NAMES[parseInt(m[2], 10) - 1];
    if ((m = /^\*\/(\d+)$/.exec(raw))) return 'every ' + m[1] + ' months';
    var items = raw.split(',').map(function (it) {
      return /^\d+$/.test(it) ? MONTH_NAMES[parseInt(it, 10) - 1] : it;
    });
    return 'in ' + items.join(', ');
  }

  function buildExplanation(parsed) {
    var r = parsed.raw;
    var timePhrase;

    if (isStar(r.minute) && isStar(r.hour)) {
      timePhrase = 'Every minute';
    } else if (isSingle(r.minute) && isSingle(r.hour)) {
      timePhrase = 'At ' + pad2(r.hour) + ':' + pad2(r.minute);
    } else if (isStar(r.hour)) {
      timePhrase = 'At ' + describeMinuteOrHour(r.minute, 'minute', 'minutes', false) + ' past every hour';
    } else if (isStar(r.minute)) {
      timePhrase = 'Every minute during ' + describeMinuteOrHour(r.hour, 'hour', 'hours', false);
    } else {
      timePhrase = 'At ' + describeMinuteOrHour(r.minute, 'minute', 'minutes', false) + ' past ' + describeMinuteOrHour(r.hour, 'hour', 'hours', true);
    }

    var dayPhrase;
    if (!parsed.domRestricted && !parsed.dowRestricted) {
      dayPhrase = 'every day';
    } else if (parsed.domRestricted && !parsed.dowRestricted) {
      dayPhrase = 'on ' + describeDom(r.dom);
    } else if (!parsed.domRestricted && parsed.dowRestricted) {
      dayPhrase = 'on ' + describeDow(r.dow);
    } else {
      dayPhrase = 'on ' + describeDom(r.dom) + ', or on ' + describeDow(r.dow);
    }

    var monthPhrase = isStar(r.month) ? '' : describeMonth(r.month);

    var sentence = timePhrase + ', ' + dayPhrase + (monthPhrase ? ', ' + monthPhrase : '') + '.';
    return sentence.charAt(0).toUpperCase() + sentence.slice(1);
  }

  /* =================================================================
     NEXT-RUN CALCULATOR (from scratch, no library)
     Walks forward day by day (bounded), and within each matching day
     enumerates the sorted hour x minute combinations that fall after
     "now". Standard cron day-of-month / day-of-week OR semantics:
     if both fields are restricted, a day matches if EITHER matches;
     if only one is restricted, only that one must match.
     ================================================================= */
  var MAX_SEARCH_DAYS = 4 * 366; // ~4-year safety cap

  function computeNextRuns(parsed, fromDate, count) {
    var minuteList = Array.from(parsed.minute).sort(function (a, b) { return a - b; });
    var hourList = Array.from(parsed.hour).sort(function (a, b) { return a - b; });

    var results = [];
    var startBoundary = new Date(fromDate.getTime());
    startBoundary.setSeconds(0, 0);
    startBoundary.setMinutes(startBoundary.getMinutes() + 1);

    var baseYear = fromDate.getFullYear(), baseMonth = fromDate.getMonth(), baseDate = fromDate.getDate();

    for (var d = 0; d < MAX_SEARCH_DAYS && results.length < count; d++) {
      var dayDate = new Date(baseYear, baseMonth, baseDate + d, 0, 0, 0, 0);
      var month = dayDate.getMonth() + 1;
      if (!parsed.month.has(month)) continue;

      var domOk = parsed.dom.has(dayDate.getDate());
      var dowOk = parsed.dow.has(dayDate.getDay());
      var dayMatches;
      if (parsed.domRestricted && parsed.dowRestricted) dayMatches = domOk || dowOk;
      else if (parsed.domRestricted) dayMatches = domOk;
      else if (parsed.dowRestricted) dayMatches = dowOk;
      else dayMatches = true;
      if (!dayMatches) continue;

      for (var hi = 0; hi < hourList.length && results.length < count; hi++) {
        for (var mi = 0; mi < minuteList.length && results.length < count; mi++) {
          var candidate = new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate(), hourList[hi], minuteList[mi], 0, 0);
          if (candidate.getTime() >= startBoundary.getTime()) {
            results.push(candidate);
          }
        }
      }
    }
    return results;
  }

  function formatRelative(ms) {
    var sec = Math.round(ms / 1000);
    var units = [['day', 86400], ['hour', 3600], ['minute', 60]];
    for (var i = 0; i < units.length; i++) {
      var n = Math.floor(sec / units[i][1]);
      if (n >= 1) return 'in ' + n + ' ' + units[i][0] + (n === 1 ? '' : 's');
    }
    return 'in under a minute';
  }

  /* =================================================================
     PICKER STATE
     One entry per field: { mode, specific, rangeFrom, rangeTo, step, list }
     ================================================================= */
  var pickerState = {};
  FIELD_DEFS.forEach(function (def) {
    pickerState[def.key] = { mode: 'every', specific: def.min, rangeFrom: def.min, rangeTo: def.max, step: 1, list: '' };
  });

  /* =================================================================
     DOM refs
     ================================================================= */
  var rawInput = document.getElementById('rawInput');
  var presetSelect = document.getElementById('presetSelect');
  var btnApply = document.getElementById('btnApply');
  var btnCopy = document.getElementById('btnCopy');

  var statusBadge = document.getElementById('statusBadge');
  var statusText = document.getElementById('statusText');

  var errorPanel = document.getElementById('errorPanel');
  var errorMsg = document.getElementById('errorMsg');

  var explainPanel = document.getElementById('explainPanel');
  var explainText = document.getElementById('explainText');

  var runsPanel = document.getElementById('runsPanel');
  var runsList = document.getElementById('runsList');
  var runsEmpty = document.getElementById('runsEmpty');

  var cardEls = {}; // key -> { root, modeButtons, panels, specific, rangeFrom, rangeTo, step, list, preview }

  FIELD_DEFS.forEach(function (def) {
    var root = document.querySelector('.field-card[data-field="' + def.key + '"]');
    cardEls[def.key] = {
      root: root,
      modeButtons: Array.prototype.slice.call(root.querySelectorAll('[data-role="mode"] button')),
      panels: {
        specific: root.querySelector('[data-mode-panel="specific"]'),
        range: root.querySelector('[data-mode-panel="range"]'),
        step: root.querySelector('[data-mode-panel="step"]'),
        list: root.querySelector('[data-mode-panel="list"]')
      },
      specific: root.querySelector('[data-role="specific"]'),
      rangeFrom: root.querySelector('[data-role="range-from"]'),
      rangeTo: root.querySelector('[data-role="range-to"]'),
      step: root.querySelector('[data-role="step"]'),
      list: root.querySelector('[data-role="list"]'),
      preview: root.querySelector('[data-role="preview"]')
    };
  });

  /* =================================================================
     PICKER <-> RAW FIELD SERIALIZATION
     ================================================================= */
  function serializeField(key) {
    var s = pickerState[key];
    var def = defByKey(key);
    if (s.mode === 'every') return '*';
    if (s.mode === 'specific') return String(s.specific);
    if (s.mode === 'range') return s.rangeFrom + '-' + s.rangeTo;
    if (s.mode === 'step') return '*/' + (s.step || 1);
    if (s.mode === 'list') return (s.list || '').trim() || '*';
    return '*';
  }

  function deserializeRawFieldToState(key, rawFieldStr) {
    var def = defByKey(key);
    var s = pickerState[key];
    var m;
    if (rawFieldStr === '*') {
      s.mode = 'every';
    } else if (/^\d+$/.test(rawFieldStr)) {
      s.mode = 'specific';
      var specificVal = parseInt(rawFieldStr, 10);
      // Day-of-week "7" is a valid cron alias for Sunday (0); normalize it
      // before clamping so the picker doesn't misrepresent it as Saturday.
      if (def.aliasSevenToZero && specificVal === 7) specificVal = 0;
      s.specific = clampInt(specificVal, def);
    } else if ((m = /^(\d+)-(\d+)$/.exec(rawFieldStr))) {
      s.mode = 'range';
      s.rangeFrom = clampInt(parseInt(m[1], 10), def);
      s.rangeTo = clampInt(parseInt(m[2], 10), def);
    } else if ((m = /^\*\/(\d+)$/.exec(rawFieldStr))) {
      s.mode = 'step';
      s.step = Math.max(1, parseInt(m[1], 10) || 1);
    } else {
      s.mode = 'list';
      s.list = rawFieldStr;
    }
    applyFieldStateToInputs(key);
  }

  function clampInt(v, def) {
    var max = def.aliasSevenToZero ? 6 : def.max;
    if (isNaN(v)) return def.min;
    return Math.min(max, Math.max(def.min, v));
  }

  /* Reflect pickerState[key] into the DOM without dispatching events. */
  function applyFieldStateToInputs(key) {
    var s = pickerState[key];
    var c = cardEls[key];

    c.modeButtons.forEach(function (btn) {
      var active = btn.getAttribute('data-mode') === s.mode;
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
      btn.classList.toggle('is-active', active);
    });
    Object.keys(c.panels).forEach(function (m) {
      if (c.panels[m]) c.panels[m].hidden = (m !== s.mode);
    });

    if (c.specific) c.specific.value = String(s.specific);
    if (c.rangeFrom) c.rangeFrom.value = String(s.rangeFrom);
    if (c.rangeTo) c.rangeTo.value = String(s.rangeTo);
    if (c.step) c.step.value = String(s.step);
    if (c.list) c.list.value = s.list;

    if (c.preview) c.preview.textContent = serializeField(key);
  }

  /* =================================================================
     SYNC ORCHESTRATION
     ================================================================= */
  function rebuildRawFromPickers() {
    var parts = FIELD_DEFS.map(function (def) { return serializeField(def.key); });
    var raw = parts.join(' ');
    rawInput.value = raw;
    FIELD_DEFS.forEach(function (def) { cardEls[def.key].preview.textContent = parts[FIELD_DEFS.indexOf(def)]; });
    processExpression(raw, { source: 'pickers' });
    persistDebounced();
  }

  function setStatus(kind, text) {
    statusBadge.classList.remove('is-valid', 'is-error');
    if (kind === 'valid') statusBadge.classList.add('is-valid');
    else if (kind === 'error') statusBadge.classList.add('is-error');
    statusText.textContent = text;
  }

  function showError(err) {
    errorMsg.textContent = err.message;
    errorPanel.hidden = false;
    explainPanel.hidden = true;
    runsPanel.hidden = true;
  }

  function clearError() {
    errorPanel.hidden = true;
    explainPanel.hidden = false;
    runsPanel.hidden = false;
  }

  function renderExplanation(parsed) {
    explainText.textContent = buildExplanation(parsed);
  }

  function renderNextRuns(parsed) {
    var runs = computeNextRuns(parsed, new Date(), 5);
    runsList.innerHTML = '';
    if (!runs.length) {
      runsEmpty.hidden = false;
      return;
    }
    runsEmpty.hidden = true;
    var now = new Date();
    runs.forEach(function (d, idx) {
      var li = document.createElement('li');
      var index = document.createElement('span');
      index.className = 'run-index';
      index.textContent = '#' + (idx + 1);
      var main = document.createElement('span');
      main.textContent = WUS.formatDate(d.getTime());
      var rel = document.createElement('span');
      rel.className = 'run-rel';
      rel.textContent = formatRelative(d.getTime() - now.getTime());
      li.appendChild(index);
      li.appendChild(main);
      li.appendChild(rel);
      runsList.appendChild(li);
    });
  }

  function processExpression(raw, opts) {
    opts = opts || {};
    try {
      var parsed = parseCronExpression(raw);
      clearError();
      setStatus('valid', 'Valid expression');
      renderExplanation(parsed);
      renderNextRuns(parsed);
      if (opts.source !== 'pickers') {
        FIELD_DEFS.forEach(function (def) { deserializeRawFieldToState(def.key, parsed.raw[def.key]); });
      }
    } catch (err) {
      setStatus('error', 'Invalid expression');
      showError(err);
      if (opts.source !== 'pickers') {
        var fields = (raw || '').trim().split(/\s+/);
        if (fields.length === 5) {
          FIELD_DEFS.forEach(function (def, i) { deserializeRawFieldToState(def.key, fields[i]); });
        }
      }
    }
  }

  /* =================================================================
     WIRING — field-card mode buttons + inputs
     ================================================================= */
  FIELD_DEFS.forEach(function (def) {
    var c = cardEls[def.key];
    var s = pickerState[def.key];

    c.modeButtons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        s.mode = btn.getAttribute('data-mode');
        applyFieldStateToInputs(def.key);
        rebuildRawFromPickers();
      });
    });

    if (c.specific) {
      c.specific.addEventListener('input', function () {
        s.specific = clampInt(parseInt(c.specific.value, 10), def);
        c.preview.textContent = serializeField(def.key);
        rebuildRawFromPickers();
      });
    }
    if (c.rangeFrom) {
      c.rangeFrom.addEventListener('input', function () {
        s.rangeFrom = clampInt(parseInt(c.rangeFrom.value, 10), def);
        rebuildRawFromPickers();
      });
    }
    if (c.rangeTo) {
      c.rangeTo.addEventListener('input', function () {
        s.rangeTo = clampInt(parseInt(c.rangeTo.value, 10), def);
        rebuildRawFromPickers();
      });
    }
    if (c.step) {
      c.step.addEventListener('input', function () {
        var n = parseInt(c.step.value, 10);
        s.step = (isNaN(n) || n < 1) ? 1 : n;
        rebuildRawFromPickers();
      });
    }
    if (c.list) {
      c.list.addEventListener('input', function () {
        s.list = c.list.value;
        rebuildRawFromPickers();
      });
    }
  });

  /* =================================================================
     WIRING — toolbar (raw input, presets, apply, copy)
     ================================================================= */
  rawInput.addEventListener('input', function () {
    processExpression(rawInput.value, { source: 'raw' });
    persistDebounced();
  });

  btnApply.addEventListener('click', function () {
    processExpression(rawInput.value, { source: 'raw' });
    persist();
    WUS.toast('Expression applied');
  });

  btnCopy.addEventListener('click', function () {
    if (!rawInput.value.trim()) { WUS.toast('Nothing to copy', 'error'); return; }
    WUS.copy(rawInput.value, 'Expression copied to clipboard');
  });

  presetSelect.addEventListener('change', function () {
    if (!presetSelect.value) return;
    rawInput.value = presetSelect.value;
    processExpression(rawInput.value, { source: 'raw' });
    persist();
    WUS.toast('Preset loaded');
    presetSelect.value = '';
  });

  rawInput.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      processExpression(rawInput.value, { source: 'raw' });
      persist();
      WUS.toast('Expression applied');
    }
  });

  /* =================================================================
     PERSISTENCE
     ================================================================= */
  function persist() {
    WUS.store.set(STORE_KEY, { raw: rawInput.value });
  }
  var persistDebounced = WUS.debounce(persist, 400);

  function restore() {
    var saved = WUS.store.get(STORE_KEY, null);
    var raw = (saved && typeof saved.raw === 'string' && saved.raw.trim()) ? saved.raw : DEFAULT_RAW;
    rawInput.value = raw;
    processExpression(raw, { source: 'raw' });
  }

  /* =================================================================
     SHORTCUTS HELP MODAL
     ================================================================= */
  var helpBackdrop = document.getElementById('helpBackdrop');
  var helpClose = document.getElementById('helpClose');
  var shortcutRows = document.getElementById('shortcutRows');

  var SHORTCUTS = [
    { keys: ['mod', '⏎'], desc: 'Apply raw expression' },
    { keys: ['mod', 'C'], desc: 'Copy expression' },
    { keys: ['?'], desc: 'Show this help' },
    { keys: ['Esc'], desc: 'Close dialog' }
  ];

  function buildShortcutTable() {
    var html = '';
    SHORTCUTS.forEach(function (s) {
      var kbds = s.keys.map(function (k) { return '<kbd>' + WUS.escapeHtml(k) + '</kbd>'; }).join('');
      html += '<tr><td>' + WUS.escapeHtml(s.desc) + '</td><td>' + kbds + '</td></tr>';
    });
    shortcutRows.innerHTML = html;
  }

  function openHelp() { helpBackdrop.hidden = false; helpClose.focus(); }
  function closeHelp() { helpBackdrop.hidden = true; }

  helpClose.addEventListener('click', closeHelp);
  helpBackdrop.addEventListener('click', function (e) { if (e.target === helpBackdrop) closeHelp(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !helpBackdrop.hidden) closeHelp(); });

  var helpBtns = document.querySelectorAll('[data-shortcut-help]');
  for (var i = 0; i < helpBtns.length; i++) helpBtns[i].addEventListener('click', openHelp);

  /* =================================================================
     GLOBAL SHORTCUTS
     ================================================================= */
  WUS.registerShortcut('mod+enter', function () {
    processExpression(rawInput.value, { source: 'raw' });
    persist();
    WUS.toast('Expression applied');
  }, 'Apply raw expression');
  WUS.registerShortcut('mod+c', function () {
    if (document.activeElement !== rawInput) {
      if (rawInput.value.trim()) WUS.copy(rawInput.value, 'Expression copied to clipboard');
    }
  }, 'Copy expression');
  WUS.registerShortcut('?', function () { openHelp(); }, 'Show shortcuts');

  /* Keep the "in X minutes" relative labels fresh without a full re-parse. */
  setInterval(function () {
    if (!errorPanel.hidden) return;
    try {
      var parsed = parseCronExpression(rawInput.value);
      renderNextRuns(parsed);
    } catch (e) { /* ignore — status already reflects invalid state */ }
  }, 30000);

  /* =================================================================
     INIT
     ================================================================= */
  buildShortcutTable();
  restore();
})();
