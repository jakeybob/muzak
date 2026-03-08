const SoundDesign = {
    container: null,

    DEFAULTS: {
        chords: {
            'chord-wave': 'triangle',
            'chord-attack': 0.05, 'chord-decay': 0.3,
            'chord-sustain': 0.4, 'chord-release': 0.8, 'chord-volume': -8,
        },
        bass: {
            'bass-wave': 'sawtooth',
            'bass-attack': 0.01, 'bass-decay': 0.2,
            'bass-sustain': 0.5, 'bass-release': 0.3,
            'bass-filter': 800, 'bass-volume': -6,
        },
        drums: {
            'drum-kick-vol': -6, 'drum-snare-vol': -6,
            'drum-hh-vol': -12, 'drum-oh-vol': -12, 'drum-all-vol': 0,
        },
        effects: {
            'fx-reverb-decay': 2, 'fx-reverb-wet': 0.3,
            'fx-delay-time': 0.25, 'fx-delay-feedback': 0.3,
            'fx-delay-wet': 0.2, 'master-volume': -6,
        },
    },

    init() {
        this.container = document.getElementById("sound-design");
        this.render();
    },

    render() {
        this.container.innerHTML = `
            <div class="sound-design-grid">
                <div class="synth-group">
                    <div class="synth-group-header">
                        <h3>Chord Synth</h3>
                        <button class="btn btn-small reset-btn" data-group="chords">Reset</button>
                    </div>
                    ${this.makeWaveformSelect("chord-wave", "triangle")}
                    ${this.makeKnob("chord-attack", "Attack", 0.001, 2, 0.05, 0.001)}
                    ${this.makeKnob("chord-decay", "Decay", 0.01, 2, 0.3, 0.01)}
                    ${this.makeKnob("chord-sustain", "Sustain", 0, 1, 0.4, 0.01)}
                    ${this.makeKnob("chord-release", "Release", 0.01, 4, 0.8, 0.01)}
                    ${this.makeKnob("chord-volume", "Volume", -30, 0, -8, 1)}
                </div>

                <div class="synth-group">
                    <div class="synth-group-header">
                        <h3>Bass Synth</h3>
                        <button class="btn btn-small reset-btn" data-group="bass">Reset</button>
                    </div>
                    ${this.makeWaveformSelect("bass-wave", "sawtooth")}
                    ${this.makeKnob("bass-attack", "Attack", 0.001, 1, 0.01, 0.001)}
                    ${this.makeKnob("bass-decay", "Decay", 0.01, 2, 0.2, 0.01)}
                    ${this.makeKnob("bass-sustain", "Sustain", 0, 1, 0.5, 0.01)}
                    ${this.makeKnob("bass-release", "Release", 0.01, 4, 0.3, 0.01)}
                    ${this.makeKnob("bass-filter", "Filter", 100, 5000, 800, 10)}
                    ${this.makeKnob("bass-volume", "Volume", -30, 0, -6, 1)}
                </div>

                <div class="synth-group">
                    <div class="synth-group-header">
                        <h3>Drums</h3>
                        <button class="btn btn-small reset-btn" data-group="drums">Reset</button>
                    </div>
                    ${this.makeKnob("drum-kick-vol", "Kick Vol", -30, 0, -6, 1)}
                    ${this.makeKnob("drum-snare-vol", "Snare Vol", -30, 0, -6, 1)}
                    ${this.makeKnob("drum-hh-vol", "HiHat Vol", -30, 0, -12, 1)}
                    ${this.makeKnob("drum-oh-vol", "Open Hat Vol", -30, 0, -12, 1)}
                    ${this.makeKnob("drum-all-vol", "Drums Vol", -30, 6, 0, 1)}
                </div>

                <div class="synth-group">
                    <div class="synth-group-header">
                        <h3>Effects</h3>
                        <button class="btn btn-small reset-btn" data-group="effects">Reset</button>
                    </div>
                    ${this.makeKnob("fx-reverb-decay", "Reverb Time", 0.1, 10, 2, 0.1)}
                    ${this.makeKnob("fx-reverb-wet", "Reverb Mix", 0, 1, 0.3, 0.01)}
                    ${this.makeKnob("fx-delay-time", "Delay Time", 0.05, 1, 0.25, 0.01)}
                    ${this.makeKnob("fx-delay-feedback", "Delay Fdbk", 0, 0.9, 0.3, 0.01)}
                    ${this.makeKnob("fx-delay-wet", "Delay Mix", 0, 1, 0.2, 0.01)}
                    ${this.makeKnob("master-volume", "Master Vol", -30, 0, -6, 1)}
                </div>
            </div>
        `;

        this.attachListeners();
    },

    makeKnob(id, label, min, max, value, step) {
        return `
            <div class="knob-row">
                <label>${label} <span class="knob-value" id="${id}-val">${value}</span></label>
                <input type="range" id="${id}" min="${min}" max="${max}" value="${value}" step="${step}">
            </div>
        `;
    },

    makeWaveformSelect(id, defaultVal) {
        const waves = ["sine", "triangle", "sawtooth", "square"];
        return `
            <div class="knob-row">
                <label>Waveform</label>
                <select id="${id}">
                    ${waves.map(w => `<option value="${w}" ${w === defaultVal ? 'selected' : ''}>${w}</option>`).join("")}
                </select>
            </div>
        `;
    },

    attachListeners() {
        // Reset buttons
        this.container.querySelectorAll(".reset-btn").forEach(btn => {
            btn.addEventListener("click", () => this.resetGroup(btn.dataset.group));
        });

        // Chord synth
        this.bindKnob("chord-attack", (v) => this.setSynthEnvelope("chords", "attack", v));
        this.bindKnob("chord-decay", (v) => this.setSynthEnvelope("chords", "decay", v));
        this.bindKnob("chord-sustain", (v) => this.setSynthEnvelope("chords", "sustain", v));
        this.bindKnob("chord-release", (v) => this.setSynthEnvelope("chords", "release", v));
        this.bindKnob("chord-volume", (v) => {
            if (AudioEngine.synths.chords) {
                AudioEngine.synths.chords._userVolume = v;
                if (typeof MixerState !== "undefined") MixerState.apply();
                else AudioEngine.synths.chords.volume.value = v;
            }
        });
        this.bindSelect("chord-wave", (v) => {
            if (AudioEngine.synths.chords) {
                AudioEngine.synths.chords.set({ oscillator: { type: v } });
            }
        });

        // Bass synth
        this.bindKnob("bass-attack", (v) => {
            if (AudioEngine.synths.bass) AudioEngine.synths.bass.envelope.attack = v;
        });
        this.bindKnob("bass-decay", (v) => {
            if (AudioEngine.synths.bass) AudioEngine.synths.bass.envelope.decay = v;
        });
        this.bindKnob("bass-sustain", (v) => {
            if (AudioEngine.synths.bass) AudioEngine.synths.bass.envelope.sustain = v;
        });
        this.bindKnob("bass-release", (v) => {
            if (AudioEngine.synths.bass) AudioEngine.synths.bass.envelope.release = v;
        });
        this.bindKnob("bass-filter", (v) => {
            if (AudioEngine.synths.bass) AudioEngine.synths.bass.filter.frequency.value = v;
        });
        this.bindKnob("bass-volume", (v) => {
            if (AudioEngine.synths.bass) {
                AudioEngine.synths.bass._userVolume = v;
                if (typeof MixerState !== "undefined") MixerState.apply();
                else AudioEngine.synths.bass.volume.value = v;
            }
        });
        this.bindSelect("bass-wave", (v) => {
            if (AudioEngine.synths.bass) AudioEngine.synths.bass.oscillator.type = v;
        });

        // Drums
        this.bindKnob("drum-kick-vol", (v) => {
            if (AudioEngine.synths.kick) {
                AudioEngine.synths.kick._userVolume = v;
                if (typeof MixerState !== "undefined") MixerState.apply();
                else AudioEngine.synths.kick.volume.value = v;
            }
        });
        this.bindKnob("drum-snare-vol", (v) => {
            if (AudioEngine.synths.snare) {
                AudioEngine.synths.snare._userVolume = v;
                if (typeof MixerState !== "undefined") MixerState.apply();
                else AudioEngine.synths.snare.volume.value = v;
            }
        });
        this.bindKnob("drum-hh-vol", (v) => {
            if (AudioEngine.synths.hihatClosed) {
                AudioEngine.synths.hihatClosed._userVolume = v;
                if (typeof MixerState !== "undefined") MixerState.apply();
                else AudioEngine.synths.hihatClosed.volume.value = v;
            }
        });
        this.bindKnob("drum-oh-vol", (v) => {
            if (AudioEngine.synths.hihatOpen) {
                AudioEngine.synths.hihatOpen._userVolume = v;
                if (typeof MixerState !== "undefined") MixerState.apply();
                else AudioEngine.synths.hihatOpen.volume.value = v;
            }
        });
        this.bindKnob("drum-all-vol", (v) => {
            if (!AudioEngine.masterChannel) return;
            // Apply as offset to each drum's user volume
            ["kick", "snare", "hihatClosed", "hihatOpen"].forEach(name => {
                const synth = AudioEngine.synths[name];
                if (synth) {
                    synth._drumBusOffset = v;
                }
            });
            if (typeof MixerState !== "undefined") MixerState.apply();
        });

        // Effects
        this.bindKnob("fx-reverb-decay", (v) => {
            if (AudioEngine.effects.reverb) AudioEngine.effects.reverb.decay = v;
        });
        this.bindKnob("fx-reverb-wet", (v) => {
            if (AudioEngine.effects.reverb) AudioEngine.effects.reverb.wet.value = v;
        });
        this.bindKnob("fx-delay-time", (v) => {
            if (AudioEngine.effects.delay) AudioEngine.effects.delay.delayTime.value = v;
        });
        this.bindKnob("fx-delay-feedback", (v) => {
            if (AudioEngine.effects.delay) AudioEngine.effects.delay.feedback.value = v;
        });
        this.bindKnob("fx-delay-wet", (v) => {
            if (AudioEngine.effects.delay) AudioEngine.effects.delay.wet.value = v;
        });
        this.bindKnob("master-volume", (v) => {
            if (AudioEngine.masterChannel) AudioEngine.masterChannel.volume.value = v;
        });
    },

    resetGroup(group) {
        const defaults = this.DEFAULTS[group];
        if (!defaults) return;

        Object.entries(defaults).forEach(([id, defaultVal]) => {
            const el = document.getElementById(id);
            if (!el) return;

            if (el.tagName === "SELECT") {
                el.value = defaultVal;
                el.dispatchEvent(new Event("change"));
            } else {
                el.value = defaultVal;
                el.dispatchEvent(new Event("input"));
            }
        });
    },

    bindKnob(id, callback) {
        const el = document.getElementById(id);
        const valEl = document.getElementById(`${id}-val`);
        if (!el) return;
        el.addEventListener("input", () => {
            const v = parseFloat(el.value);
            if (valEl) valEl.textContent = v;
            callback(v);
        });
    },

    bindSelect(id, callback) {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener("change", () => callback(el.value));
    },

    setSynthEnvelope(synthName, param, value) {
        const synth = AudioEngine.synths[synthName];
        if (!synth) return;
        // PolySynth needs .set()
        if (synth.set) {
            synth.set({ envelope: { [param]: value } });
        }
    }
};
