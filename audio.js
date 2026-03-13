// audio.js - Generative Ambient Music for Sacred Tree using Tone.js

// audio.js - Generative Ambient Music for Sacred Tree using Tone.js

const SacredAudio = (function() {
    let initialized = false;
    let currentMode = 'center'; // 'landing' or direction ('east', 'south', etc)

    let reverb, chorus, filter, lfo, delay;
    
    // Synths for Direction pages
    let droneSynth, melodySynth;
    // Synths for Landing page
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
        // --- LANDING PAGE CONFIG ---
        landing: { 
            // Temple bells / wind chimes (Pentatonic High)
            scale: ['C5', 'D5', 'F5', 'G5', 'A5', 'C6', 'D6']
        }
    };

    async function initTone() {
        if (initialized) return;
        
        await Tone.start();
        initialized = true;

        // --- MASTER EFFECTS ---
        // Massive Reverb for spiritual space (used in both modes)
        reverb = new Tone.Reverb({
            decay: 20, 
            preDelay: 0.1,
            wet: 0.75
        }).toDestination();

        if (currentMode === 'landing') {
            // --- LANDING PAGE AUDIO ROUTING (FM BELLS) ---
            
            // PingPongDelay for bells echoing in a vast valley
            delay = new Tone.PingPongDelay({
                delayTime: "4n",
                feedback: 0.7, // Ditingkatkan dari 0.5 agar pantulan lebih banyak
                wet: 0.6       // Ditingkatkan dari 0.4 agar efek echo lebih dominan
            }).connect(reverb);
            
            // Panner stereo (2D biasa) bergerak lambat ke kiri dan kanan
            const panner = new Tone.AutoPanner({
                frequency: 0.1, 
                depth: 1        
            }).connect(delay).start();

            Tone.Transport.bpm.value = 60; // Set base tempo for delay

            // FM Synth designed to sound like a struck temple bell / chime
            bellSynth = new Tone.PolySynth(Tone.FMSynth, {
                harmonicity: 3.01,
                modulationIndex: 10,
                oscillator: { type: "sine" },
                envelope: {
                    attack: 0.01, // Quick percussive strike
                    decay: 2,
                    sustain: 0.1,
                    release: 8    // Very long ringing tail
                },
                modulation: { type: "square" },
                modulationEnvelope: {
                    attack: 0.01,
                    decay: 0.5,
                    sustain: 0,
                    release: 0.1
                },
                volume: -20
            }).connect(panner);

            await Tone.loaded();
            playLandingGenerativeBells();

        } else {
            // --- DIRECTION PAGE AUDIO ROUTING (AMBIENT DRONE) ---
            const dirConfig = config[currentMode] || config['center'];

            // Chorus for widening
            chorus = new Tone.Chorus({
                frequency: 0.5, 
                delayTime: 3.5,
                depth: 0.8,
                wet: 0.6
            }).connect(reverb);

            // Lowpass Filter for breath-like swell motion
            filter = new Tone.Filter({
                type: 'lowpass',
                frequency: dirConfig.filterBase,
                rolloff: -24
            }).connect(chorus);

            // LFO modulating the filter frequency automatically
            lfo = new Tone.LFO({
                frequency: dirConfig.lfoFreq, 
                min: dirConfig.filterBase * 0.5,
                max: dirConfig.filterBase * 1.5
            }).connect(filter.frequency);
            lfo.start();

            // Drone Synth: Plays constant deep intervals
            droneSynth = new Tone.PolySynth(Tone.Synth, {
                oscillator: { type: dirConfig.droneOsc },
                envelope: {
                    attack: 10,   // very slow fade in
                    decay: 2,
                    sustain: 1,
                    release: 20   // slow fade out
                },
                volume: -24
            }).connect(filter);

            // Melody Synth: Plays generative pentatonic notes
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
        }
    }

    // --- LANDING PAGE GENERATIVE LOGIC ---
    function playLandingGenerativeBells() {
        if (Tone.context.state !== 'running') return;
        
        const scale = config.landing.scale;
        
        // Pick a random high bell note
        const randomNote = scale[Math.floor(Math.random() * scale.length)];
        
        // Hit the bell hard, let it ring
        bellSynth.triggerAttackRelease(randomNote, 0.1);

        // Schedule next bell strike very unpredictably (between 4 to 12 seconds)
        // Leaving lots of empty space/silence
        const nextTime = Math.random() * 8000 + 4000;
        nextMelodyTimeout = setTimeout(playLandingGenerativeBells, nextTime);
    }

    // --- DIRECTION PAGE GENERATIVE LOGIC ---
    function playDirectionGenerativeMusic(dirConfig) {
        // Trigger the infinite drone
        droneSynth.triggerAttack(dirConfig.drone);

        function playRandomMelody() {
            if (Tone.context.state !== 'running') return;
            
            const numNotes = Math.random() > 0.6 ? 2 : 1;
            const notesToPlay = [];
            for (let i = 0; i < numNotes; i++) {
                const randomNote = dirConfig.scale[Math.floor(Math.random() * dirConfig.scale.length)];
                if (!notesToPlay.includes(randomNote)) {
                    notesToPlay.push(randomNote);
                }
            }

            const duration = Math.random() * 4 + 2; 
            melodySynth.triggerAttackRelease(notesToPlay, duration);

            const nextTime = Math.random() * 9000 + 6000;
            nextMelodyTimeout = setTimeout(playRandomMelody, nextTime);
        }

        setTimeout(playRandomMelody, 6000);
    }

    return {
        setup: function(mode) {
            currentMode = mode || 'center';
            
            const overlayId = 'sacred-audio-overlay';
            if (document.getElementById(overlayId)) return;

            // ... The UI overlay is handled inside index.html and direction.html directly now,
            // or we dynamically create a fallback one here if it doesn't exist.
            
            // To prevent duplicate overlays if the HTML already has one, we'll just expose
            // an init method to be called from the HTML's custom overlay trigger.
        },
        // Direct init call for HTML custom overlays
        init: async function(mode) {
            currentMode = mode || 'center';
            try {
                await initTone();
            } catch (err) {
                console.warn("Audio Context failed to start:", err);
            }
        }
    };
})();
