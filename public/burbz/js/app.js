/* ============================================
   BURBZ - Bird Fighter Collection
   Core Game Engine
   ============================================ */

(function () {
    'use strict';

    // ---- BIRD PORTRAIT PATHS ----
    const BIRD_PORTRAITS = {
        robin_eu: 'assets/robin_eu.svg', peregrine: 'assets/peregrine.svg',
        blue_tit: 'assets/blue_tit.svg', golden_eagle: 'assets/golden_eagle.svg',
        crow_carrion: 'assets/crow_carrion.svg', kingfisher: 'assets/kingfisher.svg',
        barn_owl: 'assets/barn_owl.svg', magpie: 'assets/magpie.svg',
        wren: 'assets/wren.svg', sparrowhawk: 'assets/sparrowhawk.svg',
        heron_grey: 'assets/heron_grey.svg', puffin: 'assets/puffin.svg',
        swift: 'assets/swift.svg', woodpecker_great: 'assets/woodpecker_great.svg',
        raven: 'assets/raven.svg', jay: 'assets/jay.svg'
    };

    // ---- STATE ----
    const STATE = {
        speciesData: null,
        movesData: null,
        typeChart: null,
        ladderTiers: null,
        flock: [],
        playerXP: 0,
        playerLevel: 1,
        flockView: 'flock',
        stats: { battleWins: 0 },
        achievements: { unlocked: {} },
        selectedBattleBird: null,
        battleState: null,
        battleMode: 'quick',
        ladderProgress: { winsByTier: {} },
        audioCtx: null,
        mediaStream: null,
        mediaRecorder: null,
        recordedBlob: null,
        recording: false,
        activeTab: 'flock'
    };

    // ---- STORAGE ----
    const STORAGE_KEY = 'burbz_flock';
    const PLAYER_KEY = 'burbz_player';
    const LADDER_KEY = 'burbz_ladder';
    const STATS_KEY = 'burbz_stats';

    function saveState() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(STATE.flock));
        localStorage.setItem(PLAYER_KEY, JSON.stringify({
            xp: STATE.playerXP,
            level: STATE.playerLevel
        }));
        localStorage.setItem(LADDER_KEY, JSON.stringify(STATE.ladderProgress));
        localStorage.setItem(STATS_KEY, JSON.stringify(STATE.stats));
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
            const l = localStorage.getItem(LADDER_KEY);
            if (l) {
                const ld = JSON.parse(l);
                STATE.ladderProgress = {
                    winsByTier: (ld && ld.winsByTier) || {}
                };
            }
            const st = localStorage.getItem(STATS_KEY);
            if (st) {
                const sd = JSON.parse(st);
                STATE.stats = { battleWins: (sd && sd.battleWins) || 0 };
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
        STATE.typeChart = data.type_chart || {};
        STATE.ladderTiers = data.ladder_tiers || [];
    }

    // ---- TYPE EFFECTIVENESS ----
    function typeMultiplier(attackerElement, defenderElement) {
        if (!attackerElement || !defenderElement || !STATE.typeChart) return 1;
        const row = STATE.typeChart[attackerElement];
        if (!row) return 1;
        const m = row[defenderElement];
        return typeof m === 'number' ? m : 1;
    }

    function effectivenessLabel(mult) {
        if (mult >= 1.5) return "It's super effective!";
        if (mult > 0 && mult < 1) return 'Not very effective...';
        return '';
    }

    // ---- UTILITY ----
    function getPortraitURL(speciesId) {
        if (BIRD_PORTRAITS[speciesId]) return BIRD_PORTRAITS[speciesId];
        // Fall back to portrait_ref on the species definition so new birds can reuse existing art
        const sp = STATE.speciesData && STATE.speciesData[speciesId];
        if (sp && sp.portrait_ref && BIRD_PORTRAITS[sp.portrait_ref]) {
            return BIRD_PORTRAITS[sp.portrait_ref];
        }
        return 'assets/robin_eu.svg';
    }

    function getPortraitHTML(speciesId, cls) {
        return '<img src="' + getPortraitURL(speciesId) + '" alt="" class="bird-portrait ' + (cls || '') + '">';
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

        const bird = {
            id: generateId(),
            species_id: speciesId,
            common_name: species.common_name,
            source_type: sourceType,
            confidence: confidence,
            captured_at: new Date().toISOString(),
            captured_location: null,
            level: level,
            xp: 0,
            stats: stats,
            rarity: rarity,
            art_assets: { portrait_url: null, card_url: null, animation_url: null },
            moves: moves
        };

        // Best-effort location stamp — non-blocking
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(function (pos) {
                bird.captured_location = {
                    lat: +pos.coords.latitude.toFixed(4),
                    lng: +pos.coords.longitude.toFixed(4)
                };
                saveState();
            }, function () { /* ignore */ }, { enableHighAccuracy: false, timeout: 4000, maximumAge: 600000 });
        }

        return bird;
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

        if (tabId === 'flock') renderFlockView();
        if (tabId === 'battle') renderBattleSelect();
        if (tabId === 'nearby') renderNearby();
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
                        ${getPortraitHTML(bird.species_id, 'card-portrait')}
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
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                STATE.flockView = btn.dataset.view;
                renderFlockView();
            });
        });
    }

    function renderFlockView() {
        const flockGrid = document.getElementById('flock-grid');
        const flockEmpty = document.getElementById('flock-empty');
        const dexGrid = document.getElementById('dex-grid');
        const filters = document.getElementById('flock-filters');
        const isDex = STATE.flockView === 'dex';
        if (isDex) {
            flockGrid.classList.add('hidden');
            flockEmpty.classList.add('hidden');
            dexGrid.classList.remove('hidden');
            if (filters) filters.classList.add('hidden');
            renderDex();
        } else {
            dexGrid.classList.add('hidden');
            flockGrid.classList.remove('hidden');
            if (filters) filters.classList.remove('hidden');
            renderFlock();
        }
    }

    function renderDex() {
        const dexGrid = document.getElementById('dex-grid');
        const dexCountEl = document.getElementById('dex-count');
        if (!dexGrid || !STATE.speciesData) return;
        const allSpecies = Object.values(STATE.speciesData);
        const caughtIds = new Set(STATE.flock.map(b => b.species_id));
        const caught = caughtIds.size;
        const total = allSpecies.length;
        if (dexCountEl) dexCountEl.textContent = '(' + caught + '/' + total + ')';

        dexGrid.innerHTML = allSpecies.map(sp => {
            const have = caughtIds.has(sp.species_id);
            const el = sp.element || 'normal';
            const cls = 'bird-card rarity-' + sp.rarity_tier + ' dex-card' + (have ? '' : ' locked');
            const name = have ? sp.common_name : '???';
            const onClick = have
                ? 'onclick="window.BURBZ.showSpeciesDetail(\'' + sp.species_id + '\')"'
                : '';
            return '<div class="' + cls + '" ' + onClick + '>' +
                '<div class="card-art">' + getPortraitHTML(sp.species_id, 'card-portrait' + (have ? '' : ' silhouette')) + '</div>' +
                '<div class="card-info">' +
                '<div class="card-name">' + name + '</div>' +
                '<div class="card-meta">' +
                '<span class="card-rarity ' + sp.rarity_tier + '">' + sp.rarity_tier.toUpperCase() + '</span>' +
                (have ? '<span class="card-element el-' + el + '">' + el.toUpperCase() + '</span>' : '<span class="dex-unseen">NOT SEEN</span>') +
                '</div></div></div>';
        }).join('');
    }

    function showSpeciesDetail(speciesId) {
        // Show any owned instance, preferring highest level
        const owned = STATE.flock.filter(b => b.species_id === speciesId);
        if (owned.length === 0) return;
        owned.sort((a, b) => (b.level || 1) - (a.level || 1));
        showBirdDetail(owned[0].id);
    }

    // ---- WIKIPEDIA ENRICHMENT ----
    const WIKI_CACHE_KEY = 'burbz_wiki_cache';
    let _wikiCache = null;

    function loadWikiCache() {
        if (_wikiCache) return _wikiCache;
        try { _wikiCache = JSON.parse(localStorage.getItem(WIKI_CACHE_KEY) || '{}'); } catch (e) { _wikiCache = {}; }
        return _wikiCache;
    }

    function saveWikiCache() {
        try { localStorage.setItem(WIKI_CACHE_KEY, JSON.stringify(_wikiCache || {})); } catch (e) {}
    }

    async function fetchWikipediaSummary(title) {
        const cache = loadWikiCache();
        if (cache[title]) return cache[title];
        try {
            const url = 'https://en.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(title);
            const resp = await fetch(url, { headers: { 'Accept': 'application/json' } });
            if (!resp.ok) return null;
            const data = await resp.json();
            const entry = {
                extract: data.extract || '',
                thumb: (data.thumbnail && data.thumbnail.source) || '',
                url: (data.content_urls && data.content_urls.desktop && data.content_urls.desktop.page) || ''
            };
            cache[title] = entry;
            _wikiCache = cache;
            saveWikiCache();
            return entry;
        } catch (e) {
            console.warn('Wikipedia fetch failed:', e);
            return null;
        }
    }

    async function enrichBirdDetailWithWiki(species, targetEl) {
        if (!species || !targetEl) return;
        const title = species.latin_name || species.common_name;
        if (!title) return;
        let entry = await fetchWikipediaSummary(title);
        if (!entry || !entry.extract) {
            // Fall back to common name if latin lookup failed
            if (title !== species.common_name) {
                entry = await fetchWikipediaSummary(species.common_name);
            }
        }
        if (!entry || !entry.extract) return;
        if (!document.body.contains(targetEl)) return;
        const thumb = entry.thumb
            ? '<img class="wiki-thumb" src="' + entry.thumb + '" alt="" loading="lazy">'
            : '';
        const link = entry.url
            ? '<a class="wiki-link" href="' + entry.url + '" target="_blank" rel="noopener">Read on Wikipedia &rsaquo;</a>'
            : '';
        targetEl.innerHTML =
            '<h4>FROM THE FIELD GUIDE</h4>' +
            '<div class="wiki-body">' + thumb +
            '<p class="wiki-extract">' + entry.extract + '</p>' +
            '</div>' + link;
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
            <div class="detail-portrait">${getPortraitHTML(bird.species_id, 'detail-img')}</div>
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
                ${bird.captured_location ? '<br>Near ' + bird.captured_location.lat + ', ' + bird.captured_location.lng + ' &middot; <a href="https://www.openstreetmap.org/?mlat=' + bird.captured_location.lat + '&mlon=' + bird.captured_location.lng + '#map=14/' + bird.captured_location.lat + '/' + bird.captured_location.lng + '" target="_blank" rel="noopener" style="color:var(--accent-blue);">View on map</a>' : ''}
            </div>
            <div class="detail-wiki" id="detail-wiki"></div>`;

        modal.classList.remove('hidden');

        // Asynchronously enrich with Wikipedia — will update only if still open.
        enrichBirdDetailWithWiki(species, document.getElementById('detail-wiki'));
    }

    function initModal() {
        const modal = document.getElementById('bird-modal');
        document.getElementById('modal-close').addEventListener('click', () => modal.classList.add('hidden'));
        modal.querySelector('.modal-backdrop').addEventListener('click', () => modal.classList.add('hidden'));
    }

    // ---- DAILY CHALLENGES ----
    const DAILY_KEY = 'burbz_daily';

    const CHALLENGE_TEMPLATES = [
        { id: 'capture',        targets: [2, 3, 4], rewards: [60, 100, 160], label: function (n) { return 'Capture ' + n + ' birds today'; } },
        { id: 'battle_win',     targets: [2, 3, 5], rewards: [80, 140, 220], label: function (n) { return 'Win ' + n + ' battles'; } },
        { id: 'ladder_win',     targets: [1, 2],    rewards: [120, 220],     label: function (n) { return 'Win ' + n + ' ladder match' + (n > 1 ? 'es' : ''); } },
        { id: 'element_move',   targets: [3, 4, 5], rewards: [60, 90, 130],  label: function (n, meta) { return 'Use ' + n + ' ' + meta.element.toUpperCase() + ' moves'; } },
        { id: 'rarity_capture', targets: [1],       rewards: [140],          label: function (n, meta) { return 'Capture a ' + meta.rarity.toUpperCase() + ' bird'; } }
    ];

    function todayKey() {
        const d = new Date();
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }

    function rollDailyChallenges() {
        const pool = CHALLENGE_TEMPLATES.slice();
        const picked = [];
        const count = Math.min(3, pool.length);
        for (let i = 0; i < count; i++) {
            const poolIdx = Math.floor(Math.random() * pool.length);
            const tpl = pool.splice(poolIdx, 1)[0];
            const tIdx = Math.floor(Math.random() * tpl.targets.length);
            const target = tpl.targets[tIdx];
            const reward = tpl.rewards[tIdx];
            const meta = {};
            if (tpl.id === 'element_move') {
                const els = ['flame', 'sky', 'aqua', 'shadow', 'light'];
                meta.element = els[Math.floor(Math.random() * els.length)];
            }
            if (tpl.id === 'rarity_capture') {
                const rs = ['uncommon', 'rare'];
                meta.rarity = rs[Math.floor(Math.random() * rs.length)];
            }
            picked.push({
                id: tpl.id + '_' + i,
                type: tpl.id,
                target: target,
                reward_xp: reward,
                progress: 0,
                claimed: false,
                label: tpl.label(target, meta),
                meta: meta
            });
        }
        return picked;
    }

    function ensureDailyChallenges() {
        const today = todayKey();
        if (!STATE.dailyChallenges || STATE.dailyChallenges.date !== today) {
            STATE.dailyChallenges = { date: today, challenges: rollDailyChallenges() };
            saveDaily();
        }
    }

    function saveDaily() {
        try { localStorage.setItem(DAILY_KEY, JSON.stringify(STATE.dailyChallenges)); } catch (e) {}
    }

    function loadDaily() {
        try {
            const s = localStorage.getItem(DAILY_KEY);
            if (s) STATE.dailyChallenges = JSON.parse(s);
        } catch (e) {}
    }

    const RARITY_ORDER = { common: 0, uncommon: 1, rare: 2, legendary: 3 };

    function bumpChallenge(type, amount, predicate) {
        if (!STATE.dailyChallenges || !STATE.dailyChallenges.challenges) return;
        let changed = false;
        STATE.dailyChallenges.challenges.forEach(function (c) {
            if (c.type !== type || c.claimed) return;
            if (predicate && !predicate(c)) return;
            const next = Math.min(c.target, c.progress + amount);
            if (next !== c.progress) {
                c.progress = next;
                changed = true;
            }
        });
        if (changed) {
            saveDaily();
            renderDaily();
        }
    }

    function recordCapture(bird) {
        bumpChallenge('capture', 1);
        bumpChallenge('rarity_capture', 1, function (c) {
            return RARITY_ORDER[bird.rarity] >= RARITY_ORDER[c.meta.rarity];
        });
        evaluateAchievements();
    }

    function recordBattleWin(tier) {
        bumpChallenge('battle_win', 1);
        if (tier) bumpChallenge('ladder_win', 1);
        if (!STATE.stats) STATE.stats = { battleWins: 0 };
        STATE.stats.battleWins = (STATE.stats.battleWins || 0) + 1;
        saveState();
        evaluateAchievements();
    }

    function recordElementMove(element) {
        if (!element) return;
        bumpChallenge('element_move', 1, function (c) { return c.meta.element === element; });
    }

    function claimChallenge(id) {
        if (!STATE.dailyChallenges) return;
        const c = STATE.dailyChallenges.challenges.find(function (x) { return x.id === id; });
        if (!c || c.claimed || c.progress < c.target) return;
        c.claimed = true;
        addXP(c.reward_xp);
        saveDaily();
        renderDaily();
    }

    function renderDaily() {
        const grid = document.getElementById('daily-grid');
        const dateEl = document.getElementById('daily-date');
        if (!grid || !STATE.dailyChallenges) return;
        if (dateEl) dateEl.textContent = STATE.dailyChallenges.date;
        grid.innerHTML = STATE.dailyChallenges.challenges.map(function (c) {
            const pct = Math.min(100, (c.progress / c.target) * 100);
            const done = c.progress >= c.target;
            const btn = c.claimed
                ? '<button class="btn-claim claimed" disabled>CLAIMED</button>'
                : done
                    ? '<button class="btn-claim" onclick="window.BURBZ.claimChallenge(\'' + c.id + '\')">CLAIM +' + c.reward_xp + ' XP</button>'
                    : '<span class="challenge-reward">+' + c.reward_xp + ' XP</span>';
            const metaCls = c.meta && c.meta.element ? ' el-' + c.meta.element : '';
            return '<div class="challenge-card' + (c.claimed ? ' done' : '') + metaCls + '">' +
                '<div class="challenge-label">' + c.label + '</div>' +
                '<div class="challenge-progress">' + c.progress + ' / ' + c.target + '</div>' +
                '<div class="challenge-bar"><div class="challenge-bar-fill" style="width:' + pct + '%"></div></div>' +
                btn +
                '</div>';
        }).join('');
    }

    // ---- ACHIEVEMENTS ----
    const ACHIEVE_KEY = 'burbz_achievements';

    const ACHIEVEMENTS = [
        { id: 'first_capture',   label: 'First Feathers',     desc: 'Capture your first bird',         xp: 50,  test: function (s) { return s.flock.length >= 1; } },
        { id: 'flock_of_five',   label: 'Flock of Five',      desc: 'Capture 5 birds',                 xp: 100, test: function (s) { return s.flock.length >= 5; } },
        { id: 'ten_strong',      label: 'Ten Strong',         desc: 'Capture 10 birds',                xp: 200, test: function (s) { return s.flock.length >= 10; } },
        { id: 'full_spectrum',   label: 'Full Spectrum',      desc: 'Catch a bird of each element',    xp: 250, test: function (s) {
            const set = new Set();
            s.flock.forEach(function (b) {
                const sp = s.speciesData[b.species_id];
                if (sp && sp.element) set.add(sp.element);
            });
            return ['flame','sky','aqua','shadow','light','normal'].every(function (e) { return set.has(e); });
        } },
        { id: 'dex_halfway',     label: 'Half the Forest',    desc: 'Register half the species in the Index', xp: 300, test: function (s) {
            const total = Object.keys(s.speciesData || {}).length;
            const seen = new Set(s.flock.map(function (b) { return b.species_id; })).size;
            return total > 0 && seen >= Math.ceil(total / 2);
        } },
        { id: 'dex_complete',    label: 'Master Birder',      desc: 'Complete the Species Index',      xp: 800, test: function (s) {
            const total = Object.keys(s.speciesData || {}).length;
            const seen = new Set(s.flock.map(function (b) { return b.species_id; })).size;
            return total > 0 && seen >= total;
        } },
        { id: 'first_win',       label: 'First Blood',        desc: 'Win your first battle',           xp: 75,  test: function (s) { return (s.stats && s.stats.battleWins) >= 1; } },
        { id: 'ten_wins',        label: 'Ten Takedowns',      desc: 'Win 10 battles',                  xp: 200, test: function (s) { return (s.stats && s.stats.battleWins) >= 10; } },
        { id: 'ladder_climb',    label: 'Rung Climber',       desc: 'Clear the Rookie ladder tier',    xp: 150, test: function (s) {
            const w = (s.ladderProgress && s.ladderProgress.winsByTier && s.ladderProgress.winsByTier.rookie) || 0;
            return w >= 3;
        } },
        { id: 'champion_clear',  label: 'Champion',           desc: 'Clear the Champion ladder tier',  xp: 1000, test: function (s) {
            const w = (s.ladderProgress && s.ladderProgress.winsByTier && s.ladderProgress.winsByTier.champion) || 0;
            return w >= 5;
        } },
        { id: 'legendary_get',   label: 'Apex Predator',      desc: 'Capture a Legendary bird',        xp: 300, test: function (s) {
            return s.flock.some(function (b) { return b.rarity === 'legendary'; });
        } },
        { id: 'field_explorer',  label: 'Field Explorer',     desc: 'Find birds near you using eBird', xp: 120, test: function (s) {
            return !!(s.nearby && s.nearby.observations && s.nearby.observations.length > 0);
        } }
    ];

    function loadAchievements() {
        try {
            const s = localStorage.getItem(ACHIEVE_KEY);
            STATE.achievements = s ? JSON.parse(s) : { unlocked: {} };
        } catch (e) { STATE.achievements = { unlocked: {} }; }
        if (!STATE.achievements.unlocked) STATE.achievements.unlocked = {};
    }

    function saveAchievements() {
        try { localStorage.setItem(ACHIEVE_KEY, JSON.stringify(STATE.achievements)); } catch (e) {}
    }

    function evaluateAchievements() {
        if (!STATE.achievements) return;
        ACHIEVEMENTS.forEach(function (a) {
            if (STATE.achievements.unlocked[a.id]) return;
            try {
                if (a.test(STATE)) {
                    STATE.achievements.unlocked[a.id] = Date.now();
                    addXP(a.xp);
                    showAchievementToast(a);
                    saveAchievements();
                }
            } catch (e) { console.warn('Achievement check failed:', a.id, e); }
        });
    }

    function showAchievementToast(ach) {
        let host = document.getElementById('achievement-toasts');
        if (!host) {
            host = document.createElement('div');
            host.id = 'achievement-toasts';
            host.className = 'achievement-toasts';
            document.body.appendChild(host);
        }
        const el = document.createElement('div');
        el.className = 'achievement-toast';
        el.innerHTML =
            '<div class="ach-kicker">ACHIEVEMENT UNLOCKED</div>' +
            '<div class="ach-label">' + ach.label + '</div>' +
            '<div class="ach-desc">' + ach.desc + ' &middot; +' + ach.xp + ' XP</div>';
        host.appendChild(el);
        requestAnimationFrame(function () { el.classList.add('visible'); });
        setTimeout(function () {
            el.classList.remove('visible');
            setTimeout(function () { el.remove(); }, 500);
        }, 4200);
    }

    // ---- NEAR ME (eBird) ----
    const NEARBY_KEY = 'burbz_nearby';

    function loadNearby() {
        try {
            const s = localStorage.getItem(NEARBY_KEY);
            if (s) STATE.nearby = JSON.parse(s);
        } catch (e) {}
    }

    function saveNearby() {
        try { localStorage.setItem(NEARBY_KEY, JSON.stringify(STATE.nearby || {})); } catch (e) {}
    }

    function getEbirdKey() {
        try {
            const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
            return s.ebirdKey || '';
        } catch (e) { return ''; }
    }

    async function fetchNearbyBirds() {
        const status = document.getElementById('nearby-status');
        const key = getEbirdKey();
        if (!key) {
            status.textContent = 'Add an eBird API key in Settings first.';
            return;
        }
        if (!navigator.geolocation) {
            status.textContent = 'Geolocation not supported.';
            return;
        }
        status.textContent = 'Locating…';
        navigator.geolocation.getCurrentPosition(async (pos) => {
            const { latitude: lat, longitude: lng } = pos.coords;
            status.textContent = 'Fetching nearby observations…';
            try {
                const url = 'https://api.ebird.org/v2/data/obs/geo/recent?lat=' +
                    lat.toFixed(4) + '&lng=' + lng.toFixed(4) + '&dist=25&back=14&maxResults=60';
                const resp = await fetch(url, { headers: { 'X-eBirdApiToken': key } });
                if (!resp.ok) throw new Error('eBird ' + resp.status);
                const obs = await resp.json();
                STATE.nearby = {
                    fetchedAt: Date.now(),
                    lat: lat,
                    lng: lng,
                    observations: Array.isArray(obs) ? obs : []
                };
                saveNearby();
                biasIdProviderToNearby();
                renderNearby();
                status.textContent = 'Found ' + STATE.nearby.observations.length + ' species nearby.';
                evaluateAchievements();
            } catch (err) {
                console.warn('eBird fetch failed:', err);
                status.textContent = 'Could not fetch from eBird: ' + err.message;
            }
        }, (err) => {
            status.textContent = 'Location denied (' + err.message + ').';
        }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 });
    }

    function matchLocalSpeciesFromNearby() {
        if (!STATE.nearby || !STATE.nearby.observations || !STATE.speciesData) return [];
        const codesInFlock = {};
        Object.values(STATE.speciesData).forEach(sp => {
            if (sp.ebird_code) codesInFlock[sp.ebird_code] = sp.species_id;
        });
        const seen = new Set();
        const matches = [];
        STATE.nearby.observations.forEach(o => {
            const id = codesInFlock[o.speciesCode];
            if (id && !seen.has(id)) {
                seen.add(id);
                matches.push(id);
            }
        });
        return matches;
    }

    function biasIdProviderToNearby() {
        if (window.BurbzBirdID && typeof window.BurbzBirdID.setRecentSpecies === 'function') {
            window.BurbzBirdID.setRecentSpecies(matchLocalSpeciesFromNearby());
        }
    }

    function renderNearby() {
        const results = document.getElementById('nearby-results');
        if (!results) return;
        if (!STATE.nearby || !STATE.nearby.observations || STATE.nearby.observations.length === 0) {
            results.innerHTML = '';
            return;
        }
        const localMatches = new Set(matchLocalSpeciesFromNearby());
        const codeToLocal = {};
        Object.values(STATE.speciesData).forEach(sp => {
            if (sp.ebird_code) codeToLocal[sp.ebird_code] = sp;
        });
        const when = new Date(STATE.nearby.fetchedAt).toLocaleString();
        const header = '<div class="nearby-meta">Updated ' + when +
            ' &middot; ' + STATE.nearby.observations.length + ' species within 25 km</div>';
        const items = STATE.nearby.observations.slice(0, 40).map(o => {
            const local = codeToLocal[o.speciesCode];
            const playable = local && localMatches.has(local.species_id);
            const cls = 'nearby-card' + (playable ? ' playable' : '');
            const badge = playable ? '<span class="nearby-badge">IN GAME</span>' : '';
            const portrait = local
                ? getPortraitHTML(local.species_id, 'nearby-portrait')
                : '<div class="nearby-portrait placeholder"></div>';
            const seenAt = o.obsDt ? o.obsDt.replace('T', ' ') : '';
            const onClick = playable ? ' onclick="window.BURBZ.showSpeciesDetail(\'' + local.species_id + '\')"' : '';
            return '<div class="' + cls + '"' + onClick + '>' +
                portrait +
                '<div class="nearby-info">' +
                '<div class="nearby-name">' + (o.comName || 'Unknown') + badge + '</div>' +
                '<div class="nearby-latin">' + (o.sciName || '') + '</div>' +
                '<div class="nearby-when">' + seenAt + (o.howMany ? ' &middot; ' + o.howMany : '') + '</div>' +
                '</div>' +
                '</div>';
        }).join('');
        results.innerHTML = header + items;
    }

    function initNearby() {
        const btn = document.getElementById('btn-locate');
        if (btn) btn.addEventListener('click', fetchNearbyBirds);
    }

    // ---- SETTINGS ----
    const SETTINGS_KEY = 'burbz_settings';

    function loadSettings() {
        try {
            const s = localStorage.getItem(SETTINGS_KEY);
            if (!s) return;
            const cfg = JSON.parse(s);
            if (window.BurbzBirdID && cfg) {
                window.BurbzBirdID.config.soundProvider = cfg.soundProvider || 'mock';
                window.BurbzBirdID.config.imageProvider = cfg.imageProvider || 'mock';
                window.BurbzBirdID.config.apiEndpoint = cfg.apiEndpoint || '';
                window.BurbzBirdID.config.apiKey = cfg.apiKey || '';
            }
        } catch (e) { console.warn('Failed to load settings:', e); }
    }

    function saveSettings() {
        const cfg = {
            soundProvider: document.getElementById('cfg-sound-provider').value,
            imageProvider: document.getElementById('cfg-image-provider').value,
            apiEndpoint: document.getElementById('cfg-api-endpoint').value.trim(),
            apiKey: document.getElementById('cfg-api-key').value.trim(),
            ebirdKey: document.getElementById('cfg-ebird-key').value.trim()
        };
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(cfg));
        if (window.BurbzBirdID) {
            window.BurbzBirdID.config.soundProvider = cfg.soundProvider;
            window.BurbzBirdID.config.imageProvider = cfg.imageProvider;
            window.BurbzBirdID.config.apiEndpoint = cfg.apiEndpoint;
            window.BurbzBirdID.config.apiKey = cfg.apiKey;
        }
    }

    function populateSettingsForm() {
        const cfg = (window.BurbzBirdID && window.BurbzBirdID.config) || {};
        document.getElementById('cfg-sound-provider').value = cfg.soundProvider || 'mock';
        document.getElementById('cfg-image-provider').value = cfg.imageProvider || 'mock';
        document.getElementById('cfg-api-endpoint').value = cfg.apiEndpoint || '';
        document.getElementById('cfg-api-key').value = cfg.apiKey || '';
        document.getElementById('cfg-ebird-key').value = getEbirdKey();
    }

    function initSettings() {
        const modal = document.getElementById('settings-modal');
        const open = () => { populateSettingsForm(); modal.classList.remove('hidden'); };
        const close = () => modal.classList.add('hidden');

        document.getElementById('btn-settings').addEventListener('click', open);
        document.getElementById('settings-close').addEventListener('click', close);
        modal.querySelector('.modal-backdrop').addEventListener('click', close);
        document.getElementById('cfg-save').addEventListener('click', () => {
            saveSettings();
            close();
        });
        document.getElementById('cfg-reset').addEventListener('click', () => {
            if (!confirm('Reset all progress? This clears your flock, player level, ladder, and settings.')) return;
            [STORAGE_KEY, PLAYER_KEY, LADDER_KEY, SETTINGS_KEY, DAILY_KEY, NEARBY_KEY, WIKI_CACHE_KEY, ACHIEVE_KEY, STATS_KEY].forEach(k => localStorage.removeItem(k));
            location.reload();
        });
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
            STATE.recordedBlob = null;
            const btnRecord = document.getElementById('btn-record');
            btnRecord.classList.add('recording');
            btnRecord.querySelector('span').textContent = 'STOP';
            document.getElementById('sound-status').textContent = 'Listening...';

            // MediaRecorder captures actual audio bytes for provider upload
            const chunks = [];
            let mimeType = '';
            const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];
            for (const c of candidates) {
                if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(c)) {
                    mimeType = c;
                    break;
                }
            }
            try {
                STATE.mediaRecorder = mimeType
                    ? new MediaRecorder(STATE.mediaStream, { mimeType: mimeType })
                    : new MediaRecorder(STATE.mediaStream);
                STATE.mediaRecorder.ondataavailable = (e) => {
                    if (e.data && e.data.size > 0) chunks.push(e.data);
                };
                STATE.mediaRecorder.onstop = () => {
                    if (chunks.length > 0) {
                        STATE.recordedBlob = new Blob(chunks, { type: mimeType || 'audio/webm' });
                    }
                };
                STATE.mediaRecorder.start();
            } catch (recErr) {
                console.warn('MediaRecorder unavailable:', recErr);
            }

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
        const btnRecord = document.getElementById('btn-record');
        btnRecord.classList.remove('recording');
        btnRecord.querySelector('span').textContent = 'RECORD';
        document.getElementById('sound-status').textContent = 'Analyzing...';

        // MediaRecorder.stop is async; capture blob then run identification
        const finish = () => {
            if (STATE.mediaStream) {
                STATE.mediaStream.getTracks().forEach(t => t.stop());
                STATE.mediaStream = null;
            }
            if (STATE.audioCtx) {
                STATE.audioCtx.close();
                STATE.audioCtx = null;
            }
            performBirdID('sound', STATE.recordedBlob);
        };

        if (STATE.mediaRecorder && STATE.mediaRecorder.state !== 'inactive') {
            STATE.mediaRecorder.addEventListener('stop', finish, { once: true });
            try { STATE.mediaRecorder.stop(); } catch (e) { finish(); }
            STATE.mediaRecorder = null;
        } else {
            finish();
        }
    }

    function processAudioFile(file) {
        document.getElementById('sound-status').textContent = 'Analyzing ' + file.name + '...';
        performBirdID('sound', file);
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
            performBirdID('image', file);
        };
        reader.readAsDataURL(file);
    }

    let _lastAudioURL = null;
    function setRecordingPlayback(blob) {
        const wrap = document.getElementById('sound-visualizer');
        if (!wrap) return;
        let existing = document.getElementById('recording-player');
        if (existing) existing.remove();
        if (_lastAudioURL) { URL.revokeObjectURL(_lastAudioURL); _lastAudioURL = null; }
        if (!blob) return;
        _lastAudioURL = URL.createObjectURL(blob);
        const audio = document.createElement('audio');
        audio.id = 'recording-player';
        audio.controls = true;
        audio.src = _lastAudioURL;
        audio.preload = 'metadata';
        wrap.insertAdjacentElement('afterend', audio);
    }

    // ---- BIRD IDENTIFICATION (routes through BurbzBirdID provider) ----
    async function performBirdID(sourceType, blob) {
        if (sourceType === 'sound' && blob) setRecordingPlayback(blob);
        let result;
        try {
            if (window.BurbzBirdID) {
                result = sourceType === 'sound'
                    ? await window.BurbzBirdID.identifySound(blob || null)
                    : await window.BurbzBirdID.identifyImage(blob || null);
            }
        } catch (err) {
            console.warn('BurbzBirdID failed:', err);
        }
        if (!result || !result.species_id || !STATE.speciesData[result.species_id]) {
            const ids = Object.keys(STATE.speciesData);
            result = { species_id: ids[Math.floor(Math.random() * ids.length)], confidence: 0.6 };
        }
        const speciesId = result.species_id;
        const species = STATE.speciesData[speciesId];
        const confidence = result.confidence;

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
        recordCapture(bird);
        showCaptureScreen(bird);
    }

    function showCaptureScreen(bird) {
        const overlay = document.getElementById('capture-overlay');
        const species = STATE.speciesData[bird.species_id];

        document.getElementById('capture-card').innerHTML = getPortraitHTML(bird.species_id, 'capture-portrait');
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
        captureBird,
        challengeTier,
        claimChallenge,
        showSpeciesDetail
    };

    // ---- INIT ----
    async function init() {
        loadState();
        await loadSpeciesData();
        if (window.BurbzBirdID) window.BurbzBirdID.setSpeciesData(STATE.speciesData);
        loadSettings();
        loadDaily();
        ensureDailyChallenges();
        loadNearby();
        biasIdProviderToNearby();
        loadAchievements();
        evaluateAchievements();
        updatePlayerHUD();
        initTabs();
        initFlockFilters();
        initModal();
        initSettings();
        initSoundID();
        initImageID();
        initBattle();
        initNearby();
        renderFlockView();
        renderDaily();

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
        document.getElementById('btn-find-battle').addEventListener('click', () => startBattle(null));
        document.getElementById('btn-battle-again').addEventListener('click', () => {
            hideBattleScreens();
            renderBattleSelect();
        });
        document.getElementById('btn-back-flock').addEventListener('click', () => {
            hideBattleScreens();
            switchTab('flock');
        });

        // Mode toggle (Quick Match | Ladder)
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                STATE.battleMode = btn.dataset.mode;
                renderBattleSelect();
            });
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

    // ---- LADDER ----
    function tierUnlocked(tier) {
        if (!tier) return false;
        if (STATE.playerLevel >= (tier.unlock_level || 1)) return true;
        // Also unlock if previous tier cleared
        const idx = STATE.ladderTiers.indexOf(tier);
        if (idx > 0) {
            const prev = STATE.ladderTiers[idx - 1];
            const prevWins = (STATE.ladderProgress.winsByTier || {})[prev.id] || 0;
            if (prevWins >= prev.wins_to_clear) return true;
        }
        if (idx === 0) return true;
        return false;
    }

    function renderLadder() {
        const wrap = document.getElementById('ladder-tiers');
        if (!wrap || !STATE.ladderTiers) return;
        wrap.innerHTML = STATE.ladderTiers.map(tier => {
            const wins = (STATE.ladderProgress.winsByTier || {})[tier.id] || 0;
            const unlocked = tierUnlocked(tier);
            const cleared = wins >= tier.wins_to_clear;
            const cls = ['tier-card', 'tier-' + tier.id];
            if (!unlocked) cls.push('locked');
            if (cleared) cls.push('cleared');
            const btn = unlocked
                ? `<button class="btn-tier" onclick="window.BURBZ.challengeTier('${tier.id}')">${cleared ? 'REPLAY' : 'CHALLENGE'}</button>`
                : `<span class="tier-lock">LV ${tier.unlock_level} REQUIRED</span>`;
            return `
                <div class="${cls.join(' ')}">
                    <div class="tier-head">
                        <span class="tier-name">${tier.name}</span>
                        <span class="tier-reward">+${tier.reward_xp} XP</span>
                    </div>
                    <div class="tier-progress">${wins} / ${tier.wins_to_clear} wins</div>
                    <div class="tier-bar"><div class="tier-bar-fill" style="width:${Math.min(100, (wins / tier.wins_to_clear) * 100)}%"></div></div>
                    ${btn}
                </div>`;
        }).join('');
    }

    function challengeTier(tierId) {
        const tier = STATE.ladderTiers.find(t => t.id === tierId);
        if (!tier || !tierUnlocked(tier)) return;
        if (!STATE.selectedBattleBird) {
            alert('Pick a fighter first!');
            return;
        }
        startBattle(tier);
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
        const ladderPanel = document.getElementById('ladder-panel');
        const isLadder = STATE.battleMode === 'ladder';

        if (STATE.flock.length === 0) {
            roster.innerHTML = '';
            empty.classList.remove('hidden');
            fightBtn.classList.add('hidden');
            if (ladderPanel) ladderPanel.classList.add('hidden');
            return;
        }

        empty.classList.add('hidden');
        STATE.selectedBattleBird = null;

        roster.innerHTML = STATE.flock.map(bird => {
            const species = STATE.speciesData[bird.species_id];
            const el = species && species.element ? species.element : 'normal';
            return `
                <div class="roster-card element-${el}" data-id="${bird.id}">
                    <div class="card-art">${getPortraitHTML(bird.species_id, 'roster-portrait')}</div>
                    <div class="card-name">${bird.common_name}</div>
                    <div class="card-level">LV ${bird.level}</div>
                    <span class="card-element el-${el}">${el.toUpperCase()}</span>
                </div>
            `;
        }).join('');

        roster.querySelectorAll('.roster-card').forEach(card => {
            card.addEventListener('click', () => {
                roster.querySelectorAll('.roster-card').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
                STATE.selectedBattleBird = card.dataset.id;
                if (!isLadder) fightBtn.disabled = false;
            });
        });

        if (isLadder) {
            fightBtn.classList.add('hidden');
            if (ladderPanel) ladderPanel.classList.remove('hidden');
            renderLadder();
        } else {
            fightBtn.classList.remove('hidden');
            fightBtn.disabled = true;
            if (ladderPanel) ladderPanel.classList.add('hidden');
        }
    }

    function generateOpponent(tier) {
        const speciesIds = Object.keys(STATE.speciesData);
        const speciesId = speciesIds[Math.floor(Math.random() * speciesIds.length)];
        const species = STATE.speciesData[speciesId];
        const rarity = rollRarity();
        const offset = tier && typeof tier.level_offset === 'number' ? tier.level_offset : 0;
        const baseLevel = STATE.playerLevel + offset + Math.floor(Math.random() * 3) - 1;
        const level = Math.max(1, baseLevel);
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

    function startBattle(tier) {
        const playerBird = STATE.flock.find(b => b.id === STATE.selectedBattleBird);
        if (!playerBird) return;

        const opponent = generateOpponent(tier);
        const playerMaxHP = playerBird.stats.hp * 3 + 50;
        const oppMaxHP = opponent.stats.hp * 3 + 50;

        STATE.battleState = {
            player: { ...playerBird, maxHP: playerMaxHP, currentHP: playerMaxHP },
            opponent: { ...opponent, maxHP: oppMaxHP, currentHP: oppMaxHP },
            turnInProgress: false,
            round: 0,
            tier: tier || null
        };

        // Show VS screen
        document.getElementById('battle-select').style.display = 'none';
        showVSScreen(playerBird, opponent);
    }

    function showVSScreen(player, opponent) {
        const vs = document.getElementById('battle-vs');
        document.getElementById('vs-card-player').innerHTML = getPortraitHTML(player.species_id, 'vs-portrait');
        document.getElementById('vs-name-player').textContent = player.common_name;
        document.getElementById('vs-card-opponent').innerHTML = getPortraitHTML(opponent.species_id, 'vs-portrait');
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
        document.getElementById('player-sprite').innerHTML = getPortraitHTML(bs.player.species_id, 'arena-portrait');
        document.getElementById('opp-sprite').innerHTML = getPortraitHTML(bs.opponent.species_id, 'arena-portrait');

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
        if (move.type === 'status') return { dmg: 0, mult: 1 };
        const accuracy = Math.random() * 100 <= move.accuracy;
        if (!accuracy) return { dmg: -1, mult: 1 }; // miss
        const atkStat = move.type === 'special' ? attacker.stats.spl : attacker.stats.atk;
        const defStat = move.type === 'special' ? defender.stats.spl : defender.stats.def;
        const baseDmg = ((2 * attacker.level / 5 + 2) * move.power * atkStat / defStat) / 50 + 2;
        const variance = 0.85 + Math.random() * 0.3;
        const crit = Math.random() < 0.1 ? 1.5 : 1;
        const defenderElement = STATE.speciesData[defender.species_id]
            ? STATE.speciesData[defender.species_id].element
            : null;
        const mult = typeMultiplier(move.element, defenderElement);
        return { dmg: Math.floor(baseDmg * variance * crit * mult), mult: mult };
    }

    function applyStatusEffect(user, target, move) {
        if (!move.effects || !Array.isArray(move.effects) || move.effects.length === 0) {
            return 'Stats boosted!';
        }
        const labels = [];
        move.effects.forEach(function (effect) {
            const subject = effect.target === 'opponent' ? target : user;
            if (effect.action === 'heal') {
                const heal = Math.floor(subject.maxHP * (effect.percent || 0.25));
                subject.currentHP = Math.min(subject.maxHP, subject.currentHP + heal);
                labels.push(effect.label || ('HEALED ' + heal + ' HP!'));
                return;
            }
            const keys = Array.isArray(effect.stats) ? effect.stats : (effect.stat ? [effect.stat] : []);
            const mult = typeof effect.multiplier === 'number' ? effect.multiplier : 1;
            keys.forEach(function (k) {
                if (typeof subject.stats[k] === 'number') {
                    subject.stats[k] = Math.max(1, Math.floor(subject.stats[k] * mult));
                }
            });
            if (keys.length > 0) labels.push(effect.label || 'Stats changed!');
        });
        return labels.length > 0 ? labels.join(' ') : 'Stats boosted!';
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
        recordElementMove(move.element);

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
            const result = calcDamage(bs.player, bs.opponent, move);
            if (result.dmg === -1) {
                document.getElementById('log-text').textContent = 'It missed!';
                showDamageNumber('opponent', 0, 'miss');
            } else {
                bs.opponent.currentHP -= result.dmg;
                showHitFlash();
                document.getElementById('opp-sprite').classList.add('hit-anim');
                showDamageNumber('opponent', result.dmg, 'damage');
                const eff = effectivenessLabel(result.mult);
                if (eff) {
                    setTimeout(() => { document.getElementById('log-text').textContent = eff; }, 400);
                }
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
            const result = calcDamage(bs.opponent, bs.player, move);
            if (result.dmg === -1) {
                document.getElementById('log-text').textContent = 'It missed!';
                showDamageNumber('player', 0, 'miss');
            } else {
                bs.player.currentHP -= result.dmg;
                showHitFlash();
                document.getElementById('player-sprite').classList.add('hit-anim');
                showDamageNumber('player', result.dmg, 'damage');
                const eff = effectivenessLabel(result.mult);
                if (eff) {
                    setTimeout(() => { document.getElementById('log-text').textContent = eff; }, 400);
                }
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
            recordBattleWin(bs.tier);
            const xpGain = 30 + bs.opponent.level * 10;
            resultDetails.textContent = bs.player.common_name + ' defeated ' + bs.opponent.common_name + '!';
            resultRewards.innerHTML = `
                <div class="reward-item">+${xpGain} XP</div>
                <div class="reward-item">Round ${bs.round}</div>
            `;
            addXP(xpGain);

            // Ladder progression
            if (bs.tier) {
                const tier = bs.tier;
                if (!STATE.ladderProgress.winsByTier) STATE.ladderProgress.winsByTier = {};
                const prev = STATE.ladderProgress.winsByTier[tier.id] || 0;
                const next = prev + 1;
                STATE.ladderProgress.winsByTier[tier.id] = next;
                resultRewards.innerHTML += `<div class="reward-item">${tier.name.toUpperCase()} ${next}/${tier.wins_to_clear}</div>`;
                if (prev < tier.wins_to_clear && next >= tier.wins_to_clear) {
                    addXP(tier.reward_xp);
                    resultRewards.innerHTML += `<div class="reward-item tier-clear-reward">${tier.name.toUpperCase()} CLEARED! +${tier.reward_xp} XP</div>`;
                }
                saveState();
            }

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

})();
