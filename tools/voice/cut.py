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

Needs ffmpeg. The pauses between lines are taken to be the longest ones in
the recording, and must be clearly longer than any pause inside a line (a
comma, a full stop); if they are not, nothing is written.
"""
import os
import re
import subprocess
import sys

PAUSE = 0.6          # seconds of quiet that count as "between lines"
QUIET = '-38dB'      # how quiet counts as quiet
PAD = 0.07           # seconds of the pause kept either side of each line, so nothing is clipped
MARGIN = 1.25        # a pause between lines must be this many times longer than any pause inside a line


def quiet_stretches(path):
    """Every quiet stretch of 0.2 s or more as (start, end), and the recording's length."""
    out = subprocess.run(['ffmpeg', '-hide_banner', '-i', path, '-af', f'silencedetect=noise={QUIET}:d=0.2', '-f', 'null', '-'],
                         capture_output=True, text=True).stderr
    starts = [float(x) for x in re.findall(r'silence_start: ([0-9.]+)', out)]
    ends = [float(x) for x in re.findall(r'silence_end: ([0-9.]+)', out)]
    length = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path],
                                  capture_output=True, text=True).stdout)
    if len(starts) > len(ends):          # the recording ends in a pause
        ends.append(length)
    return list(zip(starts, ends)), length


def pauses(path, count=None):
    """The pauses that separate lines, plus any quiet at the very start or end
    (so it is trimmed off), as (start, end); and the recording's length.

    A comma is a pause of about half a second and a blank line about a whole
    one, which is close enough that a fixed threshold sometimes splits a line
    at its comma. When the number of lines is known, the longest pauses are
    taken instead: as many as there are joins between lines. They are only
    trusted if every one of them is clearly longer (by MARGIN) than the longest
    pause left inside a line; otherwise None is returned and nothing is cut.
    """
    quiet, length = quiet_stretches(path)
    edge = [q for q in quiet if q[0] < 0.05 or q[1] > length - 0.05]
    inner = [q for q in quiet if q not in edge]
    if count is None:
        chosen = [q for q in inner if q[1] - q[0] >= PAUSE]
    else:
        by_length = sorted(inner, key=lambda q: q[0] - q[1])          # longest first
        chosen, rest = by_length[:count - 1], by_length[count - 1:]
        if len(chosen) < count - 1:
            return None, length
        shortest = min((b - a for a, b in chosen), default=9.0)
        longest_inside = max((b - a for a, b in rest), default=0.0)
        if shortest < PAUSE or shortest < longest_inside * MARGIN:
            return None, length
    return sorted(chosen + edge), length


def lines(path, count=None):
    """The stretches of speech between the pauses, as (start, end)."""
    gaps, length = pauses(path, count)
    if gaps is None:
        return []
    speech, at = [], 0.0
    for start, end in gaps:
        if start - at > 0.15:
            speech.append((at, start))
        at = end
    if length - at > 0.15:
        speech.append((at, length))
    return speech


def cut(path, folder, names):
    speech = lines(path, len(names))
    if len(speech) != len(names):
        print(f'{os.path.basename(path)}: could not find {len(names)} lines with clear pauses between them (found {len(speech)}); nothing written')
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
