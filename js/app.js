/* =====================================================================
   Cron Expression Builder Pro — app.js
   Visual cron builder with two-way raw-expression sync, a from-scratch
   human-readable explainer, and a from-scratch next-run calculator.
   Classic script (no modules). Depends on window.WUS (core.js).
   ===================================================================== */
(function () {
  'use strict';

  var WUS = window.WUS;
  var STORE_KEY = 'cronbuilder.state';

  /* =================================================================
     FIELD DEFINITIONS
     ================================================================= */
  var MONTH_NAMES = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  var DOW_NAMES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  var MONTH_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var DOW_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  var FIELD_DEFS = [
    { key: 'minute', label: 'Minute', min: 0, max: 59, names: null, unit: 'minute(s)' },
    { key: 'hour', label: 'Hour', min: 0, max: 23, names: null, unit: 'hour(s)' },
    { key: 'dom', label: 'Day of month', min: 1, max: 31, names: null, unit: 'day(s)' },
    { key: 'month', label: 'Month', min: 1, max: 12, names: MONTH_NAMES, unit: 'month(s)' },
    { key: 'dow', label: 'Day of week', min: 0, max: 7, names: DOW_NAMES, unit: 'day(s) of week' }
  ];

  function defByKey(key) {
    for (var i = 0; i < FIELD_DEFS.length; i++) if (FIELD_DEFS[i].key === key) return FIELD_DEFS[i];
    return null;
  }

  /* =================================================================
     STATE
     One entry per field: { mode: 'every'|'specific'|'range'|'step',
                             specific: [nums], range: [from, to], step: n,
                             error: string|null }
     ================================================================= */
  var state = {};
  FIELD_DEFS.forEach(function (def) {
    state[def.key] = { mode: 'every', specific: [], range: [def.min, def.min], step: 1, error: null };
  });

  var syncing = false; // guards raw <-> fields feedback loop

  /* =================================================================
     DOM refs
     ================================================================= */
  var fieldsGrid = document.getElementById('fieldsGrid');
  var cardTemplate = document.getElementById('fieldCardTemplate');
  var rawInput = document.getElementById('rawInput');
  var rawError = document.getElementById('rawError');
  var explainText = document.getElementById('explainText');
  var runsList = document.getElementById('runsList');
  var runsEmpty = document.getElementById('runsEmpty');
  var statusBadge = document.getElementById('statusBadge');
  var statusText = document.getElementById('statusText');

  var cards = {}; // key -> { root, modeButtons, panels, specificInput, rangeFrom, rangeTo, stepInput, error }

  /* =================================================================
     BUILD FIELD CARDS FROM TEMPLATE
     ================================================================= */
  function buildCards() {
    FIELD_DEFS.forEach(function (def) {
      var node = cardTemplate.content.firstElementChild.cloneNode(true);
      node.setAttribute('data-field', def.key);
      node.querySelector('.field-card-title').textContent = def.label;
      node.querySelector('.field-card-range').textContent = def.min + '–' + def.max + (def.key === 'dow' ? ' (0 or 7 = Sun)' : '');

      var specificInput = node.querySelector('.field-specific-input');
      specificInput.placeholder = def.names ? 'e.g. ' + def.min + ',' + (def.min + 1) + ' or ' + def.names[0] : 'e.g. ' + def.min + ',' + (def.min + 1) + ',' + (def.min + 2);

      var rangeFrom = node.querySelector('.field-range-from');
      var rangeTo = node.querySelector('.field-range-to');
      rangeFrom.min = rangeTo.min = def.min;
      rangeFrom.max = rangeTo.max = def.max;
      rangeFrom.value = def.min;
      rangeTo.value = def.min;

      var stepInput = node.querySelector('.field-step-input');
      stepInput.min = 1;
      stepInput.max = def.max - def.min + 1;
      node.querySelector('.field-step-unit').textContent = def.unit;

      var errorEl = node.querySelector('.field-error');
      var modeButtons = Array.prototype.slice.call(node.querySelectorAll('.field-mode button'));
      var panels = {};
      Array.prototype.slice.call(node.querySelectorAll('.mode-panel')).forEach(function (p) {
        panels[p.getAttribute('data-mode-panel')] = p;
      });

      fieldsGrid.appendChild(node);
      cards[def.key] = {
        root: node, modeButtons: modeButtons, panels: panels,
        specificInput: specificInput, rangeFrom: rangeFrom, rangeTo: rangeTo,
        stepInput: stepInput, error: errorEl
      };

      modeButtons.forEach(function (btn) {
        btn.addEventListener('click', function () {
          setFieldMode(def.key, btn.getAttribute('data-mode'));
          onFieldsChanged();
        });
      });
      specificInput.addEventListener('input', WUS.debounce(function () {
        state[def.key].specific = parseSpecificInput(def, specificInput.value);
        onFieldsChanged();
      }, 200));
      rangeFrom.addEventListener('input', function () { readRangeInputs(def); onFieldsChanged(); });
      rangeTo.addEventListener('input', function () { readRangeInputs(def); onFieldsChanged(); });
      stepInput.addEventListener('input', function () {
        var n = parseInt(stepInput.value, 10);
        state[def.key].step = isNaN(n) ? 1 : n;
        onFieldsChanged();
      });
    });
  }

  function setFieldMode(key, mode) {
    state[key].mode = mode;
    var c = cards[key];
    c.modeButtons.forEach(function (btn) {
      var active = btn.getAttribute('data-mode') === mode;
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
      btn.classList.toggle('is-active', active);
    });
    Object.keys(c.panels).forEach(function (m) { c.panels[m].hidden = (m !== mode); });
  }

  function readRangeInputs(def) {
    var from = parseInt(cards[def.key].rangeFrom.value, 10);
    var to = parseInt(cards[def.key].rangeTo.value, 10);
    state[def.key].range = [isNaN(from) ? def.min : from, isNaN(to) ? def.min : to];
  }

  /* =================================================================
     PARSING helpers — resolve a token (number or name) to a number
     ================================================================= */
  function resolveToken(def, token) {
    token = String(token).trim();
    if (!token) return NaN;
    if (/^-?\d+$/.test(token)) return parseInt(token, 10);
    if (def.names) {
      var idx = def.names.indexOf(token.toUpperCase());
      if (idx > -1) return def.key === 'month' ? idx + 1 : idx; // months are 1-based, dow is 0-based
    }
    return NaN;
  }

  function parseSpecificInput(def, raw) {
    return raw.split(',').map(function (t) { return resolveToken(def, t); }).filter(function (n) { return !isNaN(n); });
  }

  function normalizeDowValue(def, v) {
    return (def.key === 'dow' && v === 7) ? 0 : v;
  }

  /* =================================================================
     VALIDATION — returns error string or null, per field
     ================================================================= */
  function validateField(def) {
    var s = state[def.key];
    if (s.mode === 'every') return null;
    if (s.mode === 'specific') {
      if (!s.specific.length) return 'Enter at least one value';
      for (var i = 0; i < s.specific.length; i++) {
        var v = s.specific[i];
        if (v < def.min || v > def.max) return 'Values must be between ' + def.min + ' and ' + def.max;
      }
      return null;
    }
    if (s.mode === 'range') {
      var from = s.range[0], to = s.range[1];
      if (isNaN(from) || isNaN(to)) return 'Enter both range bounds';
      if (from < def.min || to > def.max) return 'Range must fit within ' + def.min + '–' + def.max;
      if (from > to) return '"From" must not exceed "through"';
      return null;
    }
    if (s.mode === 'step') {
      if (!s.step || s.step < 1) return 'Step must be at least 1';
      if (s.step > (def.max - def.min + 1)) return 'Step is larger than the field range';
      return null;
    }
    return null;
  }

  function validateAll() {
    var anyError = false;
    FIELD_DEFS.forEach(function (def) {
      var err = validateField(def);
      state[def.key].error = err;
      var c = cards[def.key];
      c.root.classList.toggle('has-error', !!err);
      c.error.hidden = !err;
      c.error.textContent = err || '';
      if (err) anyError = true;
    });
    return !anyError;
  }

  /* =================================================================
     FIELD STATE  <->  CRON TOKEN
     ================================================================= */
  function fieldToToken(def) {
    var s = state[def.key];
    if (s.mode === 'every') return '*';
    if (s.mode === 'specific') {
      if (!s.specific.length) return '*';
      return s.specific.slice().sort(function (a, b) { return a - b; }).join(',');
    }
    if (s.mode === 'range') return s.range[0] + '-' + s.range[1];
    if (s.mode === 'step') return '*/' + s.step;
    return '*';
  }

  function tokenToFieldState(def, token) {
    token = token.trim();
    if (token === '*' || token === '') return { mode: 'every', specific: [], range: [def.min, def.min], step: 1 };

    var mStep = /^\*\/(\d+)$/.exec(token);
    if (mStep) return { mode: 'step', specific: [], range: [def.min, def.min], step: parseInt(mStep[1], 10) };

    if (token.indexOf(',') > -1) {
      var vals = token.split(',').map(function (t) { return resolveToken(def, t); }).filter(function (n) { return !isNaN(n); });
      return { mode: 'specific', specific: vals, range: [def.min, def.min], step: 1 };
    }

    var mRange = /^([A-Za-z0-9]+)-([A-Za-z0-9]+)$/.exec(token);
    if (mRange) {
      var from = resolveToken(def, mRange[1]), to = resolveToken(def, mRange[2]);
      if (!isNaN(from) && !isNaN(to)) return { mode: 'range', specific: [], range: [from, to], step: 1 };
    }

    var single = resolveToken(def, token);
    if (!isNaN(single)) return { mode: 'specific', specific: [single], range: [def.min, def.min], step: 1 };

    return null; // unparsable
  }

  /* =================================================================
     RAW <-> FIELDS SYNC
     ================================================================= */
  function updateRawFromFields() {
    if (syncing) return;
    syncing = true;
    rawInput.value = FIELD_DEFS.map(fieldToToken).join(' ');
    syncing = false;
  }

  function applyFieldStateToUI(def, s) {
    state[def.key] = s;
    setFieldMode(def.key, s.mode);
    cards[def.key].specificInput.value = s.specific.join(',');
    cards[def.key].rangeFrom.value = s.range[0];
    cards[def.key].rangeTo.value = s.range[1];
    cards[def.key].stepInput.value = s.step;
  }

  function updateFieldsFromRaw() {
    if (syncing) return;
    var raw = rawInput.value.trim();
    var parts = raw.split(/\s+/).filter(Boolean);
    if (parts.length !== 5) {
      rawError.hidden = false;
      rawError.textContent = 'A cron expression needs exactly 5 space-separated fields (minute hour day-of-month month day-of-week). Got ' + parts.length + '.';
      setStatus('error', 'Invalid expression');
      return;
    }
    var parsed = [];
    var bad = -1;
    for (var i = 0; i < FIELD_DEFS.length; i++) {
      var s = tokenToFieldState(FIELD_DEFS[i], parts[i]);
      if (!s) { bad = i; break; }
      parsed.push(s);
    }
    if (bad > -1) {
      rawError.hidden = false;
      rawError.textContent = 'Could not parse the "' + FIELD_DEFS[bad].label + '" field: "' + parts[bad] + '"';
      setStatus('error', 'Invalid expression');
      return;
    }
    rawError.hidden = true;
    syncing = true;
    FIELD_DEFS.forEach(function (def, i) { applyFieldStateToUI(def, parsed[i]); });
    syncing = false;
    render(false);
  }

  /* =================================================================
     EXPANSION — cron field state -> Set of matching numeric values
     ================================================================= */
  function expandField(def, s) {
    var set = new Set();
    if (s.mode === 'every') {
      for (var i = def.min; i <= def.max; i++) set.add(normalizeDowValue(def, i));
    } else if (s.mode === 'specific') {
      s.specific.forEach(function (v) { set.add(normalizeDowValue(def, v)); });
    } else if (s.mode === 'range') {
      var from = Math.min(s.range[0], s.range[1]), to = Math.max(s.range[0], s.range[1]);
      for (var j = from; j <= to; j++) set.add(normalizeDowValue(def, j));
    } else if (s.mode === 'step') {
      for (var k = def.min; k <= def.max; k += s.step) set.add(normalizeDowValue(def, k));
    }
    return set;
  }

  /* =================================================================
     HUMAN-READABLE EXPLANATION (from scratch, no library)
     ================================================================= */
  function listWords(names) {
    if (names.length === 1) return names[0];
    if (names.length === 2) return names[0] + ' and ' + names[1];
    return names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1];
  }

  function describeValues(def, values, fullNames) {
    var sorted = values.slice().sort(function (a, b) { return a - b; });
    if (fullNames) {
      var names = sorted.map(function (v) {
        return def.key === 'month' ? MONTH_FULL[v - 1] : DOW_FULL[v === 7 ? 0 : v];
      });
      return listWords(names);
    }
    return listWords(sorted.map(String));
  }

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  function buildExplanation() {
    var minute = state.minute, hour = state.hour, dom = state.dom, month = state.month, dow = state.dow;
    var clauses = [];

    // ---- time (minute + hour) clause ----
    var timeClause;
    if (minute.mode === 'every' && hour.mode === 'every') {
      timeClause = 'Every minute';
    } else if (minute.mode === 'specific' && minute.specific.length === 1 && hour.mode === 'specific' && hour.specific.length === 1) {
      timeClause = 'At ' + pad2(hour.specific[0]) + ':' + pad2(minute.specific[0]);
    } else {
      var minutePart;
      if (minute.mode === 'every') minutePart = 'every minute';
      else if (minute.mode === 'specific') minutePart = (minute.specific.length === 1 ? 'at minute ' : 'at minutes ') + describeValues(defByKey('minute'), minute.specific, false);
      else if (minute.mode === 'range') minutePart = 'every minute from ' + minute.range[0] + ' through ' + minute.range[1];
      else minutePart = 'every ' + minute.step + ' minute(s)';

      var hourPart;
      if (hour.mode === 'every') hourPart = 'past every hour';
      else if (hour.mode === 'specific') hourPart = (hour.specific.length === 1 ? 'during hour ' : 'during hours ') + describeValues(defByKey('hour'), hour.specific, false);
      else if (hour.mode === 'range') hourPart = 'during hours ' + hour.range[0] + ' through ' + hour.range[1];
      else hourPart = 'every ' + hour.step + ' hour(s)';

      timeClause = minutePart.charAt(0).toUpperCase() + minutePart.slice(1) + ' ' + hourPart;
    }
    clauses.push(timeClause);

    // ---- day-of-month / day-of-week clause (cron OR-union semantics) ----
    var domRestricted = dom.mode !== 'every';
    var dowRestricted = dow.mode !== 'every';

    function domDescribe() {
      if (dom.mode === 'specific') return (dom.specific.length === 1 ? 'day ' : 'days ') + describeValues(defByKey('dom'), dom.specific, false) + ' of the month';
      if (dom.mode === 'range') return 'days ' + dom.range[0] + ' through ' + dom.range[1] + ' of the month';
      if (dom.mode === 'step') return 'every ' + dom.step + ' day(s) of the month';
      return '';
    }
    function dowDescribe() {
      if (dow.mode === 'specific') return describeValues(defByKey('dow'), dow.specific, true);
      if (dow.mode === 'range') return DOW_FULL[dow.range[0] % 7] + ' through ' + DOW_FULL[dow.range[1] % 7];
      if (dow.mode === 'step') return 'every ' + dow.step + ' day(s) of the week';
      return '';
    }

    if (domRestricted && dowRestricted) {
      clauses.push('on ' + domDescribe() + ', or on ' + dowDescribe());
    } else if (domRestricted) {
      clauses.push('only on ' + domDescribe());
    } else if (dowRestricted) {
      clauses.push('only on ' + dowDescribe());
    }

    // ---- month clause ----
    if (month.mode !== 'every') {
      var monthPart;
      if (month.mode === 'specific') monthPart = 'in ' + describeValues(defByKey('month'), month.specific, true);
      else if (month.mode === 'range') monthPart = 'from ' + MONTH_FULL[month.range[0] - 1] + ' through ' + MONTH_FULL[month.range[1] - 1];
      else monthPart = 'every ' + month.step + ' month(s)';
      clauses.push(monthPart);
    }

    var sentence = clauses.join(', ') + '.';
    return sentence.charAt(0).toUpperCase() + sentence.slice(1);
  }

  /* =================================================================
     NEXT-RUN CALCULATOR (from scratch, no library)
     ================================================================= */
  function computeNextRuns(count, fromDate) {
    var minuteSet = expandField(defByKey('minute'), state.minute);
    var hourSet = expandField(defByKey('hour'), state.hour);
    var domSet = expandField(defByKey('dom'), state.dom);
    var monthSet = expandField(defByKey('month'), state.month);
    var dowSet = expandField(defByKey('dow'), state.dow);
    var domRestricted = state.dom.mode !== 'every';
    var dowRestricted = state.dow.mode !== 'every';

    var results = [];
    var d = new Date(fromDate.getTime());
    d.setSeconds(0, 0);
    d.setMinutes(d.getMinutes() + 1);

    var MAX_STEPS = 4 * 366 * 24 * 60; // ~4 years' worth of minutes, as a hard safety cap
    var steps = 0;

    while (results.length < count && steps < MAX_STEPS) {
      steps++;
      var mon = d.getMonth() + 1;
      if (!monthSet.has(mon)) {
        d.setMonth(d.getMonth() + 1, 1);
        d.setHours(0, 0, 0, 0);
        continue;
      }
      var dom_ = d.getDate();
      var dow_ = d.getDay();
      var dayMatches = (domRestricted && dowRestricted) ? (domSet.has(dom_) || dowSet.has(dow_))
        : domRestricted ? domSet.has(dom_)
        : dowRestricted ? dowSet.has(dow_)
        : true;
      if (!dayMatches) {
        d.setDate(d.getDate() + 1);
        d.setHours(0, 0, 0, 0);
        continue;
      }
      var hr = d.getHours();
      if (!hourSet.has(hr)) {
        d.setHours(d.getHours() + 1, 0, 0, 0);
        continue;
      }
      var min = d.getMinutes();
      if (!minuteSet.has(min)) {
        d.setMinutes(d.getMinutes() + 1);
        continue;
      }
      results.push(new Date(d.getTime()));
      d.setMinutes(d.getMinutes() + 1);
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

  function renderRuns() {
    var runs = computeNextRuns(5, new Date());
    runsList.innerHTML = '';
    if (!runs.length) {
      runsEmpty.hidden = false;
      return;
    }
    runsEmpty.hidden = true;
    var now = new Date();
    runs.forEach(function (d) {
      var li = document.createElement('li');
      var main = document.createElement('span');
      main.textContent = d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
      var rel = document.createElement('span');
      rel.className = 'rel';
      rel.textContent = formatRelative(d.getTime() - now.getTime());
      li.appendChild(main);
      li.appendChild(rel);
      runsList.appendChild(li);
    });
  }

  /* =================================================================
     STATUS
     ================================================================= */
  function setStatus(kind, text) {
    statusBadge.classList.remove('is-valid', 'is-error');
    if (kind === 'valid') statusBadge.classList.add('is-valid');
    else if (kind === 'error') statusBadge.classList.add('is-error');
    statusText.textContent = text;
  }

  /* =================================================================
     RENDER — recompute raw, explanation, runs, status
     ================================================================= */
  function render(updateRaw) {
    var ok = validateAll();
    if (updateRaw !== false) updateRawFromFields();
    if (!ok) {
      rawError.hidden = true; // field-level errors are shown per-card
      setStatus('error', 'Invalid field value');
      explainText.textContent = 'Fix the highlighted field(s) to see an explanation.';
      runsList.innerHTML = '';
      runsEmpty.hidden = true;
      persist();
      return;
    }
    explainText.textContent = buildExplanation();
    renderRuns();
    setStatus('valid', 'Valid expression');
    persist();
  }

  function onFieldsChanged() { render(true); }

  /* =================================================================
     ACTIONS
     ================================================================= */
  function copyRaw() {
    WUS.copy(rawInput.value, 'Expression copied to clipboard');
  }

  function resetAll() {
    FIELD_DEFS.forEach(function (def) {
      applyFieldStateToUI(def, { mode: 'every', specific: [], range: [def.min, def.min], step: 1 });
    });
    render(true);
    WUS.toast('Reset to every minute');
  }

  /* =================================================================
     PERSISTENCE
     ================================================================= */
  function persist() {
    WUS.store.set(STORE_KEY, { raw: rawInput.value });
  }

  function restore() {
    var saved = WUS.store.get(STORE_KEY, null);
    if (saved && typeof saved.raw === 'string' && saved.raw.trim()) {
      rawInput.value = saved.raw;
    } else {
      rawInput.value = '* * * * *';
    }
    updateFieldsFromRaw();
  }

  /* =================================================================
     SHORTCUTS HELP MODAL
     ================================================================= */
  var helpBackdrop = document.getElementById('helpBackdrop');
  var helpClose = document.getElementById('helpClose');
  var shortcutRows = document.getElementById('shortcutRows');

  var SHORTCUTS = [
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
     WIRING
     ================================================================= */
  buildCards();

  document.getElementById('btnCopyRaw').addEventListener('click', copyRaw);
  document.getElementById('btnResetRaw').addEventListener('click', resetAll);

  rawInput.addEventListener('input', WUS.debounce(function () { updateFieldsFromRaw(); }, 250));

  WUS.registerShortcut('mod+c', function () {
    if (document.activeElement !== rawInput) copyRaw();
  }, 'Copy expression');
  WUS.registerShortcut('?', function () { openHelp(); }, 'Show shortcuts');

  // Refresh the "next run" relative labels periodically so they stay accurate.
  setInterval(function () {
    if (validateAll()) renderRuns();
  }, 30000);

  /* =================================================================
     INIT
     ================================================================= */
  buildShortcutTable();
  restore();
})();
