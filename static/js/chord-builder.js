const ChordBuilder = {
    container: null,
    availableChords: [],
    progression: [],
    maxSlots: 8,
    scheduledEvents: [],

    ALL_NOTES: ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'],
    CHORD_INTERVALS: {
        'major': [0, 4, 7],
        'minor': [0, 3, 7],
        'diminished': [0, 3, 6],
        'augmented': [0, 4, 8],
        '7': [0, 4, 7, 10],
        'maj7': [0, 4, 7, 11],
        'min7': [0, 3, 7, 10],
        '9': [0, 4, 7, 10, 14],
        'maj9': [0, 4, 7, 11, 14],
        'min9': [0, 3, 7, 10, 14],
        '11': [0, 4, 7, 10, 14, 17],
        'sus2': [0, 2, 7],
        'sus4': [0, 5, 7],
    },
    CHORD_LABELS: {
        'major': '', 'minor': 'm', 'diminished': 'dim', 'augmented': 'aug',
        '7': '7', 'maj7': 'maj7', 'min7': 'm7',
        '9': '9', 'maj9': 'maj9', 'min9': 'm9',
        '11': '11', 'sus2': 'sus2', 'sus4': 'sus4',
    },

    buildChord(root, quality, octave = 4) {
        const rootIdx = this.ALL_NOTES.indexOf(root);
        const intervals = this.CHORD_INTERVALS[quality];
        if (!intervals) return [];
        return intervals.map(interval => {
            const noteIdx = (rootIdx + interval) % 12;
            const noteOctave = octave + Math.floor((rootIdx + interval) / 12);
            return `${this.ALL_NOTES[noteIdx]}${noteOctave}`;
        });
    },

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
                const suffix = this.CHORD_LABELS[chord.quality] ?? chord.quality;
                slot.innerHTML = `
                    <span class="slot-roman">${chord.roman || ''}</span>
                    <span class="slot-name">${chord.root}${suffix}</span>
                    <button class="slot-remove" data-index="${i}">&times;</button>
                `;
                slot.querySelector(".slot-remove").addEventListener("click", (e) => {
                    e.stopPropagation();
                    this.removeFromProgression(parseInt(e.target.dataset.index));
                });
                slot.addEventListener("contextmenu", (e) => {
                    e.preventDefault();
                    this.showChordTypeMenu(i, e.clientX, e.clientY);
                });
            } else {
                slot.innerHTML = `<span class="slot-empty">${i + 1}</span>`;
            }

            timeline.appendChild(slot);
        }
    },

    showChordTypeMenu(slotIndex, x, y) {
        this.hideChordTypeMenu();
        const chord = this.progression[slotIndex];
        if (!chord) return;

        const menu = document.createElement("div");
        menu.className = "chord-type-menu";
        menu.id = "chord-type-menu";

        Object.keys(this.CHORD_INTERVALS).forEach(quality => {
            const item = document.createElement("div");
            item.className = "chord-type-item";
            if (quality === chord.quality) item.classList.add("current");
            const suffix = this.CHORD_LABELS[quality];
            item.textContent = `${chord.root}${suffix}` + (suffix ? '' : ' (major)');
            item.addEventListener("click", () => {
                this.changeChordType(slotIndex, quality);
                this.hideChordTypeMenu();
            });
            menu.appendChild(item);
        });

        document.body.appendChild(menu);

        // Position, keeping on-screen
        const menuRect = { width: 140, height: menu.offsetHeight || 300 };
        menu.style.left = Math.min(x, window.innerWidth - menuRect.width - 8) + "px";
        menu.style.top = Math.min(y, window.innerHeight - menuRect.height - 8) + "px";

        // Close on click outside
        setTimeout(() => {
            document.addEventListener("click", this._closeMenuHandler = () => this.hideChordTypeMenu(), { once: true });
        }, 0);
    },

    hideChordTypeMenu() {
        const menu = document.getElementById("chord-type-menu");
        if (menu) menu.remove();
        if (this._closeMenuHandler) {
            document.removeEventListener("click", this._closeMenuHandler);
            this._closeMenuHandler = null;
        }
    },

    changeChordType(slotIndex, quality) {
        const chord = this.progression[slotIndex];
        if (!chord) return;

        const notes = this.buildChord(chord.root, quality);
        const suffix = this.CHORD_LABELS[quality];
        const label = suffix ? `${chord.root}${suffix}` : chord.root;

        this.progression[slotIndex] = {
            ...chord,
            quality,
            notes,
            label,
            roman: '', // Custom chord types don't have a diatonic roman numeral
        };

        AppState.getCurrentSection().chords = this.progression.map(c => ({ ...c }));
        this.renderTimeline();
        EventBus.emit("progressionChanged", this.progression);

        // Preview the new chord
        AudioEngine.init().then(() => AudioEngine.playChord(notes, "4n"));
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
