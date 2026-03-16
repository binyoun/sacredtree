// audio.js - Generative Ambient Music for Sacred Tree using Tone.js

const SacredAudio = (function() {
    let initialized = false;
    let currentMode = 'center';

    let reverb, chorus, filter, lfo, delay, panner;

    // Synths for Direction pages
    let droneSynth, melodySynth;
    // Synths for Landing page (3-layer gamelan-inspired bells)
    let bellSynth, deepBellSynth, sparkleSynth;

    let nextMelodyTimeout;
    let landingTimeouts = [];  // track all landing layer timeouts

    // Musical parameters per direction (Wu Xing cosmology)
    const config = {
        east: {   // Wood - Spring, Morning, Green
            scale: ['C4', 'D4', 'E4', 'G4', 'A4', 'C5', 'D5'],
            drone: ['C3', 'G3'],
            lfoFreq: 0.05,
            filterBase: 1000,
            melodyOsc: 'triangle',
            droneOsc: 'sine'
        },
        south: {  // Fire - Summer, Noon, Red
            scale: ['G4', 'A4', 'B4', 'D5', 'E5', 'G5', 'A5'],
            drone: ['G3', 'D4'],
            lfoFreq: 0.08,
            filterBase: 1500,
            melodyOsc: 'sine',
            droneOsc: 'triangle'
        },
        center: { // Earth - Axis, Yellow
            scale: ['F3', 'G3', 'A3', 'C4', 'D4', 'F4', 'G4'],
            drone: ['F2', 'C3'],
            lfoFreq: 0.04,
            filterBase: 800,
            melodyOsc: 'triangle',
            droneOsc: 'sine'
        },
        west: {   // Metal - Autumn, Evening, White
            scale: ['D4', 'F4', 'G4', 'A4', 'C5', 'D5', 'F5'],
            drone: ['D3', 'A3'],
            lfoFreq: 0.05,
            filterBase: 1200,
            melodyOsc: 'square',
            droneOsc: 'sine'
        },
        north: {  // Water - Winter, Midnight, Blue
            scale: ['A2', 'C3', 'D3', 'E3', 'G3', 'A3', 'C4'],
            drone: ['A1', 'E2'],
            lfoFreq: 0.03,
            filterBase: 600,
            melodyOsc: 'sine',
            droneOsc: 'sine'
        },
        landing: {
            // 3-layer gamelan-inspired pentatonic (slendro-like: 1-2-3-5-6)
            deep:    ['C3', 'F3', 'G3', 'C4'],                         // gong ageng layer
            mid:     ['C4', 'D4', 'F4', 'G4', 'A4', 'C5'],            // saron/kenong layer
            sparkle: ['C5', 'D5', 'F5', 'G5', 'A5', 'C6', 'D6']      // bonang/peking layer
        }
    };

    async function initTone() {
        if (initialized) {
            // Clean up old instances immediately (no fade needed here since
            // this path is only hit on re-init, not on navigation)
            disposeAll();
        }

        // NOTE: Tone.start() is already called synchronously in init() before
        // this async function. Do NOT call await Tone.start() again here —
        // on iOS the duplicate call can confuse the AudioContext state.

        // --- MASTER EFFECTS ---
        const reverbDecay = (currentMode === 'landing') ? 4 : 20;
        const reverbWet  = (currentMode === 'landing') ? 0.9 : 1.;
        reverb = new Tone.Reverb({
            decay: reverbDecay,
            preDelay: 0.15,
            wet: reverbWet
        }).toDestination();

        if (currentMode === 'landing') {
            // --- LANDING PAGE: 3-LAYER GAMELAN-INSPIRED BELLS ---
            // Follow same pattern as direction pages (proven to work on iOS):
            // create all nodes → await Tone.loaded() → THEN play.
            console.log('[SacredAudio] Landing init, context state:', Tone.context.state);

            // Echo: each bell hit repeats ~3-4 times, fading out
            delay = new Tone.FeedbackDelay({
                delayTime: 1.0,
                feedback: 0.45,
                wet: 0.35
            }).connect(reverb);

            // Layer 1: Deep bell (gong ageng — low, slow, resonant)
            deepBellSynth = new Tone.FMSynth({
                harmonicity: 5.01,
                modulationIndex: 8,
                oscillator: { type: "sine" },
                envelope: { attack: 0.01, decay: 4, sustain: 0.05, release: 6 },
                modulation: { type: "square" },
                modulationEnvelope: { attack: 0.01, decay: 0.8, sustain: 0, release: 0.2 },
                volume: -22
            });
            deepBellSynth.connect(delay);
            deepBellSynth.toDestination();

            // Layer 2: Mid bell (saron/kenong — medium register)
            bellSynth = new Tone.FMSynth({
                harmonicity: 3.01,
                modulationIndex: 10,
                oscillator: { type: "sine" },
                envelope: { attack: 0.01, decay: 2, sustain: 0.1, release: 4 },
                modulation: { type: "square" },
                modulationEnvelope: { attack: 0.01, decay: 0.5, sustain: 0, release: 0.1 },
                volume: -20
            });
            bellSynth.connect(delay);
            bellSynth.toDestination();

            // Layer 3: Sparkle (bonang/peking — high, light, frequent)
            sparkleSynth = new Tone.FMSynth({
                harmonicity: 7.01,
                modulationIndex: 6,
                oscillator: { type: "sine" },
                envelope: { attack: 0.005, decay: 1.2, sustain: 0, release: 2 },
                modulation: { type: "sine" },
                modulationEnvelope: { attack: 0.005, decay: 0.3, sustain: 0, release: 0.1 },
                volume: -26
            });
            sparkleSynth.connect(delay);
            sparkleSynth.toDestination();

            console.log('[SacredAudio] 3-layer bell synths created (with echo)');

            // Wait for ALL async resources (reverb IR, etc) — same as direction pages
            await Tone.loaded();
            console.log('[SacredAudio] Tone.loaded() resolved, context:', Tone.context.state);

            // NOW start playing — context is running, all nodes ready
            landingTimeouts = [];
            startLandingLayer('deep', deepBellSynth, config.landing.deep, 12000, 20000, true);
            startLandingLayer('mid', bellSynth, config.landing.mid, 3000, 7000, true);
            startLandingLayer('sparkle', sparkleSynth, config.landing.sparkle, 1000, 2500, true);
            initialized = true;

        } else {
            // --- DIRECTION PAGE AUDIO ROUTING (AMBIENT DRONE) ---
            const dirConfig = config[currentMode] || config['center'];

            chorus = new Tone.Chorus({
                frequency: 0.5,
                delayTime: 3.5,
                depth: 0.8,
                wet: .6
            }).connect(reverb);

            filter = new Tone.Filter({
                type: 'lowpass',
                frequency: dirConfig.filterBase,
                rolloff: -24
            }).connect(chorus);

            lfo = new Tone.LFO({
                frequency: dirConfig.lfoFreq,
                min: dirConfig.filterBase * 0.5,
                max: dirConfig.filterBase * 1.5
            }).connect(filter.frequency);
            lfo.start();

            droneSynth = new Tone.PolySynth(Tone.Synth, {
                oscillator: { type: dirConfig.droneOsc },
                envelope: {
                    attack: 10,
                    decay: 2,
                    sustain: 1,
                    release: 20
                },
                volume: -24
            }).connect(filter);

            melodySynth = new Tone.PolySynth(Tone.Synth, {
                oscillator: { type: dirConfig.melodyOsc },
                envelope: {
                    attack: 6,
                    decay: 4,
                    sustain: 0.5,
                    release: 15
                },
                volume: -18
            }).connect(filter);

            if (dirConfig.melodyOsc === 'square') {
                melodySynth.set({ volume: -26 });
            }

            await Tone.loaded();
            playDirectionGenerativeMusic(dirConfig);
            initialized = true;
        }
    }

    // --- LANDING PAGE: GAMELAN-INSPIRED GENERATIVE LOGIC ---
    // Stepwise motion state per layer (tracks last note index for neighbor preference)
    const layerState = { deep: 0, mid: 0, sparkle: 0 };

    // Pick next note using gamelan-style stepwise motion:
    // 60% neighbor step, 25% skip one, 15% rest (return null)
    function pickNextNote(scale, layerName) {
        const roll = Math.random();
        if (roll < 0.15) return null; // rest — silence is part of the music

        let idx = layerState[layerName];
        if (roll < 0.75) {
            // stepwise: move ±1
            idx += (Math.random() < 0.5) ? 1 : -1;
        } else {
            // skip: move ±2
            idx += (Math.random() < 0.5) ? 2 : -2;
        }
        // wrap around scale
        idx = ((idx % scale.length) + scale.length) % scale.length;
        layerState[layerName] = idx;
        return scale[idx];
    }

    // Generic layer scheduler — each layer loops independently
    function startLandingLayer(layerName, synth, scale, minMs, maxMs, isInitial) {
        function tick() {
            var note = pickNextNote(scale, layerName);
            if (Tone.context.state === 'running' && synth && note) {
                synth.triggerAttackRelease(note, 0.1);
            }
            var next = isInitial ? 800 : (Math.random() * (maxMs - minMs) + minMs);
            isInitial = false;
            var t = setTimeout(tick, next);
            landingTimeouts.push(t);
        }
        var t = setTimeout(tick, isInitial ? 500 : (Math.random() * (maxMs - minMs) + minMs));
        landingTimeouts.push(t);
    }

    // --- DIRECTION PAGE GENERATIVE LOGIC ---
    function playDirectionGenerativeMusic(dirConfig) {
        if (droneSynth) droneSynth.triggerAttack(dirConfig.drone);

        function playRandomMelody() {
            const numNotes = Math.random() > 0.6 ? 2 : 1;
            const notesToPlay = [];
            for (let i = 0; i < numNotes; i++) {
                const randomNote = dirConfig.scale[Math.floor(Math.random() * dirConfig.scale.length)];
                if (!notesToPlay.includes(randomNote)) {
                    notesToPlay.push(randomNote);
                }
            }

            const duration = Math.random() * 4 + 2;
            // Only play if context is running, but ALWAYS schedule next
            if (Tone.context.state === 'running' && melodySynth) {
                melodySynth.triggerAttackRelease(notesToPlay, duration);
            }

            const nextTime = Math.random() * 9000 + 6000;
            nextMelodyTimeout = setTimeout(playRandomMelody, nextTime);
        }

        nextMelodyTimeout = setTimeout(playRandomMelody, 3000);
    }

    // Immediately dispose all nodes (no fade — used for re-init path)
    function disposeAll() {
        if (nextMelodyTimeout) { clearTimeout(nextMelodyTimeout); nextMelodyTimeout = null; }
        landingTimeouts.forEach(function(t) { clearTimeout(t); });
        landingTimeouts = [];
        try { Tone.Transport.stop(); } catch(e) {}
        // Release held notes before disposing
        if (droneSynth)  { try { droneSynth.releaseAll(); } catch(e) {} }
        if (melodySynth) { try { melodySynth.releaseAll(); } catch(e) {} }
        if (bellSynth)   { try { bellSynth.triggerRelease(); } catch(e) {} }
        if (deepBellSynth) { try { deepBellSynth.triggerRelease(); } catch(e) {} }
        if (sparkleSynth)  { try { sparkleSynth.triggerRelease(); } catch(e) {} }
        // Dispose all nodes
        [bellSynth, deepBellSynth, sparkleSynth, droneSynth, melodySynth, lfo, filter, chorus, delay, panner, reverb].forEach(node => {
            if (node) { try { node.dispose(); } catch(e) {} }
        });
        bellSynth = deepBellSynth = sparkleSynth = droneSynth = melodySynth = lfo = filter = chorus = delay = panner = reverb = null;
        initialized = false;
    }

    // Graceful shutdown: fade out master volume, then dispose after fade completes.
    // Returns a Promise that resolves when cleanup is done.
    // fadeMs controls how long the fade takes (default 150ms).
    function gracefulStop(fadeMs) {
        fadeMs = fadeMs || 150;
        return new Promise(function(resolve) {
            if (nextMelodyTimeout) { clearTimeout(nextMelodyTimeout); nextMelodyTimeout = null; }
            landingTimeouts.forEach(function(t) { clearTimeout(t); });
            landingTimeouts = [];

            // Release held notes so envelopes start their release phase
            if (droneSynth)  { try { droneSynth.releaseAll(); } catch(e) {} }
            if (melodySynth) { try { melodySynth.releaseAll(); } catch(e) {} }
            if (bellSynth)   { try { bellSynth.triggerRelease(); } catch(e) {} }
            if (deepBellSynth) { try { deepBellSynth.triggerRelease(); } catch(e) {} }
            if (sparkleSynth)  { try { sparkleSynth.triggerRelease(); } catch(e) {} }

            // Ramp master volume to silence
            try {
                Tone.getDestination().volume.rampTo(-Infinity, fadeMs / 1000);
            } catch(e) {}

            // Dispose everything after fade completes
            setTimeout(function() {
                try { Tone.Transport.stop(); } catch(e) {}
                [bellSynth, deepBellSynth, sparkleSynth, droneSynth, melodySynth, lfo, filter, chorus, delay, panner, reverb].forEach(function(node) {
                    if (node) { try { node.dispose(); } catch(e) {} }
                });
                bellSynth = deepBellSynth = sparkleSynth = droneSynth = melodySynth = lfo = filter = chorus = delay = panner = reverb = null;
                // Restore master volume for next page
                try { Tone.getDestination().volume.value = 0; } catch(e) {}
                initialized = false;
                resolve();
            }, fadeMs + 50);
        });
    }

    // Safety net: pagehide is more reliable than beforeunload on iOS Safari
    window.addEventListener('pagehide', function() {
        disposeAll();
    });

    return {
        setup: function(mode) {
            currentMode = mode || 'center';
        },
        init: async function(mode) {
            currentMode = mode || 'center';
            // Tone.start() is now called in the HTML handler directly (user gesture).
            // Fallback in case it wasn't:
            if (Tone.context.state !== 'running') {
                Tone.start();
                Tone.context.resume();
            }
            try {
                await initTone();
            } catch (err) {
                console.warn("Audio Context failed to start:", err);
            }
        },
        // Graceful stop with fade-out. Call before navigating away.
        // Usage: SacredAudio.stop().then(() => { window.location.href = '...'; });
        stop: function() {
            return gracefulStop(150);
        }
    };
})();
