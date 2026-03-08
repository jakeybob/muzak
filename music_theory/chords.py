from .keys import NOTES, get_scale_notes

# Intervals from chord root for each quality (in semitones)
CHORD_INTERVALS = {
    'major': [0, 4, 7],
    'minor': [0, 3, 7],
    'diminished': [0, 3, 6],
    'augmented': [0, 4, 8],
    '7': [0, 4, 7, 10],
    'maj7': [0, 4, 7, 11],
    'min7': [0, 3, 7, 10],
    '9': [0, 4, 7, 10, 14],
    'maj9': [0, 4, 7, 11, 14],
    'min9': [0, 3, 7, 10, 14],
    '11': [0, 4, 7, 10, 14, 17],
    'sus2': [0, 2, 7],
    'sus4': [0, 5, 7],
}

# Quality of each scale degree in a major key
MAJOR_QUALITIES = ['major', 'minor', 'minor', 'major', 'major', 'minor', 'diminished']
MAJOR_ROMANS = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii\u00b0']

# Quality of each scale degree in a minor key
MINOR_QUALITIES = ['minor', 'diminished', 'major', 'minor', 'minor', 'major', 'major']
MINOR_ROMANS = ['i', 'ii\u00b0', 'III', 'iv', 'v', 'VI', 'VII']


def build_chord(root: str, quality: str, octave: int = 4) -> list[str]:
    """Build a chord with note names and octaves for Tone.js."""
    root_idx = NOTES.index(root)
    intervals = CHORD_INTERVALS[quality]
    notes = []
    for interval in intervals:
        note_idx = (root_idx + interval) % 12
        note_octave = octave + ((root_idx + interval) // 12)
        notes.append(f"{NOTES[note_idx]}{note_octave}")
    return notes


def get_diatonic_chords(root: str, scale_type: str = 'major') -> list[dict]:
    """Return the 7 diatonic chords for a key with notes, quality, and roman numerals."""
    scale_notes = get_scale_notes(root, scale_type)

    if scale_type == 'major':
        qualities = MAJOR_QUALITIES
        romans = MAJOR_ROMANS
    else:
        qualities = MINOR_QUALITIES
        romans = MINOR_ROMANS

    chords = []
    for i, (note, quality, roman) in enumerate(zip(scale_notes, qualities, romans)):
        chord_notes = build_chord(note, quality, octave=4)
        chords.append({
            "index": i,
            "root": note,
            "quality": quality,
            "roman": roman,
            "notes": chord_notes,
            "label": f"{note} {quality[:3]}" if quality != 'major' else note,
            "degree": i + 1
        })

    return chords
