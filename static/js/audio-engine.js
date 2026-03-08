const AudioEngine = {
    initialized: false,
    synths: {},
    effects: {},
    masterChannel: null,

    async init() {
        if (this.initialized) return;
        await Tone.start();

        // Effects
        this.effects.reverb = new Tone.Reverb({ decay: 2, wet: 0.3 });
        await this.effects.reverb.generate();
        this.effects.delay = new Tone.FeedbackDelay({
            delayTime: 0.25, feedback: 0.3, wet: 0.2
        });

        // Master chain
        this.masterChannel = new Tone.Channel({ volume: -6 }).toDestination();
        this.effects.reverb.connect(this.masterChannel);
        this.effects.delay.connect(this.effects.reverb);

        // Analyser for visualizer (raw Web Audio API node)
        this.analyser = Tone.getContext().createAnalyser();
        this.analyser.fftSize = 2048;
        this.analyser.smoothingTimeConstant = 0.8;
        Tone.getDestination().connect(this.analyser);

        // Chord synth (polyphonic)
        this.synths.chords = new Tone.PolySynth(Tone.Synth, {
            maxPolyphony: 8,
            options: {
                oscillator: { type: "triangle" },
                envelope: { attack: 0.05, decay: 0.3, sustain: 0.4, release: 0.8 }
            }
        }).connect(this.effects.delay);
        this.synths.chords.volume.value = -8;

        // Bass synth (monophonic)
        this.synths.bass = new Tone.MonoSynth({
            oscillator: { type: "sawtooth" },
            filter: { Q: 2, type: "lowpass", frequency: 800 },
            envelope: { attack: 0.01, decay: 0.2, sustain: 0.5, release: 0.3 },
            filterEnvelope: {
                attack: 0.01, decay: 0.1, sustain: 0.4, release: 0.5,
                baseFrequency: 200, octaves: 2
            }
        }).connect(this.masterChannel);
        this.synths.bass.volume.value = -6;

        // Drum synths
        this.synths.kick = new Tone.MembraneSynth({
            pitchDecay: 0.05,
            octaves: 6,
            oscillator: { type: "sine" },
            envelope: { attack: 0.001, decay: 0.4, sustain: 0, release: 0.4 }
        }).connect(this.masterChannel);
        this.synths.kick.volume.value = -6;

        this.synths.snare = new Tone.NoiseSynth({
            noise: { type: "white" },
            envelope: { attack: 0.001, decay: 0.15, sustain: 0, release: 0.1 }
        }).connect(this.masterChannel);
        this.synths.snare.volume.value = -6;

        this.synths.hihatClosed = new Tone.MetalSynth({
            frequency: 400,
            envelope: { attack: 0.001, decay: 0.05, release: 0.01 },
            harmonicity: 5.1,
            modulationIndex: 32,
            resonance: 4000,
            octaves: 1.5
        }).connect(this.masterChannel);
        this.synths.hihatClosed.volume.value = -12;

        this.synths.hihatOpen = new Tone.MetalSynth({
            frequency: 400,
            envelope: { attack: 0.001, decay: 0.3, release: 0.1 },
            harmonicity: 5.1,
            modulationIndex: 32,
            resonance: 4000,
            octaves: 1.5
        }).connect(this.masterChannel);
        this.synths.hihatOpen.volume.value = -12;

        // Store default volumes for mixer solo/mute restore
        this.synths.chords._userVolume = -8;
        this.synths.bass._userVolume = -6;
        this.synths.kick._userVolume = -6;
        this.synths.snare._userVolume = -6;
        this.synths.hihatClosed._userVolume = -12;
        this.synths.hihatOpen._userVolume = -12;

        this.initialized = true;
        console.log("AudioEngine initialized");
    },

    playChord(notes, duration = "2n") {
        if (!this.initialized) return;
        this.synths.chords.triggerAttackRelease(notes, duration);
    },

    triggerDrum(name, time) {
        if (!this.initialized) return;
        const synth = this.synths[name];
        if (!synth) return;

        if (name === "kick") {
            synth.triggerAttackRelease("C1", "8n", time);
        } else if (name === "snare") {
            synth.triggerAttackRelease("8n", time);
        } else {
            // Hi-hats (MetalSynth)
            synth.triggerAttackRelease("32n", time);
        }
    },

    stopAll() {
        if (!this.initialized) return;
        Object.values(this.synths).forEach(synth => {
            if (synth.releaseAll) synth.releaseAll();
        });
    }
};
