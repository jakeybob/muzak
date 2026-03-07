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
    playMode: null, // "section" or "arrangement"
    availableChords: [],

    getCurrentSection() {
        return this.songData.sections[this.currentSectionIndex];
    },

    updateCurrentSection(updates) {
        Object.assign(this.songData.sections[this.currentSectionIndex], updates);
    }
};

// Arrangement Player - schedules the full arrangement onto the transport
const ArrangementPlayer = {
    scheduledEvents: [],
    drumTracks: ["kick", "snare", "hihatClosed", "hihatOpen"],

    play() {
        this.stop();

        const arrangement = AppState.songData.arrangement;
        const sections = AppState.songData.sections;

        if (arrangement.length === 0) return;

        Tone.Transport.cancel();
        const barDuration = Tone.Time("1m").toSeconds();
        let currentTime = 0;
        let totalBars = 0;

        arrangement.forEach((sectionName, arrIndex) => {
            const section = sections.find(s => s.name === sectionName);
            if (!section) return;

            // Section duration in bars = number of chords, minimum 1
            const sectionBars = Math.max((section.chords || []).length, 1);
            const sectionStartTime = currentTime;

            // Schedule chords
            (section.chords || []).forEach((chord, chordIdx) => {
                const time = sectionStartTime + (barDuration * chordIdx);
                const id = Tone.Transport.schedule((t) => {
                    AudioEngine.synths.chords.triggerAttackRelease(chord.notes, "1m", t);
                }, time);
                this.scheduledEvents.push(id);
            });

            // Schedule drums - repeat the 16-step pattern for each bar in the section
            const drumPattern = section.drumPattern || [[], [], [], []];
            for (let bar = 0; bar < sectionBars; bar++) {
                for (let step = 0; step < 16; step++) {
                    const stepTime = sectionStartTime + (bar * barDuration) + (step * barDuration / 16);
                    this.drumTracks.forEach((trackName, trackIdx) => {
                        if (drumPattern[trackIdx] && drumPattern[trackIdx][step]) {
                            const id = Tone.Transport.schedule((t) => {
                                AudioEngine.triggerDrum(trackName, t);
                            }, stepTime);
                            this.scheduledEvents.push(id);
                        }
                    });
                }
            }

            // Schedule bass - repeat the 16-step bass line for each bar in the section
            const bassLine = section.bassLine || [];
            if (bassLine.length > 0) {
                for (let bar = 0; bar < sectionBars; bar++) {
                    bassLine.forEach((noteData) => {
                        const stepTime = sectionStartTime + (bar * barDuration) + (noteData.step * barDuration / 16);
                        const id = Tone.Transport.schedule((t) => {
                            AudioEngine.synths.bass.triggerAttackRelease(
                                noteData.note, "8n", t, noteData.velocity || 0.8
                            );
                        }, stepTime);
                        this.scheduledEvents.push(id);
                    });
                }
            }

            // Schedule visual highlight for this arrangement block
            const id = Tone.Transport.schedule((t) => {
                Tone.Draw.schedule(() => {
                    EventBus.emit("arrangementBlockPlaying", arrIndex);
                }, t);
            }, sectionStartTime);
            this.scheduledEvents.push(id);

            currentTime += barDuration * sectionBars;
            totalBars += sectionBars;
        });

        // Set transport to loop the whole arrangement (or not - user choice)
        Tone.Transport.loop = true;
        Tone.Transport.loopEnd = currentTime;
        Tone.Transport.bpm.value = AppState.songData.bpm;
        Tone.Transport.start();
    },

    stop() {
        this.scheduledEvents.forEach(id => Tone.Transport.clear(id));
        this.scheduledEvents = [];
        Tone.Transport.cancel();
        Tone.Transport.stop();
        Tone.Transport.position = 0;
        EventBus.emit("arrangementBlockPlaying", -1);
    }
};

// App initialization
document.addEventListener("DOMContentLoaded", () => {
    const btnPlay = document.getElementById("btn-play");
    const btnPlayArr = document.getElementById("btn-play-arrangement");
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

    function stopAll() {
        const wasArrangement = AppState.playMode === "arrangement";
        AppState.isPlaying = false;
        AppState.playMode = null;
        btnPlay.classList.remove("active");
        btnPlayArr.classList.remove("active");

        if (wasArrangement) {
            ArrangementPlayer.stop();
        } else {
            Tone.Transport.stop();
            Tone.Transport.cancel();
            Tone.Transport.position = 0;
        }

        AudioEngine.stopAll();
        EventBus.emit("playbackStopped");
    }

    // Play button - loops current section
    btnPlay.addEventListener("click", async () => {
        await AudioEngine.init();

        if (AppState.isPlaying) {
            stopAll();
            return;
        }

        AppState.isPlaying = true;
        AppState.playMode = "section";
        btnPlay.classList.add("active");
        btnPlayArr.classList.remove("active");

        Tone.Transport.cancel();
        Tone.Transport.bpm.value = AppState.songData.bpm;
        Tone.Transport.start();
        EventBus.emit("playbackStarted");
    });

    // Play Arrangement button - plays full arrangement
    btnPlayArr.addEventListener("click", async () => {
        await AudioEngine.init();

        if (AppState.isPlaying && AppState.playMode === "arrangement") {
            stopAll();
            return;
        }

        // Stop any existing playback first
        if (AppState.isPlaying) {
            Tone.Transport.stop();
            Tone.Transport.cancel();
            Tone.Transport.position = 0;
            EventBus.emit("playbackStopped");
        }

        AppState.isPlaying = true;
        AppState.playMode = "arrangement";
        btnPlayArr.classList.add("active");
        btnPlay.classList.remove("active");

        ArrangementPlayer.play();
        EventBus.emit("arrangementPlaybackStarted");
    });

    // Stop button
    btnStop.addEventListener("click", () => {
        stopAll();
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
