const TheoryPanel = {
    container: null,

    TOPICS: [
        { key: "key_selection", label: "Keys & Scales" },
        { key: "diatonic_chords", label: "Diatonic Chords" },
        { key: "rhythm_basics", label: "Rhythm & Beats" },
        { key: "bass_basics", label: "Bass Lines" },
        { key: "song_structure", label: "Song Structure" },
    ],

    init() {
        this.container = document.getElementById("theory-content");
        this.renderWelcome();

        EventBus.on("keyChanged", () => this.showTopic("key_selection"));
        EventBus.on("chordSelected", (chord) => this.showChordTheory(chord));
        EventBus.on("progressionChanged", () => this.showTopic("diatonic_chords"));
    },

    renderWelcome() {
        this.container.innerHTML = `
            <div class="theory-section">
                <div class="theory-title">Welcome to Muzak!</div>
                <div class="theory-text">
                    This app helps you learn music theory by doing. Start by selecting a key,
                    then build chord progressions, add drums and bass.
                </div>
                <div class="theory-tip">
                    Tip: Click any chord pad to hear it and add it to your progression!
                </div>
            </div>
            <div class="theory-topics" id="theory-topics">
                <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">
                    Learn About:
                </div>
                ${this.TOPICS.map(t => `
                    <button class="theory-topic-btn" data-topic="${t.key}">${t.label}</button>
                `).join("")}
            </div>
        `;

        this.container.querySelectorAll(".theory-topic-btn").forEach(btn => {
            btn.addEventListener("click", () => this.showTopic(btn.dataset.topic));
        });
    },

    async showTopic(topic) {
        try {
            const data = await fetch(`/api/theory/${topic}`).then(r => r.json());
            this.renderTheory(data);
        } catch (err) {
            console.error("Theory fetch failed:", err);
        }
    },

    async showChordTheory(chord) {
        try {
            const data = await fetch(`/api/theory/chord/${encodeURIComponent(chord.roman)}`).then(r => r.json());
            this.renderTheory(data);
        } catch (err) {
            console.error("Chord theory fetch failed:", err);
        }
    },

    renderTheory(data) {
        this.container.innerHTML = `
            <div class="theory-section">
                <div class="theory-title">${data.title || "Music Theory"}</div>
                <div class="theory-text">${data.text || ""}</div>
                ${data.tip ? `<div class="theory-tip">Tip: ${data.tip}</div>` : ""}
            </div>
            <div class="theory-topics" id="theory-topics">
                <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">
                    More Topics:
                </div>
                ${this.TOPICS.map(t => `
                    <button class="theory-topic-btn" data-topic="${t.key}">${t.label}</button>
                `).join("")}
            </div>
        `;

        this.container.querySelectorAll(".theory-topic-btn").forEach(btn => {
            btn.addEventListener("click", () => this.showTopic(btn.dataset.topic));
        });
    }
};
