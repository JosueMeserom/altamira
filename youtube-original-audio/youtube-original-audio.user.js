// ==UserScript==
// @name         YouTube Original Audio
// @name:es      Audio original en YouTube
// @namespace    https://github.com/JosueMeserom/altamira
// @version      0.1.1
// @description  Always play the original audio track on YouTube, never a dub (AI auto-dubs or creator-uploaded ones). Switches before the video starts, so nothing restarts.
// @description:es  Reproduce siempre la pista de audio original en YouTube, nunca un doblaje (ni automático ni subido por el creador). Cambia antes de que empiece el vídeo, así que nada se reinicia.
// @author       JosueMeserom
// @license      MIT
// @homepageURL  https://github.com/JosueMeserom/altamira
// @supportURL   https://github.com/JosueMeserom/altamira/issues
// @downloadURL  https://raw.githubusercontent.com/JosueMeserom/altamira/main/youtube-original-audio/youtube-original-audio.user.js
// @updateURL    https://raw.githubusercontent.com/JosueMeserom/altamira/main/youtube-original-audio/youtube-original-audio.user.js
// @match        https://www.youtube.com/*
// @match        https://www.youtube-nocookie.com/embed/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

// How it works: YouTube's player picks a dub as the default track when your language
// differs from the video's. As soon as the player receives a new video (before the first
// frame plays) this script asks it, through its own API, to use the track tagged as the
// original. There is no network request and no page reload, so loading is not slowed down.
// It only acts at the start of each new video: if you pick another track by hand, it stays
// until the next one, even if you go back to the beginning or the video loops.
(() => {
  'use strict';
  if (window.__ytOriginalAudio) return;
  window.__ytOriginalAudio = true;

  // Seconds of playback, counted from when each new video first plays (wherever it starts,
  // e.g. &t=120), during which the script keeps the original track. YouTube may re-apply its
  // default once or twice while the video loads; after this, hands off until the next video.
  const GUARD_SECONDS = 1.5;

  // Track ids look like "251;<base64 tags>", where the tags include acont=original or
  // acont=dubbed / dubbed-auto. Decode the tags and look for the original marker.
  function isOriginal(track) {
    const tags = String(track?.id || '').split(';')[1];
    if (!tags) return false;
    try {
      const b64 = tags.replace(/-/g, '+').replace(/_/g, '/');
      return /acont[\s\S]{1,4}original/.test(atob(b64.padEnd(Math.ceil(b64.length / 4) * 4, '=')));
    } catch (e) {
      return false;
    }
  }

  function enforce(player) {
    const tracks = player.getAvailableAudioTracks?.() || [];
    if (tracks.length < 2) return;
    const current = player.getAudioTrack?.();
    if (!current || isOriginal(current)) return;
    const original = tracks.find(isOriginal);
    if (original) player.setAudioTrack(original);
  }

  const watched = new WeakSet();
  function attach(player) {
    if (watched.has(player) || typeof player.addEventListener !== 'function' || typeof player.setAudioTrack !== 'function') return;
    watched.add(player);
    // The guard window belongs to a video id, so seeking back or looping the same video
    // does not reopen it, and an ad before the video does not use it up.
    let videoId, armed = false, timer = 0;
    const check = () => {
      const id = player.getVideoData?.()?.video_id;
      if (id !== videoId) { videoId = id; armed = true; clearTimeout(timer); timer = 0; }
      if (armed) enforce(player);
    };
    player.addEventListener('onVideoDataChange', check);
    // -1 unstarted, 3 buffering, 1 playing: the moments where the default track gets applied.
    player.addEventListener('onStateChange', (s) => {
      if (s === -1 || s === 3 || s === 1) check();
      if (s === 1 && armed && !timer) timer = setTimeout(() => { armed = false; }, GUARD_SECONDS * 1000);
    });
    check();
  }

  // The player elements are created (and on Shorts, replaced) by YouTube at any time.
  const SELECTOR = '#movie_player, #shorts-player, .html5-video-player';
  function scan() {
    queued = false;
    for (const p of document.querySelectorAll(SELECTOR)) attach(p);
  }
  // YouTube's page changes constantly: look at most once every 50 ms, not on every change.
  let queued = false;
  new MutationObserver(() => { if (!queued) { queued = true; setTimeout(scan, 50); } })
    .observe(document, { childList: true, subtree: true });
  scan();
})();
