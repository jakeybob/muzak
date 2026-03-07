const AudioExporter = {
    exporting: false,

    async exportArrangement(format = "wav") {
        if (this.exporting) return;

        const arrangement = AppState.songData.arrangement;
        const sections = AppState.songData.sections;

        if (arrangement.length === 0) {
            alert("Add sections to the arrangement first.");
            return;
        }

        this.exporting = true;
        const btn = document.getElementById("btn-export");
        const origText = btn ? btn.textContent : "";
        if (btn) { btn.textContent = "Rendering..."; btn.disabled = true; }

        try {
            const bpm = AppState.songData.bpm;
            const oneBar = (60 / bpm) * 4; // seconds per bar in 4/4

            // Calculate total duration
            let totalDuration = 0;
            arrangement.forEach(name => {
                const section = sections.find(s => s.name === name);
                if (!section) return;
                totalDuration += oneBar * Math.max((section.chords || []).length, 1);
            });
            totalDuration += 2; // tail for release/reverb

            // Render offline (faster than real-time)
            const buffer = await Tone.Offline(({ transport }) => {
                transport.bpm.value = bpm;

                // --- Recreate synths in offline context ---
                const master = new Tone.Volume(-6).toDestination();

                const chordSynth = new Tone.PolySynth(Tone.Synth, {
                    maxPolyphony: 8,
                    options: {
                        oscillator: { type: "triangle" },
                        envelope: { attack: 0.05, decay: 0.3, sustain: 0.4, release: 0.8 }
                    }
                }).connect(master);
                chordSynth.volume.value = -8;

                const bassSynth = new Tone.MonoSynth({
                    oscillator: { type: "sawtooth" },
                    filter: { Q: 2, type: "lowpass", frequency: 800 },
                    envelope: { attack: 0.01, decay: 0.2, sustain: 0.5, release: 0.3 },
                    filterEnvelope: {
                        attack: 0.01, decay: 0.1, sustain: 0.4, release: 0.5,
                        baseFrequency: 200, octaves: 2
                    }
                }).connect(master);
                bassSynth.volume.value = -6;

                const kick = new Tone.MembraneSynth({
                    pitchDecay: 0.05, octaves: 6,
                    oscillator: { type: "sine" },
                    envelope: { attack: 0.001, decay: 0.4, sustain: 0, release: 0.4 }
                }).connect(master);
                kick.volume.value = -6;

                const snare = new Tone.NoiseSynth({
                    noise: { type: "white" },
                    envelope: { attack: 0.001, decay: 0.15, sustain: 0, release: 0.1 }
                }).connect(master);
                snare.volume.value = -6;

                const hihatClosed = new Tone.MetalSynth({
                    frequency: 400,
                    envelope: { attack: 0.001, decay: 0.05, release: 0.01 },
                    harmonicity: 5.1, modulationIndex: 32, resonance: 4000, octaves: 1.5
                }).connect(master);
                hihatClosed.volume.value = -12;

                const hihatOpen = new Tone.MetalSynth({
                    frequency: 400,
                    envelope: { attack: 0.001, decay: 0.3, release: 0.1 },
                    harmonicity: 5.1, modulationIndex: 32, resonance: 4000, octaves: 1.5
                }).connect(master);
                hihatOpen.volume.value = -12;

                const drumSynths = { kick, snare, hihatClosed, hihatOpen };
                const drumTrackNames = ["kick", "snare", "hihatClosed", "hihatOpen"];

                // --- Schedule the full arrangement ---
                let currentTime = 0;

                arrangement.forEach(sectionName => {
                    const section = sections.find(s => s.name === sectionName);
                    if (!section) return;
                    const sectionBars = Math.max((section.chords || []).length, 1);

                    // Chords
                    (section.chords || []).forEach((chord, i) => {
                        const time = currentTime + oneBar * i;
                        transport.schedule(t => {
                            chordSynth.triggerAttackRelease(chord.notes, "1m", t);
                        }, time);
                    });

                    // Drums - repeat 16-step pattern per bar
                    const drumPattern = section.drumPattern || [[], [], [], []];
                    for (let bar = 0; bar < sectionBars; bar++) {
                        for (let step = 0; step < 16; step++) {
                            const stepTime = currentTime + (bar * oneBar) + (step * oneBar / 16);
                            drumTrackNames.forEach((name, idx) => {
                                if (drumPattern[idx] && drumPattern[idx][step]) {
                                    transport.schedule(t => {
                                        if (name === "kick") kick.triggerAttackRelease("C1", "8n", t);
                                        else if (name === "snare") snare.triggerAttackRelease("8n", t);
                                        else drumSynths[name].triggerAttackRelease("32n", t);
                                    }, stepTime);
                                }
                            });
                        }
                    }

                    // Bass - repeat 16-step pattern per bar
                    const bassLine = section.bassLine || [];
                    if (bassLine.length > 0) {
                        for (let bar = 0; bar < sectionBars; bar++) {
                            bassLine.forEach(noteData => {
                                const stepTime = currentTime + (bar * oneBar) + (noteData.step * oneBar / 16);
                                transport.schedule(t => {
                                    bassSynth.triggerAttackRelease(
                                        noteData.note, "8n", t, noteData.velocity || 0.8
                                    );
                                }, stepTime);
                            });
                        }
                    }

                    currentTime += oneBar * sectionBars;
                });

                transport.start(0);
            }, totalDuration);

            // Encode and download
            if (format === "mp3") {
                if (btn) btn.textContent = "Encoding MP3...";
                const mp3Blob = await this.bufferToMp3(buffer);
                this.download(mp3Blob, `${AppState.songData.title || "muzak_export"}.mp3`);
            } else {
                const wavData = this.bufferToWav(buffer);
                const blob = new Blob([wavData], { type: "audio/wav" });
                this.download(blob, `${AppState.songData.title || "muzak_export"}.wav`);
            }

        } catch (err) {
            console.error("Export failed:", err);
            alert("Export failed: " + err.message);
        } finally {
            this.exporting = false;
            if (btn) { btn.textContent = origText; btn.disabled = false; }
        }
    },

    // --- WAV encoder (native, no dependencies) ---
    bufferToWav(audioBuffer) {
        const numChannels = audioBuffer.numberOfChannels;
        const sampleRate = audioBuffer.sampleRate;
        const bitDepth = 16;

        // Interleave channels
        let interleaved;
        if (numChannels >= 2) {
            const left = audioBuffer.getChannelData(0);
            const right = audioBuffer.getChannelData(1);
            interleaved = new Float32Array(left.length * 2);
            for (let i = 0; i < left.length; i++) {
                interleaved[i * 2] = left[i];
                interleaved[i * 2 + 1] = right[i];
            }
        } else {
            interleaved = audioBuffer.getChannelData(0);
        }

        const dataLength = interleaved.length * (bitDepth / 8);
        const buffer = new ArrayBuffer(44 + dataLength);
        const view = new DataView(buffer);

        // RIFF header
        this.writeString(view, 0, "RIFF");
        view.setUint32(4, 36 + dataLength, true);
        this.writeString(view, 8, "WAVE");

        // fmt chunk
        this.writeString(view, 12, "fmt ");
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true); // PCM
        view.setUint16(22, numChannels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * numChannels * (bitDepth / 8), true);
        view.setUint16(32, numChannels * (bitDepth / 8), true);
        view.setUint16(34, bitDepth, true);

        // data chunk
        this.writeString(view, 36, "data");
        view.setUint32(40, dataLength, true);

        // PCM samples
        let offset = 44;
        for (let i = 0; i < interleaved.length; i++) {
            const s = Math.max(-1, Math.min(1, interleaved[i]));
            view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
            offset += 2;
        }

        return buffer;
    },

    // --- MP3 encoder (uses lamejs, loaded on demand) ---
    async bufferToMp3(audioBuffer) {
        // Load lamejs if not already loaded
        if (typeof lamejs === "undefined") {
            await this.loadScript(
                "https://cdn.jsdelivr.net/npm/lamejs@1.2.1/lame.min.js"
            );
        }

        const sampleRate = audioBuffer.sampleRate;
        const numChannels = Math.min(audioBuffer.numberOfChannels, 2);
        const kbps = 192;

        const mp3encoder = new lamejs.Mp3Encoder(numChannels, sampleRate, kbps);
        const mp3Data = [];
        const blockSize = 1152;

        // Get channel data as Int16
        const leftF32 = audioBuffer.getChannelData(0);
        const rightF32 = numChannels === 2 ? audioBuffer.getChannelData(1) : leftF32;

        const left = this.floatTo16Bit(leftF32);
        const right = this.floatTo16Bit(rightF32);

        for (let i = 0; i < left.length; i += blockSize) {
            const leftChunk = left.subarray(i, i + blockSize);
            const rightChunk = right.subarray(i, i + blockSize);
            const mp3buf = numChannels === 2
                ? mp3encoder.encodeBuffer(leftChunk, rightChunk)
                : mp3encoder.encodeBuffer(leftChunk);
            if (mp3buf.length > 0) mp3Data.push(mp3buf);
        }

        const end = mp3encoder.flush();
        if (end.length > 0) mp3Data.push(end);

        return new Blob(mp3Data, { type: "audio/mp3" });
    },

    floatTo16Bit(float32Array) {
        const int16 = new Int16Array(float32Array.length);
        for (let i = 0; i < float32Array.length; i++) {
            const s = Math.max(-1, Math.min(1, float32Array[i]));
            int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        return int16;
    },

    loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement("script");
            script.src = src;
            script.onload = resolve;
            script.onerror = () => reject(new Error(`Failed to load ${src}`));
            document.head.appendChild(script);
        });
    },

    writeString(view, offset, str) {
        for (let i = 0; i < str.length; i++) {
            view.setUint8(offset + i, str.charCodeAt(i));
        }
    },

    download(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
};
