/* ============================================
   BURBZ - Bird Identification Provider
   Swappable mock/API backend for sound & image ID
   ============================================ */

(function () {
    'use strict';

    // ---- PRIVATE STATE ----
    let _speciesById = {};

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
        const ids = Object.keys(_speciesById);
        if (ids.length === 0) return null;
        return ids[Math.floor(Math.random() * ids.length)];
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

    // ---- API IDENTIFIER ----
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
                confidence: typeof data.confidence === 'number' ? data.confidence : 0.6
            };
        } catch (err) {
            console.warn('BurbzBirdID: API fetch failed, falling back to mock.', err);
            return mockIdentify();
        }
    }

    // ---- PUBLIC API ----
    window.BurbzBirdID = {
        config: {
            soundProvider: 'mock',
            imageProvider: 'mock',
            apiEndpoint: '',
            apiKey: ''
        },

        setSpeciesData: function (speciesById) {
            _speciesById = speciesById || {};
        },

        identifySound: async function (audioBlob) {
            if (this.config.soundProvider === 'api') {
                return apiIdentify(audioBlob, 'audio');
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
