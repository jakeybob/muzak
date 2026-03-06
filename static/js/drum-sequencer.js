const DrumSequencer = {
    container: null,
    tracks: [
        { name: "kick", label: "Kick" },
        { name: "snare", label: "Snare" },
        { name: "hihatClosed", label: "Hi-Hat" },
        { name: "hihatOpen", label: "Open Hat" },
    ],
    pattern: [],
    muted: [],
    sequence: null,
    currentStep: -1,

    PRESETS: {
        "Empty": () => [
            new Array(16).fill(false),
            new Array(16).fill(false),
            new Array(16).fill(false),
            new Array(16).fill(false),
        ],
        "Basic Rock": () => [
            [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0].map(Boolean),
            [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0].map(Boolean),
            [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0].map(Boolean),
            [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0].map(Boolean),
        ],
        "Four on Floor": () => [
            [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0].map(Boolean),
            [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0].map(Boolean),
            [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0].map(Boolean),
            [0,0,0,0, 0,0,1,0, 0,0,0,0, 0,0,1,0].map(Boolean),
        ],
        "Hip Hop": () => [
            [1,0,0,0, 0,0,1,0, 0,0,1,0, 0,0,0,0].map(Boolean),
            [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,1].map(Boolean),
            [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0].map(Boolean),
            [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0].map(Boolean),
        ],
        "Reggae": () => [
            [1,0,0,0, 0,0,0,0, 0,0,1,0, 0,0,0,0].map(Boolean),
            [0,0,0,0, 0,0,0,1, 0,0,0,0, 0,0,0,1].map(Boolean),
            [0,0,1,0, 1,0,1,0, 0,0,1,0, 1,0,1,0].map(Boolean),
            [0,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0].map(Boolean),
        ],
    },

    init() {
        this.container = document.getElementById("drum-sequencer");
        this.pattern = this.PRESETS["Empty"]();
        this.muted = new Array(this.tracks.length).fill(false);
        this.render();

        EventBus.on("playbackStarted", () => this.startSequence());
        EventBus.on("playbackStopped", () => this.stopSequence());
    },

    render() {
        this.container.innerHTML = `
            <div class="drum-controls">
                <label>Preset</label>
                <select id="drum-preset">
                    ${Object.keys(this.PRESETS).map(name =>
                        `<option value="${name}">${name}</option>`
                    ).join("")}
                </select>
            </div>
            <div class="drum-grid" id="drum-grid"></div>
        `;

        document.getElementById("drum-preset").addEventListener("change", (e) => {
            const preset = this.PRESETS[e.target.value];
            if (preset) {
                this.pattern = preset();
                AppState.getCurrentSection().drumPattern = this.pattern.map(r => [...r]);
                this.renderGrid();
            }
        });

        this.renderGrid();
    },

    renderGrid() {
        const grid = document.getElementById("drum-grid");
        grid.innerHTML = "";

        this.tracks.forEach((track, row) => {
            const rowDiv = document.createElement("div");
            rowDiv.className = "drum-row";

            const label = document.createElement("span");
            label.className = "drum-label";
            label.textContent = track.label;
            rowDiv.appendChild(label);

            for (let col = 0; col < 16; col++) {
                const cell = document.createElement("div");
                cell.className = "drum-cell";
                if (this.pattern[row][col]) cell.classList.add("active", track.name);
                if (col % 4 === 0) cell.classList.add("beat-start");
                cell.dataset.row = row;
                cell.dataset.col = col;
                cell.addEventListener("click", () => this.toggleCell(row, col, cell, track.name));
                rowDiv.appendChild(cell);
            }

            const muteBtn = document.createElement("div");
            muteBtn.className = "drum-mute" + (this.muted[row] ? " muted" : "");
            muteBtn.title = "Mute/Unmute";
            muteBtn.addEventListener("click", () => {
                this.muted[row] = !this.muted[row];
                muteBtn.classList.toggle("muted");
            });
            rowDiv.appendChild(muteBtn);

            grid.appendChild(rowDiv);
        });
    },

    toggleCell(row, col, cell, trackName) {
        this.pattern[row][col] = !this.pattern[row][col];
        cell.classList.toggle("active");
        cell.classList.toggle(trackName);
        AppState.getCurrentSection().drumPattern = this.pattern.map(r => [...r]);
    },

    startSequence() {
        this.stopSequence();
        const steps = [...Array(16).keys()];

        this.sequence = new Tone.Sequence((time, step) => {
            this.tracks.forEach((track, row) => {
                if (this.pattern[row][step] && !this.muted[row]) {
                    AudioEngine.triggerDrum(track.name, time);
                }
            });
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
        this.currentStep = step;
        const cells = document.querySelectorAll(".drum-cell");
        cells.forEach(cell => {
            const col = parseInt(cell.dataset.col);
            cell.classList.toggle("step-highlight", col === step);
        });
    },

    loadSectionData(section) {
        if (section.drumPattern) {
            this.pattern = section.drumPattern.map(r => [...r]);
        } else {
            this.pattern = this.PRESETS["Empty"]();
        }
        this.renderGrid();
    }
};
