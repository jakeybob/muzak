NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

# Alternate names for display
NOTE_DISPLAY = {
    'C#': 'C#/Db', 'D#': 'D#/Eb', 'F#': 'F#/Gb', 'G#': 'G#/Ab', 'A#': 'A#/Bb'
}

# Semitone intervals from root
SCALE_PATTERNS = {
    'major': [0, 2, 4, 5, 7, 9, 11],
    'minor': [0, 2, 3, 5, 7, 8, 10],
}


def get_scale_notes(root: str, scale_type: str = 'major') -> list[str]:
    """Return the 7 notes of a scale."""
    root_idx = NOTES.index(root)
    return [NOTES[(root_idx + interval) % 12] for interval in SCALE_PATTERNS[scale_type]]


def get_all_keys() -> dict:
    """Return available root notes and scale types."""
    return {
        "roots": NOTES,
        "scale_types": list(SCALE_PATTERNS.keys())
    }
