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
        generate: generateSpectrogramBlob
    };
})();
