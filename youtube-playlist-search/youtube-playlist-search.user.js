// ==UserScript==
// @name         YouTube Playlist Search
// @name:es      Buscador en listas de YouTube
// @namespace    https://github.com/JosueMeserom/altamira
// @version      0.3.0
// @description  Search ALL the videos of a playlist (Liked videos and Watch later too) without scrolling. The list is cached.
// @description:es  Busca en TODOS los vídeos de una lista de reproducción (también «Vídeos que me gustan» y «Ver más tarde»), sin hacer scroll. Guarda la lista en caché.
// @author       JosueMeserom
// @license      MIT
// @homepageURL  https://github.com/JosueMeserom/altamira
// @supportURL   https://github.com/JosueMeserom/altamira/issues
// @downloadURL  https://raw.githubusercontent.com/JosueMeserom/altamira/main/youtube-playlist-search/youtube-playlist-search.user.js
// @updateURL    https://raw.githubusercontent.com/JosueMeserom/altamira/main/youtube-playlist-search/youtube-playlist-search.user.js
// @match        https://www.youtube.com/*
// @grant        none
// @run-at       document-idle
// @noframes
// ==/UserScript==

// Layout-independent: it asks for the playlist through the same internal API YouTube uses
// while you scroll (100 videos per request) and renders its own results.
(() => {
  'use strict';
  if (window.__ytPlaylistSearch) return;
  window.__ytPlaylistSearch = true;

  const MAX_SHOWN = 300;
  const DESC_PARALLEL = 3;

  // UI strings: Spanish when YouTube (or the browser) is in Spanish, English otherwise.
  const T = /^es/i.test(document.documentElement.lang || navigator.language || '') ? {
    search: 'Buscar en toda la lista…', channel: 'Canal', desc: 'Descripciones', remember: 'Recordar abierto o cerrado', rescan: 'Volver a escanear',
    open: 'Buscar en la lista', close: 'Ocultar el buscador',
    idle: 'Empieza a escribir para escanear la lista', scanning: (n) => `Escaneando… ${n} vídeos`, error: (e) => `No se pudo leer la lista (${e})`, ready: (n, o) => `${n} vídeos · ${o}`,
    cached: 'caché', fresh: 'recién escaneada', cachedUnchecked: 'caché (no se pudo comprobar si ha cambiado)',
    descInfo: (a, b, f) => `Descripciones: ${a} de ${b}${f ? ` (${f} sin datos)` : ''}`, stopped: ' · detenido: YouTube no devuelve más',
    noTitle: '(sin título)', nothingYet: 'Nada todavía…', noResults: 'Sin resultados', results: (n) => `${n} resultados`, tooMany: (n, m) => `${n} resultados; se muestran ${m}. Afina la búsqueda.`,
  } : {
    search: 'Search the whole playlist…', channel: 'Channel', desc: 'Descriptions', remember: 'Remember open or closed', rescan: 'Rescan',
    open: 'Search this playlist', close: 'Hide the search box',
    idle: 'Start typing to scan the playlist', scanning: (n) => `Scanning… ${n} videos`, error: (e) => `Could not read the playlist (${e})`, ready: (n, o) => `${n} videos · ${o}`,
    cached: 'cached', fresh: 'just scanned', cachedUnchecked: 'cached (could not check for changes)',
    descInfo: (a, b, f) => `Descriptions: ${a} of ${b}${f ? ` (${f} unavailable)` : ''}`, stopped: ' · stopped: YouTube is not answering',
    noTitle: '(no title)', nothingYet: 'Nothing yet…', noResults: 'No results', results: (n) => `${n} results`, tooMany: (n, m) => `${n} results; showing ${m}. Narrow your search.`,
  };

  // ---------- helpers ----------
  const cfg = (k) => window.ytcfg?.get?.(k) ?? window.ytcfg?.data_?.[k];
  const norm = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const text = (x) => x?.simpleText ?? x?.runs?.map((r) => r.text).join('') ?? x?.content ?? '';
  const cookie = (n) => {
    const m = document.cookie.match(new RegExp('(?:^|; )' + n.replace(/[-.]/g, '\\$&') + '=([^;]*)'));
    return m ? m[1] : null;
  };

  async function sha1(s) {
    const b = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(s));
    return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
  }

  // The header YouTube's own site signs its requests with when you are signed in.
  // Without it, private playlists (Liked videos) are not returned.
  async function authorization() {
    const ts = Math.floor(Date.now() / 1000);
    const parts = [];
    for (const [name, ck] of [['SAPISIDHASH', 'SAPISID'], ['SAPISID1PHASH', '__Secure-1PAPISID'], ['SAPISID3PHASH', '__Secure-3PAPISID']]) {
      const v = cookie(ck) || (name === 'SAPISIDHASH' ? cookie('__Secure-3PAPISID') : null);
      if (v) parts.push(`${name} ${ts}_${await sha1(`${ts} ${v} ${location.origin}`)}`);
    }
    return parts.join(' ');
  }

  async function api(endpoint, body) {
    const headers = { 'Content-Type': 'application/json', 'X-Origin': location.origin };
    const auth = await authorization();
    if (auth) {
      headers.Authorization = auth;
      headers['X-Goog-AuthUser'] = String(cfg('SESSION_INDEX') ?? 0);
      if (cfg('DELEGATED_SESSION_ID')) headers['X-Goog-PageId'] = cfg('DELEGATED_SESSION_ID');
    }
    if (cfg('INNERTUBE_CONTEXT_CLIENT_NAME')) headers['X-Youtube-Client-Name'] = String(cfg('INNERTUBE_CONTEXT_CLIENT_NAME'));
    if (cfg('INNERTUBE_CONTEXT_CLIENT_VERSION')) headers['X-Youtube-Client-Version'] = cfg('INNERTUBE_CONTEXT_CLIENT_VERSION');
    if (cfg('VISITOR_DATA')) headers['X-Goog-Visitor-Id'] = cfg('VISITOR_DATA');
    const r = await fetch(`/youtubei/v1/${endpoint}?prettyPrint=false`, {
      method: 'POST', credentials: 'same-origin', headers,
      body: JSON.stringify({ context: cfg('INNERTUBE_CONTEXT'), ...body }),
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }

  // Returns, in document order, every value stored under `key` at any depth.
  function findAll(root, key) {
    const out = [];
    (function walk(o) {
      if (!o || typeof o !== 'object') return;
      if (Array.isArray(o)) { for (const x of o) walk(x); return; }
      for (const k in o) { if (k === key) out.push(o[k]); else walk(o[k]); }
    })(root);
    return out;
  }

  function readVideos(json) {
    const out = [];
    // Classic response format.
    for (const r of findAll(json, 'playlistVideoRenderer')) {
      if (r.videoId) out.push({ id: r.videoId, t: text(r.title), c: text(r.shortBylineText), d: text(r.lengthText), n: text(r.index) });
    }
    if (out.length) return out;
    // Newer response format.
    for (const r of findAll(json, 'lockupViewModel')) {
      if (!r.contentId || (r.contentType && !/VIDEO/.test(r.contentType))) continue;
      const meta = r.metadata?.lockupMetadataViewModel;
      const parts = findAll(meta?.metadata, 'metadataParts')[0] || [];
      const dur = findAll(r.contentImage, 'text').map((x) => (typeof x === 'string' ? x : text(x))).find((x) => /^\d+(:\d\d)+$/.test(x));
      out.push({ id: r.contentId, t: text(meta?.title), c: text(parts[0]?.text), d: dur || '', n: '' });
    }
    return out;
  }

  // The right continuation is the one sitting in the same array as the videos; the page
  // carries others (e.g. for recommendation sections) that must not be followed.
  function nextToken(json) {
    let token = null;
    (function walk(o) {
      if (token || !o || typeof o !== 'object') return;
      if (Array.isArray(o) && o.some((x) => x && (x.playlistVideoRenderer || x.lockupViewModel))) {
        for (const x of o) {
          const c = x && (x.continuationItemRenderer || x.continuationItemViewModel);
          const t = c && findAll(c, 'token').find((v) => typeof v === 'string');
          if (t) { token = t; return; }
        }
        return;
      }
      for (const k in o) walk(o[k]);
    })(json);
    return token;
  }

  // One video's description. `player` is light but YouTube sometimes refuses it; `next` is heavier and usually answers.
  let playerFailures = 0;
  async function fetchDescription(id) {
    if (playerFailures < 3) {
      const d = (await api('player', { videoId: id }))?.videoDetails?.shortDescription;
      if (typeof d === 'string') { playerFailures = 0; return d; }
      playerFailures++;
    }
    const j = await api('next', { videoId: id });
    const a = findAll(j, 'attributedDescriptionBodyText')[0] ?? findAll(j, 'attributedDescription')[0] ?? findAll(j, 'descriptionBodyText')[0];
    if (a) return text(a);
    return findAll(j, 'structuredDescriptionContentRenderer').length ? '' : null;
  }

  // ---------- cache (IndexedDB) ----------
  let dbPromise;
  const openDb = () => (dbPromise ??= new Promise((res, rej) => {
    const r = indexedDB.open('yt-playlist-search', 1);
    r.onupgradeneeded = () => { r.result.createObjectStore('lists'); r.result.createObjectStore('desc'); };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  }));
  async function tx(store, mode, fn) {
    try {
      const d = await openDb();
      return await new Promise((res, rej) => {
        const t = d.transaction(store, mode);
        const out = fn(t.objectStore(store));
        t.oncomplete = () => res(out?.result ?? out);
        t.onerror = t.onabort = () => rej(t.error);
      });
    } catch (e) { return undefined; } // it keeps working without a cache
  }
  const loadList = (k) => tx('lists', 'readonly', (s) => s.get(k));
  const saveList = (k, v) => tx('lists', 'readwrite', (s) => s.put(v, k));
  const saveDesc = (id, v) => tx('desc', 'readwrite', (s) => s.put(v, id));
  const loadDescs = (ids) => tx('desc', 'readonly', (s) => {
    const m = new Map();
    for (const id of ids) { const r = s.get(id); r.onsuccess = () => { if (r.result !== undefined) m.set(id, r.result); }; }
    return m;
  });

  // ---------- state ----------
  const S = { list: null, videos: [], phase: 'idle', run: 0, source: '', error: '', desc: new Map(), descNorm: new Map(), descRun: 0, descInfo: '' };
  const prefs = (() => { try { return JSON.parse(localStorage.getItem('ytPlaylistSearch') || '{}'); } catch (e) { return {}; } })();
  const savePrefs = () => { try { localStorage.setItem('ytPlaylistSearch', JSON.stringify(prefs)); } catch (e) {} };
  const cacheKey = () => `${cfg('DATASYNC_ID') || cfg('DELEGATED_SESSION_ID') || ''}:${S.list}`;
  const fingerprint = (json, videos) => text(findAll(json, 'numVideosText')[0]) + '|' + videos.map((v) => v.id).join(',');
  const prepare = (vs) => { vs.forEach((v, i) => { v.k = norm(v.t); v.kc = norm(v.c); if (!v.n) v.n = String(i + 1); }); return vs; };

  async function scan(force) {
    const run = ++S.run;
    const alive = () => run === S.run;
    S.phase = 'scanning'; S.error = ''; S.videos = []; render();
    const cache = await loadList(cacheKey());
    if (!alive()) return;
    try {
      let json = await api('browse', { browseId: 'VL' + S.list });
      if (!alive()) return;
      let page = readVideos(json);
      const fp = fingerprint(json, page);
      // Unchanged first page: reuse the cached list instead of fetching it all again.
      if (!force && cache && cache.fingerprint === fp) {
        S.videos = prepare(cache.videos); S.phase = 'ready'; S.source = T.cached; render();
        if (prefs.desc) loadDescriptions();
        return;
      }
      const all = [], seen = new Set();
      for (;;) {
        all.push(...page);
        S.videos = prepare(all); render();
        const token = nextToken(json);
        if (!token || seen.has(token) || !page.length) break;
        seen.add(token);
        json = await api('browse', { continuation: token });
        if (!alive()) return;
        page = readVideos(json);
      }
      S.phase = 'ready'; S.source = T.fresh;
      if (all.length) saveList(cacheKey(), { fingerprint: fp, date: Date.now(), videos: all.map(({ id, t, c, d, n }) => ({ id, t, c, d, n })) });
    } catch (e) {
      if (!alive()) return;
      if (cache && !S.videos.length) { S.videos = prepare(cache.videos); S.source = T.cachedUnchecked; S.phase = 'ready'; } else { S.phase = 'error'; S.error = String(e.message || e); }
    }
    render();
    if (prefs.desc && S.phase === 'ready') loadDescriptions();
  }

  // Descriptions are not part of the playlist data: each video needs its own request. They are kept forever.
  async function loadDescriptions() {
    const run = ++S.descRun;
    const alive = () => run === S.descRun && prefs.desc;
    const ids = [...new Set(S.videos.map((v) => v.id))];
    const stored = await loadDescs(ids);
    if (stored) for (const [id, d] of stored) if (!S.desc.has(id)) { S.desc.set(id, d); S.descNorm.set(id, norm(d)); }
    const missing = ids.filter((id) => !S.desc.has(id));
    let done = 0, failed = 0, streak = 0;
    const report = () => { S.descInfo = T.descInfo(ids.length - missing.length + done, ids.length, failed); render(); };
    report();
    let i = 0;
    const worker = async () => {
      while (alive() && i < missing.length && streak < 15) {
        const id = missing[i++];
        try {
          const d = await fetchDescription(id);
          if (typeof d === 'string') { S.desc.set(id, d); S.descNorm.set(id, norm(d)); saveDesc(id, d); done++; streak = 0; } else { failed++; streak++; }
        } catch (e) { failed++; streak++; }
        if ((done + failed) % 10 === 0) report();
      }
    };
    await Promise.all(Array.from({ length: DESC_PARALLEL }, worker));
    if (run !== S.descRun) return;
    report();
    if (streak >= 15) { S.descInfo += T.stopped; render(); }
  }

  // ---------- UI ----------
  const host = document.createElement('div');
  host.id = 'yt-playlist-search';
  host.style.cssText = 'position:fixed;top:64px;right:0;z-index:2100;display:none';
  const shadow = host.attachShadow({ mode: 'open' });
  const el = (tag, props, ...children) => { const n = Object.assign(document.createElement(tag), props || {}); n.append(...children); return n; };
  const style = el('style', { textContent: `
    :host{all:initial}
    [hidden]{display:none!important}
    .tab,.head button{font-size:16px;line-height:1;height:36px;width:26px;padding:0;flex:none}
    /* The tab sits at the same height as the hide button: 8px padding + 1px border of the box. */
    .tab{display:block;margin-top:9px;border-right:0;border-radius:8px 0 0 8px;color:var(--yt-spec-text-primary,#0f0f0f);background:var(--yt-spec-base-background,#fff);box-shadow:0 2px 8px rgba(0,0,0,.3);transition:opacity .18s ease,visibility 0s}
    .tab.off{opacity:0;visibility:hidden;pointer-events:none;transition:opacity .18s ease,visibility 0s .18s}
    .head{display:flex;gap:6px}
    .head input{height:36px}
    .box{position:absolute;top:0;right:16px;transform:translateX(calc(100% + 24px));opacity:0;visibility:hidden;transition:transform .2s ease,opacity .2s ease,visibility 0s .2s}
    .box.open{transform:none;opacity:1;visibility:visible;transition:transform .2s ease,opacity .2s ease,visibility 0s}
    @media (prefers-reduced-motion:reduce){.box,.box.open,.tab,.tab.off{transition:none}}
    .box{font:14px/1.4 Roboto,Arial,sans-serif;color:var(--yt-spec-text-primary,#0f0f0f);background:var(--yt-spec-base-background,#fff);
      border:1px solid var(--yt-spec-10-percent-layer,#ccc);border-radius:10px;box-shadow:0 4px 18px rgba(0,0,0,.3);width:min(440px,calc(100vw - 32px));padding:8px}
    input[type=search]{width:100%;box-sizing:border-box;font:inherit;color:inherit;background:transparent;border:1px solid var(--yt-spec-10-percent-layer,#ccc);border-radius:8px;padding:7px 10px}
    input[type=search]:focus{outline:2px solid #3ea6ff;outline-offset:-1px}
    .row{display:flex;flex-wrap:wrap;gap:4px 12px;align-items:center;margin-top:6px;font-size:12px;color:var(--yt-spec-text-secondary,#606060)}
    .row label{display:flex;gap:4px;align-items:center;cursor:pointer}
    button{font:inherit;font-size:12px;color:inherit;background:transparent;border:1px solid var(--yt-spec-10-percent-layer,#ccc);border-radius:6px;padding:2px 8px;cursor:pointer}
    .res{max-height:min(70vh,640px);overflow:auto;margin-top:6px}
    .res:empty{display:none}
    a{display:block;padding:6px 8px;border-radius:6px;color:inherit;text-decoration:none;overflow-wrap:anywhere}
    a:hover,a:focus{background:var(--yt-spec-10-percent-layer,#eee);outline:none}
    small{display:block;color:var(--yt-spec-text-secondary,#606060)}
    .none{padding:8px;color:var(--yt-spec-text-secondary,#606060)}
  ` });
  const field = el('input', { type: 'search', placeholder: T.search });
  field.setAttribute('aria-label', T.search);
  const checkbox = (key, label, byDefault) => {
    const c = el('input', { type: 'checkbox', checked: prefs[key] ?? byDefault });
    c.onchange = () => {
      prefs[key] = c.checked; savePrefs();
      if (key === 'desc') { if (c.checked && S.phase === 'ready') loadDescriptions(); else { S.descRun++; S.descInfo = ''; } }
      render();
    };
    prefs[key] = c.checked;
    return el('label', null, c, label);
  };
  const status = el('span');
  const descStatus = el('span');
  const rescanBtn = el('button', { type: 'button', textContent: T.rescan });
  rescanBtn.onclick = () => scan(true);
  const res = el('div', { className: 'res' });
  // Collapsed by default: only a small tab peeks out at the right edge.
  const tab = el('button', { type: 'button', className: 'tab', textContent: '‹', title: T.open });
  tab.setAttribute('aria-label', T.open);
  const closeBtn = el('button', { type: 'button', textContent: '›', title: T.close });
  closeBtn.setAttribute('aria-label', T.close);
  const box = el('div', { className: 'box', inert: true }, el('div', { className: 'head' }, field, closeBtn),
    el('div', { className: 'row' }, checkbox('channel', T.channel, true), checkbox('desc', T.desc, false), checkbox('remember', T.remember, false), rescanBtn),
    el('div', { className: 'row' }, status, descStatus), res);
  shadow.append(style, tab, box);
  function show(open, byUser) {
    box.classList.toggle('open', open); box.inert = !open;
    tab.classList.toggle('off', open);
    if (byUser) { prefs.open = open; savePrefs(); if (open) field.focus(); }
  }
  tab.onclick = () => show(true, true);
  closeBtn.onclick = () => show(false, true);

  const start = () => { if (S.phase === 'idle') scan(false); };
  field.addEventListener('focus', start);
  let debounce;
  field.addEventListener('input', () => { start(); clearTimeout(debounce); debounce = setTimeout(render, 120); });
  // Keep YouTube's keyboard shortcuts from firing while typing here.
  for (const ev of ['keydown', 'keyup', 'keypress']) field.addEventListener(ev, (e) => { e.stopPropagation(); if (ev === 'keydown' && e.key === 'Escape') { field.value = ''; render(); field.blur(); } });

  function snippet(d, words) {
    const dn = norm(d);
    let pos = -1;
    for (const w of words) { pos = dn.indexOf(w); if (pos >= 0) break; }
    if (pos < 0) return '';
    const from = Math.max(0, pos - 40);
    return (from ? '…' : '') + d.slice(from, pos + 80).replace(/\s+/g, ' ') + '…';
  }

  function render() {
    const n = S.videos.length;
    status.textContent = S.phase === 'idle' ? T.idle
      : S.phase === 'scanning' ? T.scanning(n)
      : S.phase === 'error' ? T.error(S.error)
      : T.ready(n, S.source);
    descStatus.textContent = prefs.desc ? S.descInfo : '';
    rescanBtn.hidden = S.phase === 'idle' || S.phase === 'scanning';
    const words = norm(field.value).split(/\s+/).filter(Boolean);
    res.replaceChildren();
    if (!words.length || !n) return;
    const inTitle = (v) => words.every((w) => v.k.includes(w) || (prefs.channel && v.kc.includes(w)));
    const found = [];
    for (const v of S.videos) {
      const dn = prefs.desc ? S.descNorm.get(v.id) || '' : '';
      if (words.every((w) => v.k.includes(w) || (prefs.channel && v.kc.includes(w)) || (dn && dn.includes(w)))) found.push(v);
    }
    if (!found.length) { res.append(el('div', { className: 'none', textContent: S.phase === 'scanning' ? T.nothingYet : T.noResults })); return; }
    for (const v of found.slice(0, MAX_SHOWN)) {
      const a = el('a', { href: `/watch?v=${encodeURIComponent(v.id)}&list=${encodeURIComponent(S.list)}`, textContent: v.t || T.noTitle });
      a.append(el('small', { textContent: [v.n && '#' + v.n, v.c, v.d].filter(Boolean).join(' · ') }));
      if (prefs.desc && !inTitle(v)) {
        const s = snippet(S.desc.get(v.id) || '', words);
        if (s) a.append(el('small', { textContent: s }));
      }
      res.append(a);
    }
    res.append(el('div', { className: 'none', textContent: found.length > MAX_SHOWN ? T.tooMany(found.length, MAX_SHOWN) : T.results(found.length) }));
  }

  // ---------- follow YouTube's in-page navigation ----------
  function checkPage() {
    const list = location.pathname === '/playlist' ? new URLSearchParams(location.search).get('list') : null;
    if (list === S.list) return;
    S.run++; S.descRun++;
    Object.assign(S, { list, videos: [], phase: 'idle', source: '', error: '', descInfo: '' });
    field.value = '';
    show(!!(prefs.remember && prefs.open), false);
    host.style.display = list ? '' : 'none';
    if (list && !host.isConnected) document.documentElement.append(host);
    render();
  }
  window.addEventListener('yt-navigate-finish', checkPage);
  window.addEventListener('popstate', checkPage);
  setInterval(checkPage, 1000);
  checkPage();
})();
