/* ============================================
   BURBZ - In-Browser Acoustic Classifier
   --------------------------------------------
   Real signal-based bird ID, no API, no key,
   no cost. Scores each species' acoustic
   profile against features extracted from the
   recording. Boosts heavily by eBird "nearby"
   priors so the classifier behaves better in
   the field.
   ============================================ */

(function () {
    'use strict';

    function inRange(v, range) {
        return range && v >= range[0] && v <= range[1];
    }

    function distanceFromRange(v, range) {
        if (!range) return 0;
        if (v >= range[0] && v <= range[1]) return 0;
        return Math.min(Math.abs(v - range[0]), Math.abs(v - range[1]));
    }

    // Score how well features match a single species' acoustic_profile.
    // Returns a positive number; higher = better fit.
    function scoreSpecies(features, profile) {
        if (!profile) return 0.5;

        let score = 1.0;

        // 1. Peak frequency band
        if (profile.peak_freq_hz) {
            if (inRange(features.peak_freq_hz, profile.peak_freq_hz)) {
                score *= 1.6;
            } else {
                const d = distanceFromRange(features.peak_freq_hz, profile.peak_freq_hz);
                // Penalty falls off slowly: 0 Hz off → 1x, 5 kHz off → ~0.15x
                score *= Math.max(0.1, 1 - d / 5000);
            }
        }

        // 2. Vocal type (driven by harshness + modulation features)
        const t = profile.vocal_type;
        const harsh = features.harshness;
        const tonal = 1 - harsh;
        const modRate = features.modulation_rate_hz;
        const transient = features.transient_rate_hz;
        if (t === 'tonal')   score *= tonal > 0.55 ? 1.5 : 0.7;
        if (t === 'harsh')   score *= harsh > 0.55 ? 1.5 : 0.7;
        if (t === 'complex') score *= modRate > 4 ? 1.6 : 0.8;
        if (t === 'drumming') score *= (transient > 7 || modRate > 8) ? 2.0 : 0.4;
        if (t === 'low_hoot') score *= features.peak_freq_hz < 900 ? 2.0 : 0.4;

        // 3. Duration class
        const dur = features.duration_active_s;
        const dc = profile.duration_class;
        if (dc === 'short')  score *= dur < 1.2 ? 1.3 : 0.85;
        if (dc === 'medium') score *= (dur >= 1.0 && dur <= 4.0) ? 1.3 : 0.85;
        if (dc === 'long')   score *= dur > 3.0 ? 1.4 : 0.8;

        // 4. Modulation rate alignment
        const mod = profile.modulation;
        if (mod === 'none')      score *= modRate < 1.0 ? 1.2 : 0.85;
        if (mod === 'slow')      score *= (modRate >= 0.5 && modRate <= 4) ? 1.2 : 0.9;
        if (mod === 'fast')      score *= (modRate >= 3 && modRate <= 10) ? 1.3 : 0.85;
        if (mod === 'very_fast') score *= modRate > 8 ? 1.5 : 0.7;

        return score;
    }

    function softmax(scores) {
        const max = Math.max.apply(null, scores);
        const exps = scores.map(function (s) { return Math.exp((s - max) * 1.5); });
        const sum = exps.reduce(function (a, b) { return a + b; }, 0);
        return exps.map(function (e) { return sum > 0 ? e / sum : 0; });
    }

    /**
     * Run the classifier over all species.
     * @param {object} features  result of BurbzSpectrogram.analyze()
     * @param {object} speciesById   {species_id: speciesDef}
     * @param {string[]} nearbyIds   species ids known to be nearby (eBird)
     * @returns {{species_id, confidence, reasoning, top: [{species_id, prob}]}}
     */
    function classify(features, speciesById, nearbyIds) {
        const nearbySet = new Set(nearbyIds || []);
        const ids = Object.keys(speciesById);

        const rawScores = ids.map(function (id) {
            const sp = speciesById[id];
            let s = scoreSpecies(features, sp.acoustic_profile);
            if (nearbySet.has(id)) s *= 2.5;            // strong local prior
            return s;
        });

        // Confidence = softmax over the top species scores
        const probs = softmax(rawScores.map(function (s) { return Math.log(Math.max(1e-3, s)); }));
        let bestIdx = 0;
        for (let i = 1; i < probs.length; i++) {
            if (probs[i] > probs[bestIdx]) bestIdx = i;
        }
        const top = ids
            .map(function (id, i) { return { species_id: id, prob: probs[i] }; })
            .sort(function (a, b) { return b.prob - a.prob; })
            .slice(0, 3);

        const winner = speciesById[ids[bestIdx]];
        const reasoning = describe(features, winner);

        return {
            species_id: ids[bestIdx],
            confidence: Math.min(0.95, probs[bestIdx]),
            reasoning: reasoning,
            top: top
        };
    }

    function describe(features, species) {
        const parts = [];
        const fHz = Math.round(features.peak_freq_hz);
        parts.push('peak ~' + (fHz >= 1000 ? (fHz / 1000).toFixed(1) + ' kHz' : fHz + ' Hz'));
        if (features.harshness > 0.55) parts.push('harsh / broadband');
        else if (features.harshness < 0.4) parts.push('clean tonal');
        if (features.modulation_rate_hz > 6) parts.push('rapid frequency modulation');
        else if (features.modulation_rate_hz < 1) parts.push('steady pitch');
        if (features.transient_rate_hz > 8) parts.push('drumming / staccato');
        const note = species && species.acoustic_profile ? ' — matches ' + species.common_name + ' profile' : '';
        return parts.join(', ') + note;
    }

    window.BurbzAcoustic = {
        classify: classify,
        scoreSpecies: scoreSpecies
    };
})();
