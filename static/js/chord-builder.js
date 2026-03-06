const ChordBuilder = {
    container: null,
    availableChords: [],
    progression: [],
    maxSlots: 8,
    scheduledEvents: [],

    init() {
        this.container = document.getElementById("chord-builder");
        this.render();
        this.loadKeys();

        EventBus.on("playbackStarted", () => this.schedulePlayback());
        EventBus.on("playbackStopped", () => this.clearSchedule());
    },

    render() {
        this.container.innerHTML = `
            <div class="chord-controls">
                <div class="chord-selectors">
                    <label>Key</label>
                    <select id="key-root"></select>
                    <select id="key-scale">
                        <option value="major">Major</option>
                        <option value="minor">Minor</option>
                    </select>
                    <label style="margin-left: 16px;">Preset</label>
                    <select id="progression-preset">
                        <option value="">-- Select Preset --</option>
                    </select>
                </div>
            </div>
            <div id="chord-palette" class="chord-palette"></div>
            <div class="progression-label">
                <span>Progression Timeline</span>
                <button class="btn btn-small" id="clear-progression">Clear</button>
            </div>
            <div id="chord-timeline" class="chord-timeline"></div>
        `;

        document.getElementById("key-root").addEventListener("change", () => this.onKeyChange());
        document.getElementById("key-scale").addEventListener("change", () => this.onKeyChange());
        document.getElementById("progression-preset").addEventListener("change", (e) => this.onPresetSelect(e));
        document.getElementById("clear-progression").addEventListener("click", () => this.clearProgression());
    },

    async loadKeys() {
        const data = await fetch("/api/keys").then(r => r.json());
        const rootSelect = document.getElementById("key-root");
        data.roots.forEach(note => {
            const opt = document.createElement("option");
            opt.value = note;
            opt.textContent = note;
            rootSelect.appendChild(opt);
        });

        // Load presets
        const presets = await fetch("/api/progressions").then(r => r.json());
        const presetSelect = document.getElementById("progression-preset");
        presets.patterns.forEach(name => {
            const opt = document.createElement("option");
            opt.value = name;
            opt.textContent = name;
            presetSelect.appendChild(opt);
        });

        this.onKeyChange();
    },

    async onKeyChange() {
        const root = document.getElementById("key-root").value;
        const scaleType = document.getElementById("key-scale").value;
        AppState.songData.key = { root, scaleType };

        const data = await fetch(`/api/chords/${root}/${scaleType}`).then(r => r.json());
        this.availableChords = data.chords;
        AppState.availableChords = data.chords;

        this.renderPalette();
        EventBus.emit("keyChanged", { root, scaleType });
    },

    renderPalette() {
        const palette = document.getElementById("chord-palette");
        palette.innerHTML = "";

        this.availableChords.forEach((chord, i) => {
            const btn = document.createElement("button");
            btn.className = `chord-pad chord-${chord.quality}`;
            btn.innerHTML = `<span class="chord-roman">${chord.roman}</span><span class="chord-name">${chord.label}</span>`;
            btn.addEventListener("click", async () => {
                await AudioEngine.init();
                AudioEngine.playChord(chord.notes, "4n");
                this.addToProgression(chord);
                EventBus.emit("chordSelected", chord);
            });
            palette.appendChild(btn);
        });
    },

    addToProgression(chord) {
        if (this.progression.length >= this.maxSlots) return;
        this.progression.push({ ...chord });
        AppState.getCurrentSection().chords = this.progression.map(c => ({ ...c }));
        this.renderTimeline();
        EventBus.emit("progressionChanged", this.progression);
    },

    removeFromProgression(index) {
        this.progression.splice(index, 1);
        AppState.getCurrentSection().chords = this.progression.map(c => ({ ...c }));
        this.renderTimeline();
        EventBus.emit("progressionChanged", this.progression);
    },

    clearProgression() {
        this.progression = [];
        AppState.getCurrentSection().chords = [];
        this.renderTimeline();
        EventBus.emit("progressionChanged", this.progression);
    },

    renderTimeline() {
        const timeline = document.getElementById("chord-timeline");
        timeline.innerHTML = "";

        for (let i = 0; i < this.maxSlots; i++) {
            const slot = document.createElement("div");
            slot.className = "timeline-slot" + (this.progression[i] ? " filled" : " empty");
            slot.dataset.index = i;

            if (this.progression[i]) {
                const chord = this.progression[i];
                slot.innerHTML = `
                    <span class="slot-roman">${chord.roman}</span>
                    <span class="slot-name">${chord.root}</span>
                    <button class="slot-remove" data-index="${i}">&times;</button>
                `;
                slot.querySelector(".slot-remove").addEventListener("click", (e) => {
                    e.stopPropagation();
                    this.removeFromProgression(parseInt(e.target.dataset.index));
                });
            } else {
                slot.innerHTML = `<span class="slot-empty">${i + 1}</span>`;
            }

            timeline.appendChild(slot);
        }
    },

    async onPresetSelect(e) {
        const patternName = e.target.value;
        if (!patternName) return;

        const root = document.getElementById("key-root").value;
        const scaleType = document.getElementById("key-scale").value;

        const data = await fetch(`/api/progressions/${root}/${scaleType}/${encodeURIComponent(patternName)}`).then(r => r.json());
        if (data.chords) {
            this.progression = data.chords.map(c => ({ ...c }));
            AppState.getCurrentSection().chords = this.progression.map(c => ({ ...c }));
            this.renderTimeline();
            EventBus.emit("progressionChanged", this.progression);
        }
    },

    schedulePlayback() {
        this.clearSchedule();
        if (this.progression.length === 0) return;

        const barsPerChord = 1;
        this.progression.forEach((chord, i) => {
            const time = Tone.Time("1m").toSeconds() * i * barsPerChord;
            const eventId = Tone.Transport.schedule((t) => {
                AudioEngine.synths.chords.triggerAttackRelease(chord.notes, "1m", t);
                Tone.Draw.schedule(() => this.highlightSlot(i), t);
            }, time);
            this.scheduledEvents.push(eventId);
        });

        // Loop the transport for the progression length
        Tone.Transport.loop = true;
        Tone.Transport.loopEnd = Tone.Time("1m").toSeconds() * this.progression.length;
    },

    clearSchedule() {
        this.scheduledEvents.forEach(id => Tone.Transport.clear(id));
        this.scheduledEvents = [];
        this.highlightSlot(-1);
    },

    highlightSlot(index) {
        const slots = document.querySelectorAll(".timeline-slot");
        slots.forEach((slot, i) => {
            slot.classList.toggle("playing", i === index);
        });
    },

    loadSectionData(section) {
        this.progression = (section.chords || []).map(c => ({ ...c }));
        this.renderTimeline();
    }
};
