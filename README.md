# Muzak

An interactive browser-based music creation and learning tool. Build songs from scratch using chord progressions, drum patterns, and bass lines — all while learning the music theory behind what makes them work.

All of this was written using [Claude Code](https://claude.com/product/claude-code).

## YouTube Demo Video
[![](https://img.youtube.com/vi/R62xHIuuaRg/0.jpg)](https://www.youtube.com/watch?v=R62xHIuuaRg)


## Features

### Chord Progression Builder
- Pick a key and scale (major or minor) to generate the 7 diatonic chords
- Click chords to add them to an 8-slot progression timeline
- Load preset progressions (Pop, Blues, 50s, Rock, Sad, Canon, Jazz, Axis)
- Right-click any chord on the timeline to change its type: major, minor, diminished, augmented, 7th, maj7, min7, 9th, maj9, min9, 11th, sus2, sus4
- Hear each chord previewed as you build

### Drum Sequencer
- 16-step grid for kick, snare, hi-hat (closed), and open hat
- Built-in presets: Basic Rock, Four on the Floor, Hip Hop, Reggae
- Per-track mute controls
- Click cells to toggle individual hits

### Bass Line
- **Auto mode** — generates bass patterns from your chord progression using Root Notes, Root-Fifth, Walking, or Octave Pump patterns
- **Manual mode** — 20-row piano roll (C2–G3) for writing custom bass lines
- Notes in the current key are highlighted in the piano roll for easy composition

### Song Structure
- Create named sections (Intro, Verse, Chorus, Bridge, Outro, Custom)
- Each section stores its own chords, drum pattern, and bass line independently
- Build an arrangement by ordering section blocks
- Save and load songs as JSON files

### Live Sound Design
- **Chord Synth** — waveform, ADSR envelope, volume
- **Bass Synth** — waveform, ADSR envelope, filter cutoff, volume
- **Drums** — individual volumes for kick, snare, hi-hat, open hat, plus an overall drum bus volume
- **Effects** — reverb (time, mix), delay (time, feedback, mix), master volume
- Reset-to-defaults button on each group

### Mixer Controls
- Mute (M) and Solo (S) buttons on the Chord Progression, Drum Sequencer, and Bass Line sections
- Solo isolates a single instrument; mute silences it — they are mutually exclusive per channel

### Visualizer
- Real-time audio display with two modes: waveform oscilloscope and spectrum analyser
- Rainbow colour gradient rendering with glow and reflection effects

### Audio Export
- Render the full arrangement to WAV or MP3
- Uses offline rendering (faster than real-time) via Tone.Offline
- MP3 encoding powered by lamejs (loaded on demand from CDN)

### Music Theory Panel
- Contextual educational content that updates as you interact
- Topics: Keys & Scales, Diatonic Chords, Rhythm & Beats, Bass Lines, Song Structure
- Explains chord functions when you select chords

---

## Technical Details

### Architecture

Muzak uses a **Flask** backend serving a single-page HTML frontend. The backend provides REST API endpoints for music theory data (scales, chords, progressions) and song persistence. All audio synthesis and playback happens in the browser using **Tone.js** and the **Web Audio API**.

The frontend is built as a set of loosely-coupled JavaScript modules that communicate via a pub/sub **EventBus**. Global state is managed through a shared **AppState** object.

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python 3.13, Flask 3.x |
| Audio | Tone.js v14 (CDN), Web Audio API |
| Visualisation | HTML5 Canvas 2D |
| Export | Tone.Offline, lamejs (CDN, for MP3) |
| Environment | Conda (environment name: `muzak`) |

### Setup

1. **Create the conda environment:**
   ```bash
   conda env create -f environment.yml
   conda activate muzak
   ```

   Or manually:
   ```bash
   conda create -n muzak python=3.13
   conda activate muzak
   pip install flask>=3.0
   ```

2. **Run the app:**
   ```bash
   python app.py
   ```

3. **Open in browser:**
   Navigate to `http://127.0.0.1:5000`

### File Structure

```
muzak/
├── app.py                     # Flask server and API routes
├── requirements.txt           # Python dependencies (flask>=3.0)
├── environment.yml            # Conda environment specification
│
├── music_theory/              # Python music theory engine
│   ├── __init__.py
│   ├── keys.py                # Notes, scales, key generation
│   ├── chords.py              # Chord intervals, diatonic chord building
│   ├── progressions.py        # Common chord progression patterns
│   └── bass.py                # Bass line pattern definitions
│
├── templates/
│   └── index.html             # Single-page app shell
│
├── static/
│   ├── css/
│   │   └── style.css          # Dark theme, all component styles
│   └── js/
│       ├── audio-engine.js    # Tone.js synth/effects initialisation
│       ├── chord-builder.js   # Chord palette, timeline, type switching
│       ├── drum-sequencer.js  # 16-step drum grid with presets
│       ├── bass-line.js       # Auto/manual bass line editor
│       ├── song-structure.js  # Section management and arrangement
│       ├── sound-design.js    # Live parameter controls with defaults
│       ├── theory-panel.js    # Contextual music theory display
│       ├── visualizer.js      # Waveform/spectrum canvas rendering
│       ├── exporter.js        # WAV/MP3 offline render and download
│       └── main.js            # EventBus, AppState, MixerState, init
│
└── saved_songs/               # JSON song file storage
```

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Serve the app |
| GET | `/api/keys` | Available root notes and scale types |
| GET | `/api/chords/<root>/<scale>` | Diatonic chords for a key |
| GET | `/api/progressions` | List preset progression names |
| GET | `/api/progressions/<root>/<scale>/<name>` | Chords for a preset progression |
| GET | `/api/bass/patterns` | Available bass patterns |
| POST | `/api/bass/<root>/<scale>` | Generate a bass line from chords |
| GET | `/api/theory/<topic>` | Educational content for a topic |
| GET | `/api/theory/chord/<roman>` | Chord function explanation |
| POST | `/api/song/save` | Save song data as JSON |
| GET | `/api/song/load/<filename>` | Load a saved song |
| GET | `/api/song/list` | List saved songs |

### How It Works

**Audio:** All sound is generated client-side. Tone.js provides a `PolySynth` for chords, `MonoSynth` for bass, `MembraneSynth` for kick, `NoiseSynth` for snare, and `MetalSynth` for hi-hats. These route through delay and reverb effects into a master channel. An `AnalyserNode` taps the output for the visualizer.

**Playback:** The `Tone.Transport` clock synchronises all instruments. In section mode, chord/drum/bass modules schedule their own loops. In arrangement mode, the `ArrangementPlayer` calculates time offsets for each section and schedules every note onto the transport.

**Modules:** Each UI module (ChordBuilder, DrumSequencer, BassLine, etc.) is a self-contained object that manages its own DOM rendering and state. Modules communicate indirectly through `EventBus` events like `keyChanged`, `progressionChanged`, and `playbackStarted`.

**Mixer:** The `MixerState` object manages per-channel mute/solo by setting synth volumes to `-Infinity` (muted) or their user-set value (audible). Solo mode silences all non-soloed channels.
