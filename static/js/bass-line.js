const BassLine = {
    container: null,
    bassLine: [],
    mode: "auto",
    sequence: null,
    manualPattern: new Array(16).fill(null),

    // Notes for manual piano-roll (high to low)
    PIANO_ROLL_NOTES: [
        "G3", "F#3", "F3", "E3", "D#3", "D3", "C#3", "C3",
        "B2", "A#2", "A2", "G#2", "G2", "F#2", "F2", "E2", "D#2", "D2", "C#2", "C2"
    ],

    PATTERN_DESCRIPTIONS: {
        "Root Notes": "Plays the root note of each chord on beat 1",
        "Root-Fifth": "Root on beat 1, fifth on beat 3",
        "Walking": "Walks through the chord tones (root, third, fifth)",
        "Octave Pump": "Root note with an octave jump for energy",
    },

    init() {
        this.container = document.getElementById("bass-line");
        this.render();

        EventBus.on("playbackStarted", () => this.startSequence());
        EventBus.on("playbackStopped", () => this.stopSequence());
        EventBus.on("progressionChanged", () => {
            if (this.mode === "auto") this.generateBass();
        });
    },

    render() {
        this.container.innerHTML = `
            <div class="bass-controls">
                <div class="bass-mode-tabs">
                    <button class="btn bass-tab ${this.mode === 'auto' ? 'active' : ''}" data-mode="auto">
                        Auto (from chords)
                    </button>
                    <button class="btn bass-tab ${this.mode === 'manual' ? 'active' : ''}" data-mode="manual">
                        Manual (piano roll)
                    </button>
                </div>
                <div class="bass-pattern-select" id="bass-pattern-area"
                     style="${this.mode === 'manual' ? 'display:none' : ''}">
                    <label>Pattern</label>
                    <select id="bass-pattern">
                        ${Object.keys(this.PATTERN_DESCRIPTIONS).map(name =>
                            `<option value="${name}">${name}</option>`
                        ).join("")}
                    </select>
                    <span class="bass-pattern-desc" id="bass-pattern-desc">
                        ${this.PATTERN_DESCRIPTIONS["Root Notes"]}
                    </span>
                </div>
            </div>
            <div id="bass-display"></div>
        `;

        // Mode tabs
        this.container.querySelectorAll(".bass-tab").forEach(tab => {
            tab.addEventListener("click", () => {
                this.mode = tab.dataset.mode;
                this.render();
                if (this.mode === "auto") this.generateBass();
            });
        });

        // Pattern selector (auto mode only)
        const patternSelect = document.getElementById("bass-pattern");
        if (patternSelect) {
            patternSelect.addEventListener("change", () => {
                const desc = document.getElementById("bass-pattern-desc");
                if (desc) desc.textContent = this.PATTERN_DESCRIPTIONS[patternSelect.value] || "";
                this.generateBass();
            });
        }

        this.renderDisplay();
    },

    // Generate bass line client-side (no API call needed)
    generateBass() {
        const chords = AppState.getCurrentSection().chords || [];
        if (chords.length === 0) {
            this.bassLine = [];
            AppState.getCurrentSection().bassLine = [];
            this.renderDisplay();
            return;
        }

        const patternEl = document.getElementById("bass-pattern");
        const patternName = patternEl ? patternEl.value : "Root Notes";

        const totalSteps = 16;
        const stepsPerChord = Math.floor(totalSteps / chords.length);
        const bassLine = [];

        chords.forEach((chord, chordIdx) => {
            const root = chord.root;
            const notes = chord.notes || [];
            const bassRoot = root + "2";

            // Get the fifth (3rd element of the triad), transposed to bass octave
            let fifthNote = bassRoot;
            if (notes.length >= 3) {
                fifthNote = notes[2].replace(/[45]/, (m) => m === "5" ? "3" : "2");
            }

            // Get the third (2nd element of the triad), transposed to bass octave
            let thirdNote = bassRoot;
            if (notes.length >= 2) {
                thirdNote = notes[1].replace(/[45]/, (m) => m === "5" ? "3" : "2");
            }

            const startStep = chordIdx * stepsPerChord;

            for (let s = 0; s < stepsPerChord; s++) {
                const step = startStep + s;
                if (step >= totalSteps) break;

                let note = null;
                let velocity = 0.8;

                if (patternName === "Root Notes") {
                    if (s === 0) { note = bassRoot; velocity = 1.0; }
                } else if (patternName === "Root-Fifth") {
                    if (s === 0) { note = bassRoot; velocity = 1.0; }
                    else if (s === 2) { note = fifthNote; velocity = 0.7; }
                } else if (patternName === "Walking") {
                    if (s === 0) { note = bassRoot; velocity = 1.0; }
                    else if (s === 1) { note = thirdNote; velocity = 0.6; }
                    else if (s === 2) { note = fifthNote; velocity = 0.7; }
                    else if (s === 3) { note = fifthNote; velocity = 0.5; }
                } else if (patternName === "Octave Pump") {
                    if (s === 0) { note = bassRoot; velocity = 1.0; }
                    else if (s === 2) { note = root + "3"; velocity = 0.7; }
                }

                if (note) {
                    bassLine.push({ step, note, velocity });
                }
            }
        });

        this.bassLine = bassLine;
        AppState.getCurrentSection().bassLine = [...this.bassLine];
        this.renderDisplay();
    },

    renderDisplay() {
        const display = document.getElementById("bass-display");
        if (!display) return;
        display.innerHTML = "";

        if (this.mode === "auto") {
            this.renderAutoView(display);
        } else {
            this.renderManualView(display);
        }
    },

    renderAutoView(display) {
        if (this.bassLine.length === 0) {
            display.innerHTML = `
                <div class="bass-empty-msg">
                    Add chords to your progression above &mdash; a bass line will be generated automatically.
                </div>
            `;
            return;
        }

        // Step display with note names visible inside cells
        const row = document.createElement("div");
        row.className = "bass-auto-row";

        for (let col = 0; col < 16; col++) {
            const cell = document.createElement("div");
            cell.className = "bass-auto-cell";
            if (col % 4 === 0) cell.classList.add("beat-start");

            const noteData = this.bassLine.find(n => n.step === col);
            if (noteData) {
                cell.classList.add("active");
                const noteName = noteData.note.replace(/\d/, "");
                const octave = noteData.note.match(/\d/)[0];
                cell.innerHTML = `<span class="bass-auto-note">${noteName}</span><span class="bass-auto-octave">${octave}</span>`;
            }

            row.appendChild(cell);
        }
        display.appendChild(row);

        // Beat labels below
        const beatRow = document.createElement("div");
        beatRow.className = "bass-beat-labels";
        for (let i = 0; i < 4; i++) {
            const label = document.createElement("span");
            label.className = "bass-beat-label";
            label.textContent = `Beat ${i + 1}`;
            beatRow.appendChild(label);
        }
        display.appendChild(beatRow);
    },

    renderManualView(display) {
        const grid = document.createElement("div");
        grid.className = "bass-grid";

        this.PIANO_ROLL_NOTES.forEach(note => {
            const row = document.createElement("div");
            row.className = "bass-row";

            const label = document.createElement("span");
            label.className = "bass-note-label";
            label.textContent = note;
            row.appendChild(label);

            for (let col = 0; col < 16; col++) {
                const cell = document.createElement("div");
                cell.className = "bass-cell";
                if (col % 4 === 0) cell.classList.add("beat-start");

                if (this.manualPattern[col] === note) {
                    cell.classList.add("active");
                }

                cell.addEventListener("click", () => {
                    if (this.manualPattern[col] === note) {
                        this.manualPattern[col] = null;
                    } else {
                        this.manualPattern[col] = note;
                    }
                    this.updateBassFromManual();
                    this.renderDisplay();
                });

                row.appendChild(cell);
            }
            grid.appendChild(row);
        });
        display.appendChild(grid);
    },

    updateBassFromManual() {
        this.bassLine = [];
        this.manualPattern.forEach((note, step) => {
            if (note) {
                this.bassLine.push({ step, note, velocity: 0.8 });
            }
        });
        AppState.getCurrentSection().bassLine = [...this.bassLine];
    },

    startSequence() {
        this.stopSequence();
        if (this.bassLine.length === 0) return;

        const steps = [...Array(16).keys()];
        this.sequence = new Tone.Sequence((time, step) => {
            const noteData = this.bassLine.find(n => n.step === step);
            if (noteData) {
                AudioEngine.synths.bass.triggerAttackRelease(
                    noteData.note, "8n", time, noteData.velocity
                );
            }
            Tone.Draw.schedule(() => this.highlightStep(step), time);
        }, steps, "16n").start(0);
    },

    stopSequence() {
        if (this.sequence) {
            this.sequence.stop();
            this.sequence.dispose();
            this.sequence = null;
        }
        this.highlightStep(-1);
    },

    highlightStep(step) {
        // Auto view cells
        const autoCells = document.querySelectorAll(".bass-auto-cell");
        autoCells.forEach((cell, i) => {
            cell.classList.toggle("step-highlight", i === step);
        });
        // Manual view cells
        const manualCells = document.querySelectorAll(".bass-cell");
        manualCells.forEach(cell => {
            const parent = cell.parentElement;
            const siblings = Array.from(parent.children).filter(c => c.classList.contains("bass-cell"));
            const col = siblings.indexOf(cell);
            cell.classList.toggle("step-highlight", col === step);
        });
    },

    loadSectionData(section) {
        this.bassLine = section.bassLine || [];
        this.manualPattern = new Array(16).fill(null);
        this.bassLine.forEach(n => {
            this.manualPattern[n.step] = n.note;
        });
        this.renderDisplay();
    }
};
