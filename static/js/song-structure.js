const SongStructure = {
    container: null,

    SECTION_COLORS: {
        "Intro": "#45b7d1",
        "Verse": "#4ecdc4",
        "Chorus": "#e94560",
        "Bridge": "#f7b731",
        "Outro": "#9b59b6",
        "Custom": "#888",
    },

    init() {
        this.container = document.getElementById("song-structure");
        this.render();

        EventBus.on("arrangementBlockPlaying", (index) => this.highlightArrangementBlock(index));
        EventBus.on("playbackStopped", () => this.highlightArrangementBlock(-1));
    },

    highlightArrangementBlock(index) {
        const blocks = document.querySelectorAll(".arrangement-block");
        blocks.forEach((block, i) => {
            block.classList.toggle("playing", i === index);
        });
    },

    render() {
        const sections = AppState.songData.sections;
        const arrangement = AppState.songData.arrangement;
        const currentIdx = AppState.currentSectionIndex;

        this.container.innerHTML = `
            <div class="structure-controls">
                <select id="new-section-type">
                    ${Object.keys(this.SECTION_COLORS).map(type =>
                        `<option value="${type}">${type}</option>`
                    ).join("")}
                </select>
                <button class="btn" id="add-section">+ Add Section</button>
                <span style="margin-left: auto; font-size: 0.75rem; color: var(--text-muted);">
                    Save/Load:
                </span>
                <button class="btn btn-small" id="save-song">Save</button>
                <button class="btn btn-small" id="load-song">Load</button>
            </div>

            <div class="section-list" id="section-list">
                ${sections.map((section, i) => `
                    <div class="section-item ${i === currentIdx ? 'active' : ''}" data-index="${i}">
                        <div class="section-color" style="background: ${this.getColor(section.name)}"></div>
                        <span class="section-name">${section.name}</span>
                        <span class="section-info">${(section.chords || []).length} chords</span>
                        <button class="btn btn-small" data-action="add-to-arrangement" data-index="${i}">+Arr</button>
                        ${sections.length > 1 ? `<button class="section-remove" data-index="${i}">&times;</button>` : ''}
                    </div>
                `).join("")}
            </div>

            <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">
                Arrangement
            </div>
            <div class="arrangement-bar" id="arrangement-bar">
                ${arrangement.map((name, i) => `
                    <div class="arrangement-block" style="background: ${this.getColor(name)}" data-index="${i}">
                        ${name}
                        <button class="arr-remove" data-index="${i}">&times;</button>
                    </div>
                `).join("")}
                ${arrangement.length === 0 ? '<span style="color: var(--text-muted); font-size: 0.75rem; padding: 8px;">Click +Arr to add sections</span>' : ''}
            </div>
        `;

        // Event listeners
        document.getElementById("add-section").addEventListener("click", () => this.addSection());
        document.getElementById("save-song").addEventListener("click", () => this.saveSong());
        document.getElementById("load-song").addEventListener("click", () => this.loadSongDialog());

        // Section clicks
        this.container.querySelectorAll(".section-item").forEach(item => {
            item.addEventListener("click", (e) => {
                if (e.target.classList.contains("section-remove") ||
                    e.target.dataset.action === "add-to-arrangement" ||
                    e.target.classList.contains("btn")) return;
                const idx = parseInt(item.dataset.index);
                this.switchSection(idx);
            });
        });

        // Remove section
        this.container.querySelectorAll(".section-remove").forEach(btn => {
            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                this.removeSection(parseInt(btn.dataset.index));
            });
        });

        // Add to arrangement
        this.container.querySelectorAll("[data-action='add-to-arrangement']").forEach(btn => {
            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                const idx = parseInt(btn.dataset.index);
                this.addToArrangement(idx);
            });
        });

        // Remove from arrangement
        this.container.querySelectorAll(".arr-remove").forEach(btn => {
            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                const idx = parseInt(btn.dataset.index);
                AppState.songData.arrangement.splice(idx, 1);
                this.render();
            });
        });
    },

    getColor(sectionName) {
        for (const [type, color] of Object.entries(this.SECTION_COLORS)) {
            if (sectionName.includes(type)) return color;
        }
        return this.SECTION_COLORS.Custom;
    },

    addSection() {
        const type = document.getElementById("new-section-type").value;
        const existing = AppState.songData.sections.filter(s => s.name.startsWith(type));
        const name = existing.length > 0 ? `${type} ${existing.length + 1}` : type;

        AppState.songData.sections.push({
            name,
            bars: 4,
            chords: [],
            drumPattern: [
                new Array(16).fill(false),
                new Array(16).fill(false),
                new Array(16).fill(false),
                new Array(16).fill(false),
            ],
            bassPattern: "Root Notes",
            bassLine: []
        });

        this.render();
    },

    removeSection(index) {
        if (AppState.songData.sections.length <= 1) return;
        const removed = AppState.songData.sections.splice(index, 1)[0];

        // Remove from arrangement
        AppState.songData.arrangement = AppState.songData.arrangement.filter(n => n !== removed.name);

        if (AppState.currentSectionIndex >= AppState.songData.sections.length) {
            AppState.currentSectionIndex = AppState.songData.sections.length - 1;
        }

        this.switchSection(AppState.currentSectionIndex);
        this.render();
    },

    addToArrangement(sectionIndex) {
        const name = AppState.songData.sections[sectionIndex].name;
        AppState.songData.arrangement.push(name);
        this.render();
    },

    switchSection(index) {
        AppState.currentSectionIndex = index;
        const section = AppState.getCurrentSection();

        // Load section data into all editors
        if (typeof ChordBuilder !== 'undefined') ChordBuilder.loadSectionData(section);
        if (typeof DrumSequencer !== 'undefined') DrumSequencer.loadSectionData(section);
        if (typeof BassLine !== 'undefined') BassLine.loadSectionData(section);

        this.render();
        EventBus.emit("sectionChanged", section);
    },

    async saveSong() {
        const title = prompt("Song title:", AppState.songData.title);
        if (!title) return;
        AppState.songData.title = title;

        try {
            const resp = await fetch("/api/song/save", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(AppState.songData)
            });
            const data = await resp.json();
            alert(`Saved: ${data.saved}`);
        } catch (err) {
            console.error("Save failed:", err);
        }
    },

    async loadSongDialog() {
        try {
            const resp = await fetch("/api/song/list");
            const data = await resp.json();

            if (data.songs.length === 0) {
                alert("No saved songs found.");
                return;
            }

            const choice = prompt(
                `Available songs:\n${data.songs.map((s, i) => `${i + 1}. ${s}`).join("\n")}\n\nEnter number to load:`
            );
            if (!choice) return;

            const idx = parseInt(choice) - 1;
            if (idx < 0 || idx >= data.songs.length) return;

            const songResp = await fetch(`/api/song/load/${data.songs[idx]}`);
            const songData = await songResp.json();

            AppState.songData = songData;
            AppState.currentSectionIndex = 0;

            this.switchSection(0);
            this.render();

            // Update key selectors
            document.getElementById("key-root").value = songData.key.root;
            document.getElementById("key-scale").value = songData.key.scaleType;
            if (typeof ChordBuilder !== 'undefined') ChordBuilder.onKeyChange();

            // Update BPM
            document.getElementById("bpm-slider").value = songData.bpm;
            document.getElementById("bpm-display").textContent = `BPM: ${songData.bpm}`;
            Tone.Transport.bpm.value = songData.bpm;

        } catch (err) {
            console.error("Load failed:", err);
        }
    }
};
