// audio.js - Generative Ambient Music for Sacred Tree using Tone.js

const SacredAudio = (function() {
    let initialized = false;
    let currentMode = 'center';

    let reverb, chorus, filter, lfo, delay, panner;

    // Synths for Direction pages
    let droneSynth, melodySynth;
    // Synth for Landing page (single FMSynth — lighter on iOS than PolySynth)
    let bellSynth;

    let nextMelodyTimeout;

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
            scale: ['C5', 'D5', 'F5', 'G5', 'A5', 'C6', 'D6']
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
        const reverbDecay = (currentMode === 'landing') ? 1.5 : 20;
        reverb = new Tone.Reverb({
            decay: reverbDecay,
            preDelay: 0.1,
            wet: 0.75
        }).toDestination();

        if (currentMode === 'landing') {
            // --- LANDING PAGE AUDIO ROUTING (FM BELLS) ---
            console.log('[SacredAudio] Landing init, context state:', Tone.context.state);

            // Simple bell synth connected straight to reverb (skip heavy effects for iOS)
            bellSynth = new Tone.FMSynth({
                harmonicity: 3.01,
                modulationIndex: 10,
                oscillator: { type: "sine" },
                envelope: {
                    attack: 0.01,
                    decay: 2,
                    sustain: 0.1,
                    release: 4
                },
                modulation: { type: "square" },
                modulationEnvelope: {
                    attack: 0.01,
                    decay: 0.5,
                    sustain: 0,
                    release: 0.1
                },
                volume: -16
            }).connect(reverb);

            console.log('[SacredAudio] Bell synth created, playing first bell immediately');

            // Play first bell IMMEDIATELY — don't wait for Tone.loaded()
            // This ensures iOS hears something right away within the user gesture window
            try {
                bellSynth.triggerAttackRelease('C5', 0.1);
                console.log('[SacredAudio] First bell triggered');
            } catch(e) {
                console.error('[SacredAudio] First bell failed:', e);
            }

            // Start generative bells (scheduling continues regardless)
            playLandingGenerativeBells(true);
            initialized = true;

            // Load reverb IR in background (non-blocking)
            Tone.loaded().then(() => {
                console.log('[SacredAudio] Tone.loaded() resolved');
            }).catch(e => {
                console.error('[SacredAudio] Tone.loaded() failed:', e);
            });

        } else {
            // --- DIRECTION PAGE AUDIO ROUTING (AMBIENT DRONE) ---
            const dirConfig = config[currentMode] || config['center'];

            chorus = new Tone.Chorus({
                frequency: 0.5,
                delayTime: 3.5,
                depth: 0.8,
                wet: 0.6
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

    // --- LANDING PAGE GENERATIVE LOGIC ---
    function playLandingGenerativeBells(isInitial) {
        const scale = config.landing.scale;
        const randomNote = scale[Math.floor(Math.random() * scale.length)];

        // Only play if context is running, but ALWAYS schedule next bell
        // (prevents the scheduling chain from dying on iOS)
        if (Tone.context.state === 'running' && bellSynth) {
            bellSynth.triggerAttackRelease(randomNote, 0.1);
        }

        const nextTime = isInitial ? 500 : (Math.random() * 8000 + 4000);
        nextMelodyTimeout = setTimeout(() => playLandingGenerativeBells(false), nextTime);
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
        try { Tone.Transport.stop(); } catch(e) {}
        // Release held notes before disposing
        if (droneSynth)  { try { droneSynth.releaseAll(); } catch(e) {} }
        if (melodySynth) { try { melodySynth.releaseAll(); } catch(e) {} }
        if (bellSynth)   { try { bellSynth.triggerRelease(); } catch(e) {} }
        // Dispose all nodes
        [bellSynth, droneSynth, melodySynth, lfo, filter, chorus, delay, panner, reverb].forEach(node => {
            if (node) { try { node.dispose(); } catch(e) {} }
        });
        bellSynth = droneSynth = melodySynth = lfo = filter = chorus = delay = panner = reverb = null;
        initialized = false;
    }

    // Graceful shutdown: fade out master volume, then dispose after fade completes.
    // Returns a Promise that resolves when cleanup is done.
    // fadeMs controls how long the fade takes (default 150ms).
    function gracefulStop(fadeMs) {
        fadeMs = fadeMs || 150;
        return new Promise(function(resolve) {
            if (nextMelodyTimeout) { clearTimeout(nextMelodyTimeout); nextMelodyTimeout = null; }

            // Release held notes so envelopes start their release phase
            if (droneSynth)  { try { droneSynth.releaseAll(); } catch(e) {} }
            if (melodySynth) { try { melodySynth.releaseAll(); } catch(e) {} }
            if (bellSynth)   { try { bellSynth.triggerRelease(); } catch(e) {} }

            // Ramp master volume to silence
            try {
                Tone.getDestination().volume.rampTo(-Infinity, fadeMs / 1000);
            } catch(e) {}

            // Dispose everything after fade completes
            setTimeout(function() {
                try { Tone.Transport.stop(); } catch(e) {}
                [bellSynth, droneSynth, melodySynth, lfo, filter, chorus, delay, panner, reverb].forEach(function(node) {
                    if (node) { try { node.dispose(); } catch(e) {} }
                });
                bellSynth = droneSynth = melodySynth = lfo = filter = chorus = delay = panner = reverb = null;
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
            // CRITICAL FOR IOS: Tone.start() must happen synchronously
            // inside the click handler before any awaits.
            if (Tone.context.state !== 'running') {
                Tone.start();
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
