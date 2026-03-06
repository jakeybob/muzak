// Event Bus for inter-module communication
const EventBus = {
    listeners: {},
    on(event, callback) {
        (this.listeners[event] = this.listeners[event] || []).push(callback);
    },
    emit(event, data) {
        (this.listeners[event] || []).forEach(cb => cb(data));
    }
};

// Global application state
const AppState = {
    songData: {
        title: "Untitled",
        bpm: 120,
        key: { root: "C", scaleType: "major" },
        sections: [{
            name: "Main",
            bars: 4,
            chords: [],
            drumPattern: [
                new Array(16).fill(false),
                new Array(16).fill(false),
                new Array(16).fill(false),
                new Array(16).fill(false)
            ],
            bassPattern: "Root Notes",
            bassLine: []
        }],
        arrangement: ["Main"],
        soundDesign: {}
    },
    currentSectionIndex: 0,
    isPlaying: false,
    availableChords: [],

    getCurrentSection() {
        return this.songData.sections[this.currentSectionIndex];
    },

    updateCurrentSection(updates) {
        Object.assign(this.songData.sections[this.currentSectionIndex], updates);
    }
};

// App initialization
document.addEventListener("DOMContentLoaded", () => {
    const btnPlay = document.getElementById("btn-play");
    const btnStop = document.getElementById("btn-stop");
    const bpmSlider = document.getElementById("bpm-slider");
    const bpmDisplay = document.getElementById("bpm-display");

    // Initialize all modules
    ChordBuilder.init();
    DrumSequencer.init();
    BassLine.init();
    SongStructure.init();
    SoundDesign.init();
    TheoryPanel.init();

    // Play button
    btnPlay.addEventListener("click", async () => {
        await AudioEngine.init();

        if (AppState.isPlaying) return;
        AppState.isPlaying = true;
        btnPlay.classList.add("active");

        Tone.Transport.bpm.value = AppState.songData.bpm;
        Tone.Transport.start();
        EventBus.emit("playbackStarted");
    });

    // Stop button
    btnStop.addEventListener("click", () => {
        AppState.isPlaying = false;
        btnPlay.classList.remove("active");

        Tone.Transport.stop();
        Tone.Transport.position = 0;
        AudioEngine.stopAll();
        EventBus.emit("playbackStopped");
    });

    // BPM slider
    bpmSlider.addEventListener("input", (e) => {
        const bpm = parseInt(e.target.value);
        AppState.songData.bpm = bpm;
        Tone.Transport.bpm.value = bpm;
        bpmDisplay.textContent = `BPM: ${bpm}`;
    });

    console.log("Muzak initialized");
});
