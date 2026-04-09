/* ============================================
   BURBZ - Bird Fighter Collection
   Core Game Engine
   ============================================ */

(function () {
    'use strict';

    // ---- BIRD EMOJI MAP ----
    const BIRD_EMOJI = {
        robin_eu: '\u{1F426}', peregrine: '\u{1F985}', blue_tit: '\u{1F426}',
        golden_eagle: '\u{1F985}', crow_carrion: '\u{1F426}\u200D\u2B1B', kingfisher: '\u{1F426}',
        barn_owl: '\u{1F989}', magpie: '\u{1F426}\u200D\u2B1B', wren: '\u{1F426}',
        sparrowhawk: '\u{1F985}', heron_grey: '\u{1FAB6}', puffin: '\u{1F427}',
        swift: '\u{1F426}', woodpecker_great: '\u{1F426}', raven: '\u{1F426}\u200D\u2B1B',
        jay: '\u{1F426}'
    };

    // ---- STATE ----
    const STATE = {
        speciesData: null,
        movesData: null,
        flock: [],
        playerXP: 0,
        playerLevel: 1,
        selectedBattleBird: null,
        battleState: null,
        audioCtx: null,
        mediaStream: null,
        recording: false,
        activeTab: 'flock'
    };

    // ---- STORAGE ----
    const STORAGE_KEY = 'burbz_flock';
    const PLAYER_KEY = 'burbz_player';

    function saveState() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(STATE.flock));
        localStorage.setItem(PLAYER_KEY, JSON.stringify({
            xp: STATE.playerXP,
            level: STATE.playerLevel
        }));
    }

    function loadState() {
        try {
            const f = localStorage.getItem(STORAGE_KEY);
            if (f) STATE.flock = JSON.parse(f);
            const p = localStorage.getItem(PLAYER_KEY);
            if (p) {
                const pd = JSON.parse(p);
                STATE.playerXP = pd.xp || 0;
                STATE.playerLevel = pd.level || 1;
            }
        } catch (e) {
            console.warn('Failed to load state:', e);
        }
    }

    // ---- DATA LOADING ----
    async function loadSpeciesData() {
        const resp = await fetch('data/birds.json');
        const data = await resp.json();
        STATE.speciesData = {};
        data.species.forEach(s => { STATE.speciesData[s.species_id] = s; });
        STATE.movesData = data.moves;
    }

    // ---- UTILITY ----
    function getEmoji(speciesId) {
        return BIRD_EMOJI[speciesId] || '\u{1F426}';
    }

    function xpForLevel(level) { return 100 * level * level; }

    function addXP(amount) {
        STATE.playerXP += amount;
        while (STATE.playerXP >= xpForLevel(STATE.playerLevel)) {
            STATE.playerXP -= xpForLevel(STATE.playerLevel);
            STATE.playerLevel++;
        }
        updatePlayerHUD();
        saveState();
    }

    function updatePlayerHUD() {
        const el = (id) => document.getElementById(id);
        el('player-level').textContent = 'LV ' + STATE.playerLevel;
        const pct = Math.min(100, (STATE.playerXP / xpForLevel(STATE.playerLevel)) * 100);
        el('player-xp-bar').style.width = pct + '%';
        el('bird-count').textContent = STATE.flock.length + ' Bird' + (STATE.flock.length !== 1 ? 's' : '');
    }

    function generateId() {
        return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    }

    function calcStats(base, level, rarity) {
        const rarityBonus = { common: 1, uncommon: 1.1, rare: 1.2, legendary: 1.35 };
        const mult = (rarityBonus[rarity] || 1) * (1 + (level - 1) * 0.08);
        const result = {};
        for (const k in base) {
            result[k] = Math.floor(base[k] * mult + Math.random() * 5);
        }
        return result;
    }

    function rollRarity() {
        const r = Math.random();
        if (r < 0.07) return 'legendary';
        if (r < 0.25) return 'rare';
        if (r < 0.55) return 'uncommon';
        return 'common';
    }

    // ---- CREATE BIRD INSTANCE ----
    function createBirdInstance(speciesId, sourceType, confidence) {
        const species = STATE.speciesData[speciesId];
        if (!species) return null;
        const rarity = rollRarity();
        const level = Math.max(1, STATE.playerLevel + Math.floor(Math.random() * 3) - 1);
        const stats = calcStats(species.base_stats, level, rarity);
        const moves = species.move_pool.slice(0, 4);

        return {
            id: generateId(),
            species_id: speciesId,
            common_name: species.common_name,
            source_type: sourceType,
            confidence: confidence,
            captured_at: new Date().toISOString(),
            level: level,
            xp: 0,
            stats: stats,
            rarity: rarity,
            art_assets: {
                portrait_url: null,
                card_url: null,
                animation_url: null
            },
            moves: moves
        };
    }

    // ---- TAB SYSTEM ----
    function initTabs() {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                switchTab(btn.dataset.tab);
            });
        });
    }

    function switchTab(tabId) {
        STATE.activeTab = tabId;
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tabId));
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === 'tab-' + tabId));

        if (tabId === 'flock') renderFlock();
        if (tabId === 'battle') renderBattleSelect();
    }

    // ---- FLOCK RENDERING ----
    function renderFlock(filter) {
        const grid = document.getElementById('flock-grid');
        const empty = document.getElementById('flock-empty');
        let birds = STATE.flock;

        if (filter && filter !== 'all') {
            birds = birds.filter(b => b.rarity === filter);
        }

        if (birds.length === 0) {
            grid.innerHTML = '';
            empty.classList.remove('hidden');
            return;
        }

        empty.classList.add('hidden');
        grid.innerHTML = birds.map(bird => {
            const species = STATE.speciesData[bird.species_id];
            const bgColor = species ? species.color_primary : '#333';
            return `
                <div class="bird-card rarity-${bird.rarity}" data-id="${bird.id}" onclick="window.BURBZ.showBirdDetail('${bird.id}')">
                    <div class="card-art">
                        <div class="card-art-bg" style="background: radial-gradient(circle, ${bgColor}44, transparent)"></div>
                        <span class="bird-emoji">${getEmoji(bird.species_id)}</span>
                    </div>
                    <div class="card-info">
                        <div class="card-name">${bird.common_name}</div>
                        <div class="card-meta">
                            <span class="card-level">LV ${bird.level}</span>
                            <span class="card-rarity ${bird.rarity}">${bird.rarity.toUpperCase()}</span>
                        </div>
                    </div>
                </div>`;
        }).join('');
    }

    function initFlockFilters() {
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                renderFlock(btn.dataset.filter);
            });
        });
    }

    // ---- BIRD DETAIL MODAL ----
    function showBirdDetail(birdId) {
        const bird = STATE.flock.find(b => b.id === birdId);
        if (!bird) return;
        const species = STATE.speciesData[bird.species_id];
        const modal = document.getElementById('bird-modal');
        const card = document.getElementById('detail-card');

        const maxStat = 120;
        const statEntries = [
            { key: 'hp', label: 'HP', cls: 'stat-hp' },
            { key: 'atk', label: 'ATK', cls: 'stat-atk' },
            { key: 'def', label: 'DEF', cls: 'stat-def' },
            { key: 'spd', label: 'SPD', cls: 'stat-spd' },
            { key: 'spl', label: 'SPL', cls: 'stat-spl' }
        ];

        card.innerHTML = `
            <div class="detail-portrait">${getEmoji(bird.species_id)}</div>
            <div class="detail-name">${bird.common_name}</div>
            <div class="detail-latin">${species ? species.latin_name : ''}</div>
            <span class="detail-rarity-badge ${bird.rarity}">${bird.rarity.toUpperCase()}</span>
            <div class="detail-desc">${species ? species.description : ''}</div>
            <div class="detail-stats">
                ${statEntries.map(s => `
                    <span class="stat-label">${s.label}</span>
                    <div class="stat-bar-bg"><div class="stat-bar-val ${s.cls}" style="width: ${(bird.stats[s.key] / maxStat) * 100}%"></div></div>
                    <span class="stat-num">${bird.stats[s.key]}</span>
                `).join('')}
            </div>
            <div class="detail-moves">
                <h4>MOVES</h4>
                ${bird.moves.map(m => {
                    const move = STATE.movesData[m];
                    const cls = move ? 'type-' + move.type : '';
                    return `<span class="move-tag ${cls}">${m}${move ? ' (' + (move.power || 'Status') + ')' : ''}</span>`;
                }).join('')}
            </div>
            <div style="margin-top:1rem; font-size:0.7rem; color:var(--text-muted)">
                Captured ${new Date(bird.captured_at).toLocaleDateString()} via ${bird.source_type}
                &bull; Confidence: ${Math.round(bird.confidence * 100)}%
            </div>`;

        modal.classList.remove('hidden');
    }

    function initModal() {
        const modal = document.getElementById('bird-modal');
        document.getElementById('modal-close').addEventListener('click', () => modal.classList.add('hidden'));
        modal.querySelector('.modal-backdrop').addEventListener('click', () => modal.classList.add('hidden'));
    }

    // ---- SOUND ID ----
    function initSoundID() {
        const btnRecord = document.getElementById('btn-record');
        const btnUpload = document.getElementById('btn-upload-audio');
        const fileInput = document.getElementById('audio-file-input');
        const canvas = document.getElementById('audio-canvas');
        const ctx = canvas.getContext('2d');

        // Draw idle visualizer
        drawIdleViz(ctx, canvas);

        btnRecord.addEventListener('click', () => {
            if (STATE.recording) {
                stopRecording();
            } else {
                startRecording(canvas, ctx);
            }
        });

        btnUpload.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                processAudioFile(e.target.files[0]);
            }
        });
    }

    function drawIdleViz(ctx, canvas) {
        const w = canvas.width;
        const h = canvas.height;
        ctx.fillStyle = '#13131f';
        ctx.fillRect(0, 0, w, h);

        const bars = 32;
        const barW = w / bars;
        for (let i = 0; i < bars; i++) {
            const barH = 5 + Math.random() * 10;
            ctx.fillStyle = 'rgba(76,201,240,0.3)';
            ctx.fillRect(i * barW + 1, h / 2 - barH / 2, barW - 2, barH);
        }
    }

    async function startRecording(canvas, ctx) {
        try {
            STATE.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            STATE.recording = true;
            const btnRecord = document.getElementById('btn-record');
            btnRecord.classList.add('recording');
            btnRecord.querySelector('span').textContent = 'STOP';
            document.getElementById('sound-status').textContent = 'Listening...';

            // Audio visualization
            STATE.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const source = STATE.audioCtx.createMediaStreamSource(STATE.mediaStream);
            const analyser = STATE.audioCtx.createAnalyser();
            analyser.fftSize = 64;
            source.connect(analyser);

            const bufferLength = analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);

            function drawViz() {
                if (!STATE.recording) return;
                requestAnimationFrame(drawViz);
                analyser.getByteFrequencyData(dataArray);

                const w = canvas.width;
                const h = canvas.height;
                ctx.fillStyle = '#13131f';
                ctx.fillRect(0, 0, w, h);

                const barW = w / bufferLength;
                for (let i = 0; i < bufferLength; i++) {
                    const barH = (dataArray[i] / 255) * h * 0.8;
                    const hue = 190 + (i / bufferLength) * 60;
                    ctx.fillStyle = `hsla(${hue}, 80%, 60%, 0.8)`;
                    ctx.fillRect(i * barW + 1, h - barH, barW - 2, barH);
                }
            }
            drawViz();

            // Auto-stop after 10 seconds
            setTimeout(() => {
                if (STATE.recording) stopRecording();
            }, 10000);

        } catch (err) {
            console.error('Microphone access denied:', err);
            document.getElementById('sound-status').textContent = 'Mic access denied';
        }
    }

    function stopRecording() {
        STATE.recording = false;
        if (STATE.mediaStream) {
            STATE.mediaStream.getTracks().forEach(t => t.stop());
            STATE.mediaStream = null;
        }
        if (STATE.audioCtx) {
            STATE.audioCtx.close();
            STATE.audioCtx = null;
        }
        const btnRecord = document.getElementById('btn-record');
        btnRecord.classList.remove('recording');
        btnRecord.querySelector('span').textContent = 'RECORD';
        document.getElementById('sound-status').textContent = 'Analyzing...';

        // Simulate identification (replace with real BirdNET API call)
        setTimeout(() => performBirdID('sound'), 1500);
    }

    function processAudioFile(file) {
        document.getElementById('sound-status').textContent = 'Analyzing ' + file.name + '...';
        setTimeout(() => performBirdID('sound'), 1500);
    }

    // ---- IMAGE ID ----
    function initImageID() {
        const btnCamera = document.getElementById('btn-camera');
        const btnUpload = document.getElementById('btn-upload-image');
        const fileInput = document.getElementById('image-file-input');
        const cameraInput = document.getElementById('camera-input');

        btnCamera.addEventListener('click', () => cameraInput.click());
        btnUpload.addEventListener('click', () => fileInput.click());

        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) handleImageFile(e.target.files[0]);
        });
        cameraInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) handleImageFile(e.target.files[0]);
        });
    }

    function handleImageFile(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const preview = document.getElementById('preview-img');
            const placeholder = document.querySelector('.preview-placeholder');
            preview.src = e.target.result;
            preview.classList.remove('hidden');
            if (placeholder) placeholder.style.display = 'none';

            // Simulate identification
            setTimeout(() => performBirdID('image'), 2000);
        };
        reader.readAsDataURL(file);
    }

    // ---- BIRD IDENTIFICATION (Mock - ready for real API) ----
    function performBirdID(sourceType) {
        // TODO: Replace with real BirdNET / image classifier API call
        // This mock picks a random species with confidence gating
        const speciesIds = Object.keys(STATE.speciesData);
        const speciesId = speciesIds[Math.floor(Math.random() * speciesIds.length)];
        const species = STATE.speciesData[speciesId];

        // Simulate confidence (weighted toward higher for common birds)
        const rarityConf = { common: 0.75, uncommon: 0.65, rare: 0.55, legendary: 0.45 };
        const baseConf = rarityConf[species.rarity_tier] || 0.6;
        const confidence = Math.min(0.99, baseConf + Math.random() * 0.25);

        const resultEl = document.getElementById(sourceType === 'sound' ? 'sound-result' : 'image-result');
        const statusEl = document.getElementById('sound-status');
        if (statusEl && sourceType === 'sound') statusEl.textContent = 'Match found!';

        const confClass = confidence >= 0.8 ? 'confidence-high' : confidence >= 0.6 ? 'confidence-mid' : 'confidence-low';
        const confLabel = confidence >= 0.8 ? 'HIGH' : confidence >= 0.6 ? 'MEDIUM' : 'LOW';
        const canCapture = confidence >= 0.5;

        resultEl.innerHTML = `
            <div class="result-species">${species.common_name}</div>
            <div class="result-latin">${species.latin_name}</div>
            <div class="result-confidence ${confClass}">
                ${confLabel} CONFIDENCE: ${Math.round(confidence * 100)}%
            </div>
            <p style="font-size:0.8rem; color:var(--text-muted); margin-bottom:0.8rem;">
                ${species.description}
            </p>
            ${canCapture
                ? `<button class="btn-capture" onclick="window.BURBZ.captureBird('${speciesId}', '${sourceType}', ${confidence})">
                       CAPTURE THIS BIRD
                   </button>`
                : `<p style="color:var(--accent-red); font-size:0.85rem; font-weight:600;">
                       Confidence too low to capture. Try again!
                   </p>`
            }
            <p style="font-size:0.65rem; color:var(--text-muted); margin-top:0.8rem;">
                Note: Using mock ID. Real BirdNET integration coming soon.
            </p>`;

        resultEl.classList.remove('hidden');
    }

    // ---- CAPTURE ----
    function captureBird(speciesId, sourceType, confidence) {
        const bird = createBirdInstance(speciesId, sourceType, confidence);
        if (!bird) return;

        STATE.flock.push(bird);
        saveState();
        addXP(50);
        showCaptureScreen(bird);
    }

    function showCaptureScreen(bird) {
        const overlay = document.getElementById('capture-overlay');
        const species = STATE.speciesData[bird.species_id];

        document.getElementById('capture-card').textContent = getEmoji(bird.species_id);
        document.getElementById('capture-species').textContent = bird.common_name;
        const rarityEl = document.getElementById('capture-rarity');
        rarityEl.textContent = bird.rarity.toUpperCase();
        rarityEl.style.color = {
            common: '#95a5a6', uncommon: '#2ecc71', rare: '#4cc9f0', legendary: '#f4d03f'
        }[bird.rarity] || '#fff';

        overlay.classList.remove('hidden');
        spawnParticles(species ? species.color_primary : '#e63946');

        document.getElementById('btn-capture-dismiss').onclick = () => {
            overlay.classList.add('hidden');
            updatePlayerHUD();
            switchTab('flock');
        };
    }

    function spawnParticles(color) {
        const container = document.getElementById('capture-particles');
        container.innerHTML = '';
        for (let i = 0; i < 30; i++) {
            const p = document.createElement('div');
            p.className = 'particle';
            p.style.left = '50%';
            p.style.top = '50%';
            p.style.background = color;
            p.style.setProperty('--px', (Math.random() - 0.5) * 400 + 'px');
            p.style.setProperty('--py', (Math.random() - 0.5) * 400 + 'px');
            p.style.animationDelay = Math.random() * 0.3 + 's';
            container.appendChild(p);
        }
    }

    // ---- EXPOSE PUBLIC API ----
    window.BURBZ = {
        showBirdDetail,
        captureBird
    };

    // ---- INIT ----
    async function init() {
        loadState();
        await loadSpeciesData();
        updatePlayerHUD();
        initTabs();
        initFlockFilters();
        initModal();
        initSoundID();
        initImageID();
        initBattle();
        renderFlock();

        // Splash screen
        document.getElementById('btn-enter').addEventListener('click', () => {
            const splash = document.getElementById('splash-screen');
            splash.style.transition = 'opacity 0.5s';
            splash.style.opacity = '0';
            setTimeout(() => {
                splash.style.display = 'none';
                document.getElementById('app').classList.remove('hidden');
            }, 500);
        });
    }

    // ============================================
    // BATTLE SYSTEM
    // ============================================

    function initBattle() {
        document.getElementById('btn-find-battle').addEventListener('click', startBattle);
        document.getElementById('btn-battle-again').addEventListener('click', () => {
            hideBattleScreens();
            renderBattleSelect();
        });
        document.getElementById('btn-back-flock').addEventListener('click', () => {
            hideBattleScreens();
            switchTab('flock');
        });

        // Move buttons
        document.querySelectorAll('.move-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                if (STATE.battleState && !STATE.battleState.turnInProgress) {
                    playerAttack(parseInt(btn.dataset.move));
                }
            });
        });
    }

    function hideBattleScreens() {
        ['battle-vs', 'battle-arena', 'battle-result'].forEach(id => {
            document.getElementById(id).classList.add('hidden');
        });
        document.getElementById('battle-select').style.display = '';
    }

    function renderBattleSelect() {
        const roster = document.getElementById('battle-roster');
        const empty = document.getElementById('battle-select-empty');
        const fightBtn = document.getElementById('btn-find-battle');

        if (STATE.flock.length === 0) {
            roster.innerHTML = '';
            empty.classList.remove('hidden');
            fightBtn.classList.add('hidden');
            return;
        }

        empty.classList.add('hidden');
        fightBtn.classList.remove('hidden');
        fightBtn.disabled = true;
        STATE.selectedBattleBird = null;

        roster.innerHTML = STATE.flock.map(bird => `
            <div class="roster-card" data-id="${bird.id}">
                <div class="card-art">${getEmoji(bird.species_id)}</div>
                <div class="card-name">${bird.common_name}</div>
                <div class="card-level">LV ${bird.level}</div>
            </div>
        `).join('');

        roster.querySelectorAll('.roster-card').forEach(card => {
            card.addEventListener('click', () => {
                roster.querySelectorAll('.roster-card').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
                STATE.selectedBattleBird = card.dataset.id;
                fightBtn.disabled = false;
            });
        });
    }

    function generateOpponent() {
        const speciesIds = Object.keys(STATE.speciesData);
        const speciesId = speciesIds[Math.floor(Math.random() * speciesIds.length)];
        const species = STATE.speciesData[speciesId];
        const rarity = rollRarity();
        const level = Math.max(1, STATE.playerLevel + Math.floor(Math.random() * 5) - 2);
        const stats = calcStats(species.base_stats, level, rarity);
        return {
            id: 'opp_' + generateId(),
            species_id: speciesId,
            common_name: species.common_name,
            level: level,
            stats: stats,
            rarity: rarity,
            moves: species.move_pool.slice(0, 4),
            currentHP: null
        };
    }

    function startBattle() {
        const playerBird = STATE.flock.find(b => b.id === STATE.selectedBattleBird);
        if (!playerBird) return;

        const opponent = generateOpponent();
        const playerMaxHP = playerBird.stats.hp * 3 + 50;
        const oppMaxHP = opponent.stats.hp * 3 + 50;

        STATE.battleState = {
            player: { ...playerBird, maxHP: playerMaxHP, currentHP: playerMaxHP },
            opponent: { ...opponent, maxHP: oppMaxHP, currentHP: oppMaxHP },
            turnInProgress: false,
            round: 0
        };

        // Show VS screen
        document.getElementById('battle-select').style.display = 'none';
        showVSScreen(playerBird, opponent);
    }

    function showVSScreen(player, opponent) {
        const vs = document.getElementById('battle-vs');
        document.getElementById('vs-card-player').textContent = getEmoji(player.species_id);
        document.getElementById('vs-name-player').textContent = player.common_name;
        document.getElementById('vs-card-opponent').textContent = getEmoji(opponent.species_id);
        document.getElementById('vs-name-opponent').textContent = opponent.common_name;
        vs.classList.remove('hidden');

        // Transition to arena after delay
        setTimeout(() => {
            vs.classList.add('hidden');
            showArena();
        }, 2500);
    }

    function showArena() {
        const bs = STATE.battleState;
        const arena = document.getElementById('battle-arena');

        // Setup sprites
        document.getElementById('player-sprite').textContent = getEmoji(bs.player.species_id);
        document.getElementById('opp-sprite').textContent = getEmoji(bs.opponent.species_id);

        // Setup HUDs
        document.getElementById('player-name').textContent = bs.player.common_name;
        document.getElementById('player-level-battle').textContent = 'LV ' + bs.player.level;
        document.getElementById('opp-name').textContent = bs.opponent.common_name;
        document.getElementById('opp-level').textContent = 'LV ' + bs.opponent.level;

        updateBattleHP();

        // Setup move buttons
        bs.player.moves.forEach((moveName, i) => {
            const btn = document.querySelectorAll('.move-btn')[i];
            const move = STATE.movesData[moveName];
            btn.textContent = moveName;
            btn.className = 'move-btn';
            if (move) btn.classList.add('type-' + move.type);
            btn.disabled = false;
        });

        document.getElementById('log-text').textContent = 'Battle start! Choose your move!';
        arena.classList.remove('hidden');
    }

    function updateBattleHP() {
        const bs = STATE.battleState;

        // Player HP
        const pPct = Math.max(0, (bs.player.currentHP / bs.player.maxHP) * 100);
        const pBar = document.getElementById('player-hp-bar');
        pBar.style.width = pPct + '%';
        pBar.className = 'hp-bar-fill' + (pPct < 25 ? ' hp-low' : pPct < 50 ? ' hp-mid' : '');
        document.getElementById('player-hp-text').textContent = Math.max(0, bs.player.currentHP) + ' / ' + bs.player.maxHP;

        // Opponent HP
        const oPct = Math.max(0, (bs.opponent.currentHP / bs.opponent.maxHP) * 100);
        const oBar = document.getElementById('opp-hp-bar');
        oBar.style.width = oPct + '%';
        oBar.className = 'hp-bar-fill' + (oPct < 25 ? ' hp-low' : oPct < 50 ? ' hp-mid' : '');
        document.getElementById('opp-hp-text').textContent = Math.max(0, bs.opponent.currentHP) + ' / ' + bs.opponent.maxHP;
    }

    function calcDamage(attacker, defender, move) {
        if (move.type === 'status') return 0;
        const atkStat = move.type === 'special' ? attacker.stats.spl : attacker.stats.atk;
        const defStat = move.type === 'special' ? defender.stats.spl : defender.stats.def;
        const baseDmg = ((2 * attacker.level / 5 + 2) * move.power * atkStat / defStat) / 50 + 2;
        const variance = 0.85 + Math.random() * 0.3;
        const crit = Math.random() < 0.1 ? 1.5 : 1;
        const accuracy = Math.random() * 100 <= move.accuracy;
        if (!accuracy) return -1; // miss
        return Math.floor(baseDmg * variance * crit);
    }

    function applyStatusEffect(user, target, move) {
        // Simple stat boost/heal for status moves
        const effects = [];
        if (move.description.toLowerCase().includes('defense') || move.description.toLowerCase().includes('shield')) {
            user.stats.def = Math.floor(user.stats.def * 1.3);
            effects.push('DEF UP!');
        }
        if (move.description.toLowerCase().includes('special attack') || move.description.toLowerCase().includes('wisdom')) {
            user.stats.spl = Math.floor(user.stats.spl * 1.3);
            effects.push('SPL ATK UP!');
        }
        if (move.description.toLowerCase().includes('evasion') || move.description.toLowerCase().includes('dodge')) {
            user.stats.spd = Math.floor(user.stats.spd * 1.2);
            effects.push('SPEED UP!');
        }
        if (move.description.toLowerCase().includes('recover') || move.description.toLowerCase().includes('stance')) {
            const heal = Math.floor(user.maxHP * 0.25);
            user.currentHP = Math.min(user.maxHP, user.currentHP + heal);
            effects.push('HEALED ' + heal + ' HP!');
        }
        if (move.description.toLowerCase().includes('lower')) {
            target.stats.def = Math.floor(target.stats.def * 0.75);
            effects.push('Enemy DEF DOWN!');
        }
        return effects.length > 0 ? effects.join(' ') : 'Stats boosted!';
    }

    function showDamageNumber(targetSide, amount, type) {
        const sprite = document.getElementById(targetSide === 'player' ? 'player-sprite' : 'opp-sprite');
        const num = document.createElement('div');
        num.className = 'damage-number' + (type === 'heal' ? ' heal' : type === 'buff' ? ' buff' : '');
        num.textContent = type === 'miss' ? 'MISS!' : (type === 'heal' || type === 'buff' ? '+' + amount : '-' + amount);
        num.style.left = sprite.offsetLeft + 'px';
        num.style.top = sprite.offsetTop + 'px';
        sprite.parentElement.appendChild(num);
        setTimeout(() => num.remove(), 1000);
    }

    function showHitFlash() {
        const flash = document.createElement('div');
        flash.className = 'hit-flash';
        document.body.appendChild(flash);
        setTimeout(() => flash.remove(), 200);
    }

    async function playerAttack(moveIndex) {
        const bs = STATE.battleState;
        if (bs.turnInProgress || bs.player.currentHP <= 0) return;
        bs.turnInProgress = true;
        bs.round++;

        // Disable moves
        document.querySelectorAll('.move-btn').forEach(b => b.disabled = true);

        const moveName = bs.player.moves[moveIndex];
        const move = STATE.movesData[moveName] || { type: 'physical', power: 40, accuracy: 90 };

        // Player attacks
        document.getElementById('log-text').textContent = bs.player.common_name + ' used ' + moveName + '!';
        document.getElementById('player-sprite').classList.add('attack-anim');
        await delay(300);
        document.getElementById('player-sprite').classList.remove('attack-anim');

        if (move.type === 'status') {
            const effect = applyStatusEffect(bs.player, bs.opponent, move);
            document.getElementById('log-text').textContent = effect;
            showDamageNumber('player', '', 'buff');
        } else {
            const dmg = calcDamage(bs.player, bs.opponent, move);
            if (dmg === -1) {
                document.getElementById('log-text').textContent = 'It missed!';
                showDamageNumber('opponent', 0, 'miss');
            } else {
                bs.opponent.currentHP -= dmg;
                showHitFlash();
                document.getElementById('opp-sprite').classList.add('hit-anim');
                showDamageNumber('opponent', dmg, 'damage');
                setTimeout(() => document.getElementById('opp-sprite').classList.remove('hit-anim'), 300);
                updateBattleHP();
            }
        }

        await delay(1200);

        // Check KO
        if (bs.opponent.currentHP <= 0) {
            document.getElementById('opp-sprite').classList.add('ko-anim');
            document.getElementById('log-text').textContent = bs.opponent.common_name + ' is KO!';
            await delay(1200);
            endBattle(true);
            return;
        }

        // Opponent turn
        await opponentAttack();
    }

    async function opponentAttack() {
        const bs = STATE.battleState;
        const moveIndex = Math.floor(Math.random() * bs.opponent.moves.length);
        const moveName = bs.opponent.moves[moveIndex];
        const move = STATE.movesData[moveName] || { type: 'physical', power: 40, accuracy: 90 };

        document.getElementById('log-text').textContent = bs.opponent.common_name + ' used ' + moveName + '!';
        document.getElementById('opp-sprite').classList.add('attack-anim');
        await delay(300);
        document.getElementById('opp-sprite').classList.remove('attack-anim');

        if (move.type === 'status') {
            const effect = applyStatusEffect(bs.opponent, bs.player, move);
            document.getElementById('log-text').textContent = effect;
        } else {
            const dmg = calcDamage(bs.opponent, bs.player, move);
            if (dmg === -1) {
                document.getElementById('log-text').textContent = 'It missed!';
                showDamageNumber('player', 0, 'miss');
            } else {
                bs.player.currentHP -= dmg;
                showHitFlash();
                document.getElementById('player-sprite').classList.add('hit-anim');
                showDamageNumber('player', dmg, 'damage');
                setTimeout(() => document.getElementById('player-sprite').classList.remove('hit-anim'), 300);
                updateBattleHP();
            }
        }

        await delay(1200);

        // Check KO
        if (bs.player.currentHP <= 0) {
            document.getElementById('player-sprite').classList.add('ko-anim');
            document.getElementById('log-text').textContent = bs.player.common_name + ' is KO!';
            await delay(1200);
            endBattle(false);
            return;
        }

        // Re-enable moves
        document.querySelectorAll('.move-btn').forEach(b => b.disabled = false);
        document.getElementById('log-text').textContent = 'Choose your move!';
        bs.turnInProgress = false;
    }

    function endBattle(victory) {
        const bs = STATE.battleState;
        document.getElementById('battle-arena').classList.add('hidden');

        const resultScreen = document.getElementById('battle-result');
        const resultText = document.getElementById('result-text');
        const resultDetails = document.getElementById('result-details');
        const resultRewards = document.getElementById('result-rewards');

        resultText.textContent = victory ? 'VICTORY!' : 'DEFEAT';
        resultText.className = 'result-text ' + (victory ? 'victory' : 'defeat');

        if (victory) {
            const xpGain = 30 + bs.opponent.level * 10;
            resultDetails.textContent = bs.player.common_name + ' defeated ' + bs.opponent.common_name + '!';
            resultRewards.innerHTML = `
                <div class="reward-item">+${xpGain} XP</div>
                <div class="reward-item">Round ${bs.round}</div>
            `;
            addXP(xpGain);

            // Level up the bird
            const bird = STATE.flock.find(b => b.id === bs.player.id);
            if (bird) {
                bird.xp = (bird.xp || 0) + xpGain;
                if (bird.xp >= bird.level * 80) {
                    bird.xp -= bird.level * 80;
                    bird.level++;
                    const species = STATE.speciesData[bird.species_id];
                    if (species) bird.stats = calcStats(species.base_stats, bird.level, bird.rarity);
                    resultRewards.innerHTML += `<div class="reward-item">${bird.common_name} LV UP! -> ${bird.level}</div>`;
                }
                saveState();
            }
        } else {
            resultDetails.textContent = bs.player.common_name + ' was defeated by ' + bs.opponent.common_name + '.';
            resultRewards.innerHTML = `<div class="reward-item">+10 XP (consolation)</div>`;
            addXP(10);
        }

        resultScreen.classList.remove('hidden');
        STATE.battleState = null;
    }

    function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

    document.addEventListener('DOMContentLoaded', init);
