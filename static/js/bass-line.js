const BassLine = {
    container: null,
    bassLine: [],
    mode: "auto",
    sequence: null,
    manualPattern: new Array(16).fill(null),
    availableNotes: [],

    init() {
        this.container = document.getElementById("bass-line");
        this.render();
        this.loadAvailableNotes();

        EventBus.on("playbackStarted", () => this.startSequence());
        EventBus.on("playbackStopped", () => this.stopSequence());
        EventBus.on("progressionChanged", () => {
            if (this.mode === "auto") this.generateBass();
        });
        EventBus.on("keyChanged", () => this.loadAvailableNotes());
    },

    render() {
        this.container.innerHTML = `
            <div class="bass-controls">
                <label>Mode</label>
                <select id="bass-mode">
                    <option value="auto">Auto</option>
                    <option value="manual">Manual</option>
                </select>
                <label style="margin-left: 12px;">Pattern</label>
                <select id="bass-pattern">
                    <option value="Root Notes">Root Notes</option>
                    <option value="Root-Fifth">Root-Fifth</option>
                    <option value="Walking">Walking</option>
                    <option value="Octave Pump">Octave Pump</option>
                </select>
                <button class="btn" id="bass-generate" style="margin-left: 8px;">Generate</button>
            </div>
            <div id="bass-grid" class="bass-grid"></div>
        `;

        document.getElementById("bass-mode").addEventListener("change", (e) => {
            this.mode = e.target.value;
            document.getElementById("bass-pattern").disabled = this.mode === "manual";
            document.getElementById("bass-generate").disabled = this.mode === "manual";
            if (this.mode === "auto") this.generateBass();
        });

        document.getElementById("bass-generate").addEventListener("click", () => this.generateBass());
        document.getElementById("bass-pattern").addEventListener("change", () => {
            if (this.mode === "auto") this.generateBass();
        });
    },

    loadAvailableNotes() {
        const key = AppState.songData.key;
        // Bass notes: one octave of chromatic notes in octave 2, plus a few in octave 3
        this.availableNotes = [
            "B3", "A#3", "A3", "G#3", "G3", "F#3", "F3", "E3", "D#3", "D3", "C#3", "C3",
            "B2", "A#2", "A2", "G#2", "G2", "F#2", "F2", "E2", "D#2", "D2", "C#2", "C2"
        ];
        if (this.mode === "manual") this.renderGrid();
    },

    async generateBass() {
        const chords = AppState.getCurrentSection().chords || [];
        if (chords.length === 0) {
            this.bassLine = [];
            this.renderGrid();
            return;
        }

        const pattern = document.getElementById("bass-pattern").value;
        const key = AppState.songData.key;

        try {
            const resp = await fetch(`/api/bass/${key.root}/${key.scaleType}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ chords, pattern })
            });
            const data = await resp.json();
            this.bassLine = data.bass_line || [];
            AppState.getCurrentSection().bassLine = [...this.bassLine];
            this.renderGrid();
        } catch (err) {
            console.error("Bass generation failed:", err);
        }
    },

    renderGrid() {
        const grid = document.getElementById("bass-grid");
        if (!grid) return;
        grid.innerHTML = "";

        if (this.mode === "auto") {
            // Simple auto display: show which steps have bass notes
            const row = document.createElement("div");
            row.className = "bass-row";

            const label = document.createElement("span");
            label.className = "bass-note-label";
            label.textContent = "Bass";
            row.appendChild(label);

            for (let col = 0; col < 16; col++) {
                const cell = document.createElement("div");
                cell.className = "bass-cell";
                if (col % 4 === 0) cell.classList.add("beat-start");

                const hasNote = this.bassLine.some(n => n.step === col);
                if (hasNote) {
                    cell.classList.add("active");
                    const note = this.bassLine.find(n => n.step === col);
                    cell.title = note.note;
                }
                row.appendChild(cell);
            }
            grid.appendChild(row);
        } else {
            // Manual mode: pitch grid
            const notesToShow = this.availableNotes.slice(6, 18); // Show one octave
            notesToShow.forEach(note => {
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
                        this.renderGrid();
                    });

                    row.appendChild(cell);
                }
                grid.appendChild(row);
            });
        }
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
                    noteData.note,
                    "8n",
                    time,
                    noteData.velocity
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
        const cells = document.querySelectorAll(".bass-cell");
        cells.forEach(cell => {
            // Use position in row to determine column
            const parent = cell.parentElement;
            const children = Array.from(parent.children).filter(c => c.classList.contains("bass-cell"));
            const col = children.indexOf(cell);
            cell.classList.toggle("step-highlight", col === step);
        });
    },

    loadSectionData(section) {
        this.bassLine = section.bassLine || [];
        this.renderGrid();
    }
};
