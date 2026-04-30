/* ============================================
   BURBZ - Spectrogram Generator
   Decode an audio blob in the browser, run a
   short-time FFT, and paint a log-frequency
   spectrogram to a PNG blob suitable for vision
   ============================================ */

(function () {
    'use strict';

    // ---- Radix-2 in-place Cooley-Tukey FFT ----
    function fft(re, im) {
        const n = re.length;
        // bit-reversal permutation
        for (let i = 1, j = 0; i < n; i++) {
            let bit = n >> 1;
            for (; (j & bit) !== 0; bit >>= 1) {
                j ^= bit;
            }
            j ^= bit;
            if (i < j) {
                const tr = re[i]; re[i] = re[j]; re[j] = tr;
                const ti = im[i]; im[i] = im[j]; im[j] = ti;
            }
        }
        // butterflies
        for (let len = 2; len <= n; len <<= 1) {
            const half = len >> 1;
            const ang = -2 * Math.PI / len;
            const wRe0 = Math.cos(ang);
            const wIm0 = Math.sin(ang);
            for (let i = 0; i < n; i += len) {
                let curRe = 1, curIm = 0;
                for (let k = 0; k < half; k++) {
                    const tRe = re[i + k + half] * curRe - im[i + k + half] * curIm;
                    const tIm = re[i + k + half] * curIm + im[i + k + half] * curRe;
                    re[i + k + half] = re[i + k] - tRe;
                    im[i + k + half] = im[i + k] - tIm;
                    re[i + k] += tRe;
                    im[i + k] += tIm;
                    const nRe = curRe * wRe0 - curIm * wIm0;
                    curIm = curRe * wIm0 + curIm * wRe0;
                    curRe = nRe;
                }
            }
        }
    }

    function decodeAudio(blob) {
        return new Promise(function (resolve, reject) {
            const reader = new FileReader();
            reader.onerror = function () { reject(reader.error); };
            reader.onload = function () {
                const ctx = new (window.AudioContext || window.webkitAudioContext)();
                ctx.decodeAudioData(
                    reader.result,
                    function (buf) { ctx.close(); resolve(buf); },
                    function (err) { ctx.close(); reject(err || new Error('decodeAudioData failed')); }
                );
            };
            reader.readAsArrayBuffer(blob);
        });
    }

    // viridis-ish colormap (purple → green → yellow)
    function colormap(v) {
        v = Math.max(0, Math.min(1, v));
        const stops = [
            [13, 8, 135],
            [84, 2, 163],
            [156, 23, 158],
            [205, 55, 124],
            [237, 104, 80],
            [251, 159, 58],
            [253, 217, 60],
            [240, 249, 33]
        ];
        const t = v * (stops.length - 1);
        const i = Math.floor(t);
        const frac = t - i;
        const a = stops[i];
        const b = stops[Math.min(stops.length - 1, i + 1)];
        return [
            Math.round(a[0] + (b[0] - a[0]) * frac),
            Math.round(a[1] + (b[1] - a[1]) * frac),
            Math.round(a[2] + (b[2] - a[2]) * frac)
        ];
    }

    /**
     * Build a log-frequency spectrogram of an audio blob.
     * @param {Blob} blob   Audio blob (any format the browser can decode)
     * @param {object} opts { width, height, fftSize, mimeType }
     * @returns {Promise<Blob>} PNG image blob
     */
    async function generateSpectrogramBlob(blob, opts) {
        opts = opts || {};
        const width = opts.width || 800;
        const height = opts.height || 480;
        const fftSize = opts.fftSize || 1024;
        const mimeType = opts.mimeType || 'image/png';

        const audio = await decodeAudio(blob);
        const sampleRate = audio.sampleRate;
        // Mono mix of all channels
        const len = audio.length;
        const samples = new Float32Array(len);
        for (let c = 0; c < audio.numberOfChannels; c++) {
            const ch = audio.getChannelData(c);
            for (let i = 0; i < len; i++) samples[i] += ch[i];
        }
        if (audio.numberOfChannels > 1) {
            const inv = 1 / audio.numberOfChannels;
            for (let i = 0; i < len; i++) samples[i] *= inv;
        }

        // STFT parameters
        const hop = Math.max(1, Math.floor((len - fftSize) / width));
        const bins = fftSize >> 1;
        // Hann window
        const hann = new Float32Array(fftSize);
        for (let i = 0; i < fftSize; i++) {
            hann[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (fftSize - 1)));
        }

        // We'll render straight to canvas to avoid storing the full spectrogram
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const cctx = canvas.getContext('2d');
        cctx.fillStyle = '#000010';
        cctx.fillRect(0, 0, width, height);
        const img = cctx.createImageData(1, height);

        // Log-frequency mapping: y=0 is high freq, y=height is low freq
        // Map each y-pixel to a bin via log scale (skip DC bin)
        const minFreq = 200;   // Hz
        const maxFreq = Math.min(sampleRate / 2, 10000);
        const logMin = Math.log(minFreq);
        const logMax = Math.log(maxFreq);
        const binFreq = sampleRate / fftSize;
        const yToBin = new Int32Array(height);
        for (let y = 0; y < height; y++) {
            const t = 1 - y / (height - 1); // top = high freq
            const f = Math.exp(logMin + t * (logMax - logMin));
            yToBin[y] = Math.max(1, Math.min(bins - 1, Math.round(f / binFreq)));
        }

        // Working FFT buffers
        const re = new Float64Array(fftSize);
        const im = new Float64Array(fftSize);

        // Compute frame-by-frame
        for (let x = 0; x < width; x++) {
            const start = x * hop;
            if (start + fftSize > len) {
                // Pad with silence: fill remaining columns and break
                for (let xx = x; xx < width; xx++) {
                    cctx.putImageData(img, xx, 0);
                }
                break;
            }
            for (let i = 0; i < fftSize; i++) {
                re[i] = samples[start + i] * hann[i];
                im[i] = 0;
            }
            fft(re, im);

            for (let y = 0; y < height; y++) {
                const k = yToBin[y];
                const mag = Math.sqrt(re[k] * re[k] + im[k] * im[k]);
                // log-scale magnitude, normalize to 0..1
                const db = 20 * Math.log10(mag + 1e-9);
                // db typically ranges -100..40 for typical speech/birds; normalize to 0..1
                const v = Math.max(0, Math.min(1, (db + 80) / 80));
                const c = colormap(v);
                const off = y * 4;
                img.data[off + 0] = c[0];
                img.data[off + 1] = c[1];
                img.data[off + 2] = c[2];
                img.data[off + 3] = 255;
            }
            cctx.putImageData(img, x, 0);
        }

        // Axis annotations (small, so Claude has frequency context)
        cctx.fillStyle = 'rgba(255,255,255,0.7)';
        cctx.font = '12px sans-serif';
        const labelFreqs = [200, 500, 1000, 2000, 4000, 8000];
        for (const f of labelFreqs) {
            if (f < minFreq || f > maxFreq) continue;
            const t = (Math.log(f) - logMin) / (logMax - logMin);
            const y = (1 - t) * (height - 1);
            cctx.fillRect(0, y, 30, 1);
            cctx.fillText((f >= 1000 ? (f / 1000) + 'k' : f) + 'Hz', 32, y + 4);
        }
        cctx.fillStyle = 'rgba(255,255,255,0.55)';
        cctx.fillText('time →', width - 50, height - 6);

        return new Promise(function (resolve, reject) {
            canvas.toBlob(function (b) {
                if (b) resolve(b); else reject(new Error('canvas.toBlob failed'));
            }, mimeType, 0.92);
        });
    }

    window.BurbzSpectrogram = {
        generate: generateSpectrogramBlob,
        analyze: analyzeAudioBlob
    };

    /**
     * Extract acoustic features from a recording suitable for classification.
     * Returns a Promise<features> with:
     *   peak_freq_hz       — frequency bin with the most aggregated energy
     *   freq_range_hz      — [low, high] band that contains 80% of energy
     *   duration_active_s  — seconds of "active" audio (above silence threshold)
     *   modulation_rate_hz — how often the dominant frequency changes per second
     *   harshness          — 0..1 fraction of energy outside the dominant band (noisy = high)
     *   transient_rate_hz  — rate of sharp loudness onsets per second (drumming = high)
     *   loudness_rms       — average RMS (0..1)
     */
    async function analyzeAudioBlob(blob, opts) {
        opts = opts || {};
        const fftSize = opts.fftSize || 1024;
        const audio = await decodeAudio(blob);
        const sampleRate = audio.sampleRate;
        const len = audio.length;

        // Mono mix
        const samples = new Float32Array(len);
        for (let c = 0; c < audio.numberOfChannels; c++) {
            const ch = audio.getChannelData(c);
            for (let i = 0; i < len; i++) samples[i] += ch[i];
        }
        if (audio.numberOfChannels > 1) {
            const inv = 1 / audio.numberOfChannels;
            for (let i = 0; i < len; i++) samples[i] *= inv;
        }

        // RMS for activity detection
        let totalRms = 0;
        const frameSize = Math.floor(sampleRate * 0.05); // 50 ms frames
        const frames = Math.max(1, Math.floor(len / frameSize));
        const frameRms = new Float32Array(frames);
        for (let f = 0; f < frames; f++) {
            let s = 0;
            const start = f * frameSize;
            for (let i = 0; i < frameSize; i++) {
                const v = samples[start + i] || 0;
                s += v * v;
            }
            frameRms[f] = Math.sqrt(s / frameSize);
            totalRms += frameRms[f];
        }
        totalRms /= frames;

        // Activity threshold = max(0.005, 1.5 * median)
        const sortedRms = Array.from(frameRms).slice().sort(function (a, b) { return a - b; });
        const median = sortedRms[Math.floor(sortedRms.length / 2)];
        const threshold = Math.max(0.005, median * 1.5);
        let activeFrames = 0;
        let transientCount = 0;
        let prevActive = false;
        for (let f = 0; f < frames; f++) {
            const active = frameRms[f] > threshold;
            if (active) activeFrames++;
            if (active && !prevActive) transientCount++;
            prevActive = active;
        }
        const duration_active_s = activeFrames * 0.05;
        const transient_rate_hz = duration_active_s > 0 ? transientCount / duration_active_s : 0;

        // STFT — accumulate magnitude spectrum + per-frame peak frequency
        const hop = Math.max(256, Math.floor(fftSize / 4));
        const numFrames = Math.max(1, Math.floor((len - fftSize) / hop));
        const bins = fftSize >> 1;
        const aggMag = new Float64Array(bins);
        const peakBinPerFrame = new Int32Array(numFrames);
        const hann = new Float32Array(fftSize);
        for (let i = 0; i < fftSize; i++) {
            hann[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (fftSize - 1)));
        }
        const re = new Float64Array(fftSize);
        const im = new Float64Array(fftSize);

        for (let frame = 0; frame < numFrames; frame++) {
            const start = frame * hop;
            for (let i = 0; i < fftSize; i++) {
                re[i] = samples[start + i] * hann[i];
                im[i] = 0;
            }
            fft(re, im);
            let frameMaxBin = 1;
            let frameMaxMag = 0;
            for (let k = 1; k < bins; k++) {
                const mag = Math.sqrt(re[k] * re[k] + im[k] * im[k]);
                aggMag[k] += mag;
                if (mag > frameMaxMag) { frameMaxMag = mag; frameMaxBin = k; }
            }
            peakBinPerFrame[frame] = frameMaxBin;
        }

        const binFreq = sampleRate / fftSize;

        // Peak frequency = aggregate magnitude argmax
        let peakBin = 1;
        let peakMag = 0;
        for (let k = 1; k < bins; k++) {
            if (aggMag[k] > peakMag) { peakMag = aggMag[k]; peakBin = k; }
        }
        const peak_freq_hz = peakBin * binFreq;

        // Frequency band that contains the central 80% of energy
        let totalEnergy = 0;
        for (let k = 1; k < bins; k++) totalEnergy += aggMag[k];
        let cum = 0;
        let lowBin = 1, highBin = bins - 1;
        for (let k = 1; k < bins; k++) {
            cum += aggMag[k];
            if (cum >= totalEnergy * 0.1 && lowBin === 1) lowBin = k;
            if (cum >= totalEnergy * 0.9) { highBin = k; break; }
        }
        const freq_range_hz = [lowBin * binFreq, highBin * binFreq];

        // Modulation rate: how often the per-frame peak bin changes substantially (≥4 bins)
        let modulationChanges = 0;
        for (let f = 1; f < numFrames; f++) {
            if (Math.abs(peakBinPerFrame[f] - peakBinPerFrame[f - 1]) >= 4) modulationChanges++;
        }
        const totalSeconds = numFrames > 0 ? (numFrames * hop) / sampleRate : 1;
        const modulation_rate_hz = totalSeconds > 0 ? modulationChanges / totalSeconds : 0;

        // Harshness: fraction of energy outside ±25% of peak frequency.
        // Tonal calls concentrate energy near a single frequency; harsh/noisy calls don't.
        const peakLow = peakBin * 0.75, peakHigh = peakBin * 1.25;
        let inEnergy = 0, outEnergy = 0;
        for (let k = 1; k < bins; k++) {
            if (k >= peakLow && k <= peakHigh) inEnergy += aggMag[k];
            else outEnergy += aggMag[k];
        }
        const harshness = (inEnergy + outEnergy) > 0 ? outEnergy / (inEnergy + outEnergy) : 0;

        return {
            peak_freq_hz: peak_freq_hz,
            freq_range_hz: freq_range_hz,
            duration_active_s: duration_active_s,
            modulation_rate_hz: modulation_rate_hz,
            harshness: harshness,
            transient_rate_hz: transient_rate_hz,
            loudness_rms: totalRms,
            sample_rate: sampleRate,
            duration_total_s: len / sampleRate
        };
    }
})();
