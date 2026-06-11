/**
 * DJ Decks — Interactive turntables for Yaan's music page
 * Features: spinning vinyl, crossfader, BPM detection, beat sync
 */
(function() {
  'use strict';

  const DJ_TRACKS = [
    { title: 'Eastwick',    artist: 'Kainer',    src: '/music/tracks/Kainer_-_Eastwick__Original_Mix_.mp3',    cover: '/music/eastwick.png' },
    { title: 'Keplar 8',    artist: 'Kainer',    src: '/music/tracks/Kainer_-_Keplar_8__Original_Mix_.mp3',    cover: '/music/keplar-8.png' },
    { title: 'Klockwerk',   artist: 'Kainer',    src: '/music/tracks/Kainer_-_Klockwerk_ALPHA_4.mp3',          cover: '/music/klockwerk.png' },
    { title: 'Mandalin',    artist: 'Kainer',    src: '/music/tracks/Kainer_-_Mandalin__Original_Mix_.mp3',    cover: '/music/mandalin.png' },
    { title: 'Neon',        artist: 'Kainer',    src: '/music/tracks/Kainer_-_Neon__Original_Mix_.mp3',        cover: '/music/neon.png' },
    { title: 'Orange',      artist: 'Kainer',    src: '/music/tracks/Kainer_-_Orange__Original_Mix_.mp3',      cover: '/music/orange.png' },
    { title: 'Rasp',        artist: 'Kainer',    src: '/music/tracks/Kainer_-_Rasp__Original_Mix_.mp3',        cover: '/music/rasp.png' },
    { title: 'Hey Cousin',  artist: 'Il Diablo', src: '/music/tracks/Il_Diablo_-_Hey_Cousin___Original_Mix_.mp3',  cover: '/music/hey-cousin.png' },
    { title: 'Factor 666',  artist: 'Il Diablo', src: '/music/tracks/Il_Diablo_-_Factor_666__Original_Mix__thejackal996_hotmail__1_.co.uk.mp3', cover: '/music/factor-666.png' },
    { title: 'La Habana',   artist: 'Il Diablo', src: '/music/tracks/Il_Diablo_-_La_Habana__Original_Mix_.mp3',  cover: '/music/la-habana.png' },
    { title: 'Kerb Diver',  artist: 'Il Diablo', src: '/music/tracks/Il-Diablo_-_Kerb_Diver__Original_Mix_.mp3', cover: '/music/kerb-diver.png' },
  ];

  let audioCtx = null;
  const decks = {
    a: { audio: null, gain: null, source: null, playing: false, trackIdx: -1, bpm: null, analyser: null, audioBuffer: null, beatPhase: 0 },
    b: { audio: null, gain: null, source: null, playing: false, trackIdx: -1, bpm: null, analyser: null, audioBuffer: null, beatPhase: 0 },
  };
  let crossfaderValue = 0.5;
  let syncEnabled = false;
  let masterDeck = null; // which deck is the tempo master

  function ensureAudioCtx() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
  }

  // ─── BPM DETECTION ─────────────────────────────────────────────────────────
  // Uses onset detection on decoded audio buffer
  function detectBPM(audioBuffer) {
    return new Promise(function(resolve) {
      try {
        // Use first channel, analyse ~30 seconds from 10s in
        var raw = audioBuffer.getChannelData(0);
        var sr = audioBuffer.sampleRate;
        var startSample = Math.min(10 * sr, raw.length - 1);
        var endSample = Math.min(startSample + 30 * sr, raw.length);
        var data = raw.slice(startSample, endSample);

        // Compute energy in windows
        var winSize = Math.floor(sr * 0.01); // 10ms windows
        var hop = Math.floor(winSize / 2);
        var energies = [];
        for (var i = 0; i + winSize < data.length; i += hop) {
          var sum = 0;
          for (var j = 0; j < winSize; j++) {
            sum += data[i + j] * data[i + j];
          }
          energies.push(sum / winSize);
        }

        // Find onsets (energy peaks above local average)
        var onsets = [];
        var avgWin = 40;
        for (var k = avgWin; k < energies.length - avgWin; k++) {
          var localAvg = 0;
          for (var m = k - avgWin; m < k + avgWin; m++) localAvg += energies[m];
          localAvg /= (avgWin * 2);
          if (energies[k] > localAvg * 1.5 && energies[k] > energies[k-1] && energies[k] >= energies[k+1]) {
            onsets.push(k);
          }
        }

        // Convert onset indices to time intervals
        var intervals = [];
        for (var n = 1; n < onsets.length; n++) {
          var dt = (onsets[n] - onsets[n-1]) * hop / sr;
          if (dt > 0.2 && dt < 2.0) { // 30-300 BPM range
            intervals.push(dt);
          }
        }

        if (intervals.length < 4) { resolve(128); return; } // fallback

        // Histogram approach — bin intervals and find the mode
        var bins = {};
        for (var p = 0; p < intervals.length; p++) {
          var bpm = Math.round(60 / intervals[p]);
          // Normalise to 60-180 range
          while (bpm > 180) bpm = Math.round(bpm / 2);
          while (bpm < 60) bpm = bpm * 2;
          var key = Math.round(bpm);
          bins[key] = (bins[key] || 0) + 1;
        }

        var bestBPM = 128, bestCount = 0;
        for (var b in bins) {
          // Also count neighbors ±2 BPM
          var count = bins[b];
          for (var nb = -2; nb <= 2; nb++) {
            if (nb !== 0 && bins[parseInt(b) + nb]) count += bins[parseInt(b) + nb] * 0.5;
          }
          if (count > bestCount) {
            bestCount = count;
            bestBPM = parseInt(b);
          }
        }

        resolve(bestBPM);
      } catch(e) {
        resolve(128);
      }
    });
  }

  // ─── BEAT SYNC ─────────────────────────────────────────────────────────────
  // Adjusts playback rate of slave deck to match master's BPM
  function applySyncRate() {
    if (!syncEnabled || !masterDeck) return;

    var slave = masterDeck === 'a' ? 'b' : 'a';
    var mDeck = decks[masterDeck];
    var sDeck = decks[slave];

    if (!mDeck.bpm || !sDeck.bpm || !sDeck.audio) return;

    // Adjust slave's playback rate to match master's BPM
    var ratio = mDeck.bpm / sDeck.bpm;
    // Keep ratio reasonable (0.8 - 1.25 range)
    if (ratio > 1.25) ratio = ratio / 2;
    if (ratio < 0.8) ratio = ratio * 2;
    sDeck.audio.playbackRate = ratio;

    // Update vinyl spin speed to match
    var vinyl = document.querySelector('#deck-' + slave + ' .vinyl-record');
    if (vinyl && vinyl.classList.contains('spinning')) {
      vinyl.style.animationDuration = (1.8 / ratio) + 's';
    }
  }

  // Beat-align: snap slave to nearest beat boundary of master
  function beatAlign() {
    if (!syncEnabled || !masterDeck) return;

    var slave = masterDeck === 'a' ? 'b' : 'a';
    var mDeck = decks[masterDeck];
    var sDeck = decks[slave];

    if (!mDeck.bpm || !sDeck.audio || !mDeck.audio || !mDeck.playing) return;

    // Master's beat phase: how far into the current beat
    var masterBeatLen = 60 / mDeck.bpm;
    var masterPhase = (mDeck.audio.currentTime % masterBeatLen) / masterBeatLen;

    // Calculate where slave should be to be in phase
    var slaveBeatLen = 60 / sDeck.bpm;
    var slaveTargetPhase = masterPhase;
    var slaveCurrentPhase = (sDeck.audio.currentTime % slaveBeatLen) / slaveBeatLen;
    var phaseDiff = slaveTargetPhase - slaveCurrentPhase;

    // Small correction — nudge if off by more than 10% of a beat
    if (Math.abs(phaseDiff) > 0.1 && Math.abs(phaseDiff) < 0.9) {
      sDeck.audio.currentTime += phaseDiff * slaveBeatLen;
    }
  }

  function createDeckAudio(deckKey) {
    ensureAudioCtx();
    var deck = decks[deckKey];
    if (deck.audio) {
      deck.audio.pause();
      deck.audio.src = '';
      if (deck.source) try { deck.source.disconnect(); } catch(e) {}
    }
    deck.audio = new Audio();
    deck.audio.crossOrigin = 'anonymous';
    deck.gain = audioCtx.createGain();
    deck.analyser = audioCtx.createAnalyser();
    deck.analyser.fftSize = 256;
    deck.gain.connect(audioCtx.destination);
    deck.audio.addEventListener('loadeddata', function() {
      try {
        deck.source = audioCtx.createMediaElementSource(deck.audio);
        deck.source.connect(deck.analyser);
        deck.analyser.connect(deck.gain);
      } catch(e) {}
    });
    deck.audio.addEventListener('ended', function() {
      deck.playing = false;
      updateDeckUI(deckKey);
    });
    deck.audio.addEventListener('timeupdate', function() { updateDeckProgress(deckKey); });
    updateCrossfade();
  }

  function loadTrack(deckKey, trackIdx) {
    var deck = decks[deckKey];
    deck.trackIdx = trackIdx;
    deck.playing = false;
    deck.bpm = null;
    deck.audio && deck.audio.pause();
    createDeckAudio(deckKey);
    deck.audio.src = DJ_TRACKS[trackIdx].src;
    deck.audio.load();
    updateDeckUI(deckKey);

    // Detect BPM from the audio file
    var bpmLabel = document.querySelector('#deck-' + deckKey + ' .deck-bpm');
    if (bpmLabel) bpmLabel.textContent = 'Analysing...';

    fetch(DJ_TRACKS[trackIdx].src)
      .then(function(r) { return r.arrayBuffer(); })
      .then(function(buf) { return audioCtx.decodeAudioData(buf); })
      .then(function(decoded) {
        deck.audioBuffer = decoded;
        return detectBPM(decoded);
      })
      .then(function(bpm) {
        deck.bpm = bpm;
        if (bpmLabel) bpmLabel.textContent = bpm + ' BPM';
        applySyncRate();
      })
      .catch(function() {
        deck.bpm = 128;
        if (bpmLabel) bpmLabel.textContent = '~128 BPM';
      });
  }

  function togglePlay(deckKey) {
    ensureAudioCtx();
    var deck = decks[deckKey];
    if (deck.trackIdx < 0) return;
    if (deck.playing) {
      deck.audio.pause();
      deck.playing = false;
    } else {
      deck.audio.play().catch(function(){});
      deck.playing = true;
      // Auto-set master deck to first one that plays
      if (!masterDeck || !decks[masterDeck].playing) {
        masterDeck = deckKey;
        updateSyncUI();
      }
      if (syncEnabled) {
        applySyncRate();
        // Slight delay then beat-align
        setTimeout(function() { beatAlign(); }, 200);
      }
    }
    updateDeckUI(deckKey);
    startVUMeters();
  }

  function updateCrossfade() {
    var a = Math.cos(crossfaderValue * Math.PI / 2);
    var b = Math.sin(crossfaderValue * Math.PI / 2);
    if (decks.a.gain) decks.a.gain.gain.value = a;
    if (decks.b.gain) decks.b.gain.gain.value = b;
  }

  function updateDeckUI(deckKey) {
    var deck = decks[deckKey];
    var el = document.getElementById('deck-' + deckKey);
    if (!el) return;

    var playBtn = el.querySelector('.deck-play');
    var trackLabel = el.querySelector('.deck-track-label');
    var vinyl = el.querySelector('.vinyl-record');

    if (deck.trackIdx >= 0) {
      var t = DJ_TRACKS[deck.trackIdx];
      trackLabel.textContent = t.artist + ' — ' + t.title;
      var labelEl = el.querySelector('.vinyl-label-img');
      if (labelEl) labelEl.style.backgroundImage = 'url(' + t.cover + ')';
    } else {
      trackLabel.textContent = 'No track loaded';
    }

    playBtn.textContent = deck.playing ? '⏸' : '▶';
    playBtn.classList.toggle('active', deck.playing);

    if (deck.playing) {
      vinyl.classList.add('spinning');
      // Reset speed if not syncing
      if (!syncEnabled) vinyl.style.animationDuration = '1.8s';
    } else {
      vinyl.classList.remove('spinning');
    }
  }

  function updateDeckProgress(deckKey) {
    var deck = decks[deckKey];
    var el = document.getElementById('deck-' + deckKey);
    if (!el || !deck.audio) return;

    var cur = el.querySelector('.deck-time-cur');
    var dur = el.querySelector('.deck-time-dur');
    var fill = el.querySelector('.deck-progress-fill');

    if (deck.audio.duration) {
      var pct = (deck.audio.currentTime / deck.audio.duration) * 100;
      fill.style.width = pct + '%';
      cur.textContent = fmt(deck.audio.currentTime);
      dur.textContent = fmt(deck.audio.duration);
    }
  }

  // ─── VU METERS (real audio analysis) ─────────────────────────────────────
  var vuRunning = false;
  function startVUMeters() {
    if (vuRunning) return;
    vuRunning = true;
    animateVU();
  }

  function animateVU() {
    updateMeter('a', 'meter-a');
    updateMeter('b', 'meter-b');
    if (decks.a.playing || decks.b.playing) {
      requestAnimationFrame(animateVU);
    } else {
      vuRunning = false;
      // Reset meters
      var ma = document.getElementById('meter-a');
      var mb = document.getElementById('meter-b');
      if (ma) ma.style.height = '5%';
      if (mb) mb.style.height = '5%';
    }
  }

  function updateMeter(deckKey, meterId) {
    var deck = decks[deckKey];
    var meterEl = document.getElementById(meterId);
    if (!meterEl || !deck.analyser || !deck.playing) {
      if (meterEl) meterEl.style.height = '5%';
      return;
    }
    var data = new Uint8Array(deck.analyser.frequencyBinCount);
    deck.analyser.getByteFrequencyData(data);
    var sum = 0;
    for (var i = 0; i < data.length; i++) sum += data[i];
    var avg = sum / data.length;
    var pct = Math.min(95, (avg / 255) * 120); // boost a bit for visual
    meterEl.style.height = Math.max(5, pct) + '%';
  }

  function updateSyncUI() {
    var syncBtn = document.getElementById('sync-btn');
    if (!syncBtn) return;
    syncBtn.classList.toggle('active', syncEnabled);
    syncBtn.textContent = syncEnabled ? '🔗 SYNC ON' : '🔗 SYNC';

    var masterLabel = document.getElementById('sync-master');
    if (masterLabel) {
      masterLabel.textContent = syncEnabled && masterDeck ? 'Master: Deck ' + masterDeck.toUpperCase() : '';
    }
  }

  function fmt(s) {
    if (isNaN(s)) return '0:00';
    return Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
  }

  // ─── BUILD UI ──────────────────────────────────────────────────────────────
  function buildDecks() {
    var container = document.getElementById('dj-decks-mount');
    if (!container) return;

    var opts = DJ_TRACKS.map(function(t, i) {
      return '<option value="' + i + '">' + t.artist + ' — ' + t.title + '</option>';
    }).join('');

    container.innerHTML =
      '<div class="dj-decks">' +
        '<div class="dj-header">' +
          '<div class="dj-brand">🎛️ YAAN\'S DECKS</div>' +
          '<div class="dj-sub">Load tracks · Hit play · Crossfade between decks</div>' +
        '</div>' +

        '<div class="dj-table">' +
          buildDeckHTML('a', opts) +

          '<div class="dj-mixer">' +
            '<div class="mixer-label">MIX</div>' +
            '<div class="mixer-meters">' +
              '<div class="meter"><div class="meter-fill" id="meter-a"></div></div>' +
              '<div class="meter"><div class="meter-fill" id="meter-b"></div></div>' +
            '</div>' +
            '<div class="sync-controls">' +
              '<button class="sync-btn" id="sync-btn">🔗 SYNC</button>' +
              '<div class="sync-master" id="sync-master"></div>' +
            '</div>' +
            '<div class="mixer-knobs">' +
              '<div class="knob-group">' +
                '<div class="knob-label">EQ</div>' +
                '<div class="knob"></div>' +
                '<div class="knob"></div>' +
                '<div class="knob"></div>' +
              '</div>' +
            '</div>' +
            '<div class="crossfader-wrap">' +
              '<span class="cf-label">A</span>' +
              '<input type="range" min="0" max="100" value="50" class="crossfader" id="crossfader">' +
              '<span class="cf-label">B</span>' +
            '</div>' +
          '</div>' +

          buildDeckHTML('b', opts) +
        '</div>' +
      '</div>';

    // Event listeners
    document.querySelectorAll('.deck-select').forEach(function(sel) {
      sel.addEventListener('change', function(e) {
        var deckKey = e.target.dataset.deck;
        var idx = parseInt(e.target.value);
        if (idx >= 0) loadTrack(deckKey, idx);
      });
    });

    document.querySelectorAll('.deck-play').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        togglePlay(e.target.dataset.deck);
      });
    });

    document.getElementById('crossfader').addEventListener('input', function(e) {
      crossfaderValue = parseInt(e.target.value) / 100;
      updateCrossfade();
    });

    document.getElementById('sync-btn').addEventListener('click', function() {
      syncEnabled = !syncEnabled;
      if (syncEnabled) {
        // Determine master: whichever is currently playing, or deck A
        if (decks.a.playing) masterDeck = 'a';
        else if (decks.b.playing) masterDeck = 'b';
        else masterDeck = 'a';
        applySyncRate();
        setTimeout(function() { beatAlign(); }, 100);
      } else {
        // Reset playback rates
        if (decks.a.audio) decks.a.audio.playbackRate = 1;
        if (decks.b.audio) decks.b.audio.playbackRate = 1;
        var vinylA = document.querySelector('#deck-a .vinyl-record');
        var vinylB = document.querySelector('#deck-b .vinyl-record');
        if (vinylA) vinylA.style.animationDuration = '1.8s';
        if (vinylB) vinylB.style.animationDuration = '1.8s';
      }
      updateSyncUI();
    });

    // Progress bar seeking
    document.querySelectorAll('.deck-progress-bar').forEach(function(bar) {
      bar.addEventListener('click', function(e) {
        var deckEl = e.target.closest('.dj-deck');
        var deckKey = deckEl.id.replace('deck-', '');
        var deck = decks[deckKey];
        if (!deck.audio || !deck.audio.duration) return;
        var rect = bar.getBoundingClientRect();
        var pct = (e.clientX - rect.left) / rect.width;
        deck.audio.currentTime = pct * deck.audio.duration;
      });
    });
  }

  function buildDeckHTML(key, opts) {
    return (
      '<div class="dj-deck" id="deck-' + key + '">' +
        '<div class="deck-label">DECK ' + key.toUpperCase() + '</div>' +
        '<div class="vinyl-turntable">' +
          '<div class="platter">' +
            '<div class="platter-dots"></div>' +
            '<div class="vinyl-record">' +
              '<div class="vinyl-grooves"></div>' +
              '<div class="vinyl-grooves g2"></div>' +
              '<div class="vinyl-grooves g3"></div>' +
              '<div class="vinyl-label">' +
                '<div class="vinyl-label-img"></div>' +
              '</div>' +
              '<div class="vinyl-shine"></div>' +
            '</div>' +
          '</div>' +
          '<div class="tonearm">' +
            '<div class="tonearm-base"></div>' +
            '<div class="tonearm-arm"></div>' +
            '<div class="tonearm-head"></div>' +
          '</div>' +
        '</div>' +
        '<div class="deck-controls">' +
          '<select class="deck-select" data-deck="' + key + '">' +
            '<option value="-1">— Load Track —</option>' +
            opts +
          '</select>' +
          '<div class="deck-transport">' +
            '<button class="deck-play" data-deck="' + key + '">▶</button>' +
            '<span class="deck-bpm">—</span>' +
          '</div>' +
          '<div class="deck-track-label">No track loaded</div>' +
          '<div class="deck-progress">' +
            '<span class="deck-time-cur">0:00</span>' +
            '<div class="deck-progress-bar"><div class="deck-progress-fill"></div></div>' +
            '<span class="deck-time-dur">0:00</span>' +
          '</div>' +
        '</div>' +
      '</div>'
    );
  }

  // ─── INIT ──────────────────────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', buildDecks);
  } else {
    buildDecks();
  }
})();
