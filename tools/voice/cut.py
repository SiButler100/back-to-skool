#!/usr/bin/env python3
"""
CUT A RECORDING INTO ITS LINES

Higgsfield speaks several lines in one clip if they are given with a blank
line between them, and leaves a pause of about a second at each blank line.
This script finds those pauses and saves each line as its own small file.

    python3 tools/voice/cut.py recording.mp3 out-folder name1 name2 name3 ...

One name per line, in the order the lines were spoken. If the number of
pieces found is not the number of names given, nothing is written and the
script says so: a miscount means a line was run together or split in two,
and guessing would put the wrong words on the wrong clip.

Needs ffmpeg. Pauses shorter than 0.6 s are ignored, so a comma inside a
line never splits it.
"""
import os
import re
import subprocess
import sys

PAUSE = 0.6          # seconds of quiet that count as "between lines"
QUIET = '-38dB'      # how quiet counts as quiet
PAD = 0.07           # seconds of the pause kept either side of each line, so nothing is clipped


def pauses(path):
    """Every pause in the recording as (start, end), and the recording's length."""
    out = subprocess.run(['ffmpeg', '-hide_banner', '-i', path, '-af', f'silencedetect=noise={QUIET}:d=0.2', '-f', 'null', '-'],
                         capture_output=True, text=True).stderr
    starts = [float(x) for x in re.findall(r'silence_start: ([0-9.]+)', out)]
    ends = [float(x) for x in re.findall(r'silence_end: ([0-9.]+)', out)]
    length = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path],
                                  capture_output=True, text=True).stdout)
    if len(starts) > len(ends):          # the recording ends in a pause
        ends.append(length)
    # Keep the pauses that separate lines (long ones), and any quiet at the very
    # start or end of the recording however short, so it is trimmed off.
    found = [(a, b) for a, b in zip(starts, ends) if b - a >= PAUSE or a < 0.05 or b > length - 0.05]
    return found, length


def lines(path):
    """The stretches of speech between the pauses, as (start, end)."""
    gaps, length = pauses(path)
    speech, at = [], 0.0
    for start, end in gaps:
        if start - at > 0.15:
            speech.append((at, start))
        at = end
    if length - at > 0.15:
        speech.append((at, length))
    return speech


def cut(path, folder, names):
    speech = lines(path)
    if len(speech) != len(names):
        print(f'{os.path.basename(path)}: found {len(speech)} lines but was given {len(names)} names; nothing written')
        return False
    os.makedirs(folder, exist_ok=True)
    for (start, end), name in zip(speech, names):
        a, b = max(0.0, start - PAD), end + PAD
        # Mono, 22 kHz, 48 kbit: small files that still sound clean for speech.
        subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-ss', f'{a:.3f}', '-to', f'{b:.3f}', '-i', path,
                        '-ac', '1', '-ar', '22050', '-b:a', '48k', os.path.join(folder, f'{name}.mp3')], check=True)
        print(f'  {name}: {end - start:.2f} s')
    return True


if __name__ == '__main__':
    if len(sys.argv) < 4:
        print(__doc__)
        sys.exit(2)
    sys.exit(0 if cut(sys.argv[1], sys.argv[2], sys.argv[3:]) else 1)
