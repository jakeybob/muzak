import json
import os
from flask import Flask, render_template, jsonify, request

from music_theory.keys import get_all_keys, NOTES
from music_theory.chords import get_diatonic_chords
from music_theory.progressions import get_progression_names, get_progression_chords
from music_theory.bass import generate_bass_line, BASS_PATTERNS

app = Flask(__name__)

# Ensure saved_songs directory exists
os.makedirs("saved_songs", exist_ok=True)


# --- Page ---

@app.route("/")
def index():
    return render_template("index.html")


# --- Music Theory API ---

@app.route("/api/health")
def health():
    return jsonify({"status": "ok"})


@app.route("/api/keys")
def api_keys():
    return jsonify(get_all_keys())


@app.route("/api/chords/<root>/<scale_type>")
def api_chords(root, scale_type):
    if root not in NOTES:
        return jsonify({"error": f"Invalid root: {root}"}), 400
    if scale_type not in ("major", "minor"):
        return jsonify({"error": f"Invalid scale type: {scale_type}"}), 400
    chords = get_diatonic_chords(root, scale_type)
    return jsonify({"key": root, "scale_type": scale_type, "chords": chords})


@app.route("/api/progressions")
def api_progressions():
    return jsonify({"patterns": get_progression_names()})


@app.route("/api/progressions/<root>/<scale_type>/<pattern_name>")
def api_progression_chords(root, scale_type, pattern_name):
    chords = get_progression_chords(root, scale_type, pattern_name)
    if not chords:
        return jsonify({"error": "Unknown pattern"}), 400
    return jsonify({"key": root, "scale_type": scale_type, "pattern": pattern_name, "chords": chords})


# --- Bass API ---

@app.route("/api/bass/patterns")
def api_bass_patterns():
    return jsonify({"patterns": list(BASS_PATTERNS.keys())})


@app.route("/api/bass/<root>/<scale_type>", methods=["POST"])
def api_generate_bass(root, scale_type):
    data = request.json
    chords = data.get("chords", [])
    pattern = data.get("pattern", "Root Notes")
    bass_line = generate_bass_line(chords, pattern)
    return jsonify({"bass_line": bass_line})


# --- Song Save/Load ---

@app.route("/api/song/save", methods=["POST"])
def save_song():
    data = request.json
    title = data.get("title", "untitled").replace(" ", "_")
    filename = f"{title}.json"
    filepath = os.path.join("saved_songs", filename)
    with open(filepath, "w") as f:
        json.dump(data, f, indent=2)
    return jsonify({"saved": filename})


@app.route("/api/song/load/<filename>")
def load_song(filename):
    filepath = os.path.join("saved_songs", filename)
    if not os.path.exists(filepath):
        return jsonify({"error": "Song not found"}), 404
    with open(filepath) as f:
        data = json.load(f)
    return jsonify(data)


@app.route("/api/song/list")
def list_songs():
    files = [f for f in os.listdir("saved_songs") if f.endswith(".json")]
    return jsonify({"songs": files})


# --- Music Theory Content ---

THEORY_CONTENT = {
    "welcome": {
        "title": "Welcome to Muzak!",
        "text": "Start by selecting a key above. A key determines which notes and chords will sound good together in your song.",
        "tip": "Most pop songs use major keys. Try C major to start - it uses only the white keys on a piano!"
    },
    "key_selection": {
        "title": "Keys and Scales",
        "text": "A key defines which 7 notes sound good together. A major key sounds bright and happy. A minor key sounds darker and more emotional. All the chords and melodies in your song will use notes from this scale.",
        "tip": "Most pop songs are in major keys. C major and G major are the most common starting points."
    },
    "diatonic_chords": {
        "title": "Diatonic Chords",
        "text": "Each note in a scale can be the root of a chord. In a major key, the pattern is always: Major, minor, minor, Major, Major, minor, diminished. These are labeled with Roman numerals: I, ii, iii, IV, V, vi, vii\u00b0.",
        "tip": "Uppercase Roman numerals = major chords (bright). Lowercase = minor chords (dark). The vii\u00b0 is diminished (tense)."
    },
    "chord_functions": {
        "I": {"title": "I - Tonic", "text": "The I chord feels like 'home'. Songs usually start and end here. It's the most stable, resolved sound.", "tip": "Try ending your progression on the I chord for a satisfying resolution."},
        "ii": {"title": "ii - Supertonic", "text": "The ii chord often leads to V, creating the classic ii-V-I jazz progression. It adds gentle forward motion.", "tip": "ii-V-I is the most common progression in jazz."},
        "iii": {"title": "iii - Mediant", "text": "The iii chord is the least used diatonic chord. It shares two notes with both I and V, giving it an ambiguous quality.", "tip": "Use iii as a substitute for I to add surprise."},
        "IV": {"title": "IV - Subdominant", "text": "The IV chord creates gentle movement away from home. It's warm and open, often used in choruses.", "tip": "I-IV is one of the most natural chord movements in music."},
        "V": {"title": "V - Dominant", "text": "The V chord creates the strongest pull back to I. This tension-resolution (V\u2192I) is the foundation of Western harmony.", "tip": "V\u2192I is called a 'perfect cadence' - the strongest way to end a phrase."},
        "vi": {"title": "vi - Submediant", "text": "The vi chord is the relative minor - it shares all its notes with the major key but sounds sadder. I-vi is an emotional shift.", "tip": "Starting a progression on vi gives a minor feel while staying in a major key."},
        "vii\u00b0": {"title": "vii\u00b0 - Leading Tone", "text": "The diminished vii\u00b0 chord is very tense and unstable. It desperately wants to resolve to I.", "tip": "vii\u00b0 is rarely used on its own - it's usually part of a V chord with the 7th."}
    },
    "rhythm_basics": {
        "title": "Rhythm and Beats",
        "text": "A bar (measure) typically has 4 beats. The kick drum usually plays on beats 1 and 3. The snare hits on beats 2 and 4 (the 'backbeat'). Hi-hats often play eighth notes (every half-beat).",
        "tip": "The backbeat (snare on 2 and 4) is what makes music feel like rock/pop. Without it, music sounds like a march."
    },
    "bass_basics": {
        "title": "Bass Lines",
        "text": "The bass provides the harmonic foundation. The simplest bass line plays the root note of each chord. More interesting bass lines add the 5th, walk between chord tones, or use rhythmic patterns.",
        "tip": "Start with root notes on beat 1, then experiment with adding the 5th on beat 3."
    },
    "song_structure": {
        "title": "Song Structure",
        "text": "Most songs follow a pattern of sections: Intro, Verse, Chorus, Verse, Chorus, Bridge, Chorus, Outro. Each section can have different chord progressions and energy levels.",
        "tip": "The chorus should feel bigger and more energetic than the verse. Try using different chord progressions for each."
    }
}


@app.route("/api/theory/<topic>")
def api_theory(topic):
    content = THEORY_CONTENT.get(topic)
    if not content:
        return jsonify({"title": "Music Theory", "text": "Select a topic to learn more.", "tip": ""})
    return jsonify(content)


@app.route("/api/theory/chord/<roman>")
def api_theory_chord(roman):
    functions = THEORY_CONTENT.get("chord_functions", {})
    content = functions.get(roman)
    if not content:
        return jsonify({"title": roman, "text": "Information about this chord.", "tip": ""})
    return jsonify(content)


if __name__ == "__main__":
    app.run(debug=True, port=5000)
