/* ============================================
   BURBZ - Bird Identification Provider
   Swappable mock/API backend for sound & image ID
   ============================================ */

(function () {
    'use strict';

    // ---- PRIVATE STATE ----
    let _speciesById = {};
    let _recentSpeciesIds = [];

    const RARITY_BASE = {
        common: 0.75,
        uncommon: 0.65,
        rare: 0.55,
        legendary: 0.45
    };

    // ---- UTILITY ----
    function delay(ms) {
        return new Promise(function (r) { setTimeout(r, ms); });
    }

    function randomDelay() {
        return 800 + Math.floor(Math.random() * 700); // 800-1500ms
    }

    function pickRandomSpeciesId() {
        // Prefer recently-observed local species when available; fall back to full pool
        const recent = _recentSpeciesIds.filter(id => _speciesById[id]);
        const pool = recent.length > 0 && Math.random() < 0.8 ? recent : Object.keys(_speciesById);
        if (pool.length === 0) return null;
        return pool[Math.floor(Math.random() * pool.length)];
    }

    function rollConfidence(speciesId) {
        const species = _speciesById[speciesId];
        const tier = species && species.rarity_tier ? species.rarity_tier : 'common';
        const base = RARITY_BASE[tier] || 0.6;
        return Math.min(0.99, base + Math.random() * 0.25);
    }

    // ---- MOCK IDENTIFIER ----
    async function mockIdentify() {
        await delay(randomDelay());
        const speciesId = pickRandomSpeciesId();
        if (!speciesId) {
            return { species_id: null, confidence: 0 };
        }
        return {
            species_id: speciesId,
            confidence: rollConfidence(speciesId)
        };
    }

    // ---- API IDENTIFIER (custom user-supplied endpoint) ----
    async function apiIdentify(blob, fieldName) {
        const cfg = window.BurbzBirdID.config;
        if (!cfg.apiEndpoint) {
            console.warn('BurbzBirdID: apiEndpoint not set, falling back to mock.');
            return mockIdentify();
        }
        try {
            const form = new FormData();
            form.append(fieldName, blob);
            const headers = {};
            if (cfg.apiKey) headers['X-API-Key'] = cfg.apiKey;

            const resp = await fetch(cfg.apiEndpoint, {
                method: 'POST',
                headers: headers,
                body: form
            });
            if (!resp.ok) {
                console.warn('BurbzBirdID: API responded ' + resp.status + ', falling back to mock.');
                return mockIdentify();
            }
            const data = await resp.json();
            if (!data || !data.species_id || !_speciesById[data.species_id]) {
                console.warn('BurbzBirdID: API returned unknown species, falling back to mock.');
                return mockIdentify();
            }
            return {
                species_id: data.species_id,
                confidence: typeof data.confidence === 'number' ? data.confidence : 0.6,
                reasoning: data.reasoning || ''
            };
        } catch (err) {
            console.warn('BurbzBirdID: API fetch failed, falling back to mock.', err);
            return mockIdentify();
        }
    }

    // ---- BUILT-IN: Claude-vision-on-spectrogram for sound ----
    async function claudeSpectrogramIdentify(audioBlob, hint) {
        if (!window.BurbzSpectrogram || typeof window.BurbzSpectrogram.generate !== 'function') {
            throw new Error('Spectrogram module not loaded');
        }
        if (!audioBlob) throw new Error('No audio blob to identify');

        const spectroBlob = await window.BurbzSpectrogram.generate(audioBlob, {
            width: 800, height: 480, fftSize: 1024
        });

        const speciesPayload = Object.values(_speciesById).map(function (sp) {
            return {
                species_id: sp.species_id,
                common_name: sp.common_name,
                latin_name: sp.latin_name,
                element: sp.element,
                biome: sp.biome,
                rarity_tier: sp.rarity_tier
            };
        });

        const form = new FormData();
        form.append('spectrogram', spectroBlob, 'spectrogram.png');
        form.append('species', JSON.stringify(speciesPayload));
        form.append('nearby', JSON.stringify((hint && hint.nearby) || _recentSpeciesIds || []));
        if (hint && hint.region) form.append('region', hint.region);
        form.append('recorded_at', new Date().toISOString());

        const endpoint = (window.BurbzBirdID.config && window.BurbzBirdID.config.identifySoundUrl) || '/api/identify-sound';
        const resp = await fetch(endpoint, { method: 'POST', body: form });
        if (!resp.ok) {
            const txt = await resp.text().catch(function () { return ''; });
            const err = new Error('identify-sound responded ' + resp.status + ' — ' + txt);
            err.status = resp.status;
            throw err;
        }
        const data = await resp.json();
        if (!data || !data.species_id || !_speciesById[data.species_id]) {
            throw new Error('Server returned an unknown species_id');
        }
        return {
            species_id: data.species_id,
            confidence: typeof data.confidence === 'number' ? data.confidence : 0.5,
            reasoning: data.reasoning || ''
        };
    }

    // ---- PUBLIC API ----
    window.BurbzBirdID = {
        config: {
            // Defaults: real Claude-vision spectrogram pipeline for sound,
            // mock for image (image classifier coming next).
            soundProvider: 'claude-spectrogram',
            imageProvider: 'mock',
            identifySoundUrl: '/api/identify-sound',
            apiEndpoint: '',
            apiKey: ''
        },

        setSpeciesData: function (speciesById) {
            _speciesById = speciesById || {};
        },

        // Bias mock identifier toward species known to be nearby (from eBird)
        setRecentSpecies: function (speciesIds) {
            _recentSpeciesIds = Array.isArray(speciesIds) ? speciesIds.slice() : [];
        },

        identifySound: async function (audioBlob) {
            const mode = this.config.soundProvider;
            if (mode === 'api') return apiIdentify(audioBlob, 'audio');
            if (mode === 'claude-spectrogram') {
                return claudeSpectrogramIdentify(audioBlob, {
                    nearby: _recentSpeciesIds
                });
            }
            return mockIdentify();
        },

        identifyImage: async function (imageBlob) {
            if (this.config.imageProvider === 'api') {
                return apiIdentify(imageBlob, 'image');
            }
            return mockIdentify();
        }
    };

})();
