from .keys import NOTES


BASS_PATTERNS = {
    "Root Notes": "root",
    "Root-Fifth": "root_fifth",
    "Walking": "walking",
    "Octave Pump": "octave_pump",
}


def generate_bass_line(chords: list[dict], pattern_name: str, steps_per_chord: int = 4) -> list[dict]:
    """
    Generate a bass line from a chord progression.
    Returns list of {step, note, velocity} for 16 steps.
    """
    if not chords:
        return []

    pattern_key = BASS_PATTERNS.get(pattern_name, "root")
    bass_line = []
    total_steps = 16

    # Distribute chords across 16 steps
    steps_per = total_steps // max(len(chords), 1)

    for chord_idx, chord in enumerate(chords):
        root = chord["root"]
        notes = chord.get("notes", [])

        # Transpose to octave 2 for bass
        bass_root = f"{root}2"

        # Get the fifth (3rd note in the triad)
        if len(notes) >= 3:
            fifth_note = notes[2].replace("4", "2").replace("5", "3")
        else:
            fifth_note = bass_root

        start_step = chord_idx * steps_per

        for s in range(steps_per):
            step = start_step + s
            if step >= total_steps:
                break

            note = None
            velocity = 0.8

            if pattern_key == "root":
                if s == 0:
                    note = bass_root
                    velocity = 1.0
            elif pattern_key == "root_fifth":
                if s == 0:
                    note = bass_root
                    velocity = 1.0
                elif s == 2:
                    note = fifth_note
                    velocity = 0.7
            elif pattern_key == "walking":
                if s == 0:
                    note = bass_root
                    velocity = 1.0
                elif s == 1:
                    # Walk up using chord tones
                    if len(notes) >= 2:
                        note = notes[1].replace("4", "2").replace("5", "3")
                    velocity = 0.6
                elif s == 2:
                    note = fifth_note
                    velocity = 0.7
                elif s == 3:
                    # Approach next chord root
                    note = fifth_note
                    velocity = 0.5
            elif pattern_key == "octave_pump":
                if s == 0:
                    note = bass_root
                    velocity = 1.0
                elif s == 2:
                    note = f"{root}3"
                    velocity = 0.7

            if note:
                bass_line.append({
                    "step": step,
                    "note": note,
                    "velocity": velocity
                })

    return bass_line
