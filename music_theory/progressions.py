from .chords import get_diatonic_chords

# Common chord progressions as scale degree indices (1-based)
COMMON_PROGRESSIONS = {
    "Pop (I-V-vi-IV)": [1, 5, 6, 4],
    "Blues (I-I-IV-V)": [1, 1, 4, 5],
    "50s (I-vi-IV-V)": [1, 6, 4, 5],
    "Rock (I-IV-V-V)": [1, 4, 5, 5],
    "Sad (vi-IV-I-V)": [6, 4, 1, 5],
    "Canon (I-V-vi-iii-IV-I-IV-V)": [1, 5, 6, 3, 4, 1, 4, 5],
    "Jazz ii-V-I": [2, 5, 1, 1],
    "Axis (I-V-vi-IV repeated)": [1, 5, 6, 4, 1, 5, 6, 4],
}


def get_progression_names() -> list[str]:
    """Return list of available progression pattern names."""
    return list(COMMON_PROGRESSIONS.keys())


def get_progression_chords(root: str, scale_type: str, pattern_name: str) -> list[dict]:
    """Resolve a named progression to actual chord objects in a given key."""
    if pattern_name not in COMMON_PROGRESSIONS:
        return []

    all_chords = get_diatonic_chords(root, scale_type)
    degrees = COMMON_PROGRESSIONS[pattern_name]

    return [all_chords[d - 1] for d in degrees]
