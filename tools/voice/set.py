#!/usr/bin/env python3
"""
THE FULL SET OF VOICE CLIPS: keeping track, fetching, cutting, checking

The recordings are made through Higgsfield by hand (a request per recording).
This script does everything either side of that, and keeps a record in
tools/voice/set-jobs.json so that no recording is ever paid for twice:

    set.py todo                 recordings not yet requested, with the exact words to send
    set.py record REC JOB       note the job number the moment a recording is requested
    set.py url JOB URL          note where a finished recording can be fetched from
    set.py fetch WORK           download finished recordings into WORK/raw, cut them into
                                WORK/clips (tools/voice/cut.py), and check every clip's length
    set.py install WORK         copy the checked clips into assets/voice/, evened out in
                                loudness, and write assets/voice/manifest.json

The list of lines and how they are grouped comes from tools/voice/lines.json
(made by tools/voice/build-lines.mjs).
"""
import json
import os
import subprocess
import sys
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import cut  # noqa: E402  (tools/voice/cut.py)

LINES = os.path.join(HERE, 'lines.json')
JOBS = os.path.join(HERE, 'set-jobs.json')
ASSETS = os.path.join(HERE, '..', '..', 'assets', 'voice')

# Who speaks in which Higgsfield voice. Mr Creak is Mr Rockitt's voice, slower and lower.
CAST = {
    'WACKER': ('Alistair', 'd9d5c263-f84e-4752-97b5-3750fcc6fd2f', {}),
    'WITHIT': ('Andre', 'f1e8226e-2248-4d5f-b43c-0a79e9949dbf', {}),
    'ROCKITT': ('Cillian', 'd8ba9f14-8a24-44db-932b-99e16c45bd32', {}),
    'CREAK': ('Cillian', 'd8ba9f14-8a24-44db-932b-99e16c45bd32', {'speech_rate': -25, 'pitch_rate': -3}),
    'TAKE': ('Imogen', '3811e986-0891-47cf-a1f5-78a1d62a547a', {}),
    'SWOT': ('Cody', '1ffcdbb3-078b-5491-959d-359e3021e917', {}),
    'ALBERT': ('Arthur', '30fc8796-ceb6-4a66-b3a7-4a145ef7f346', {}),
}


def load():
    data = json.load(open(LINES))
    jobs = json.load(open(JOBS)) if os.path.exists(JOBS) else {
        'note': 'Every Higgsfield recording made for the full set of voices: recording -> job number and where it was fetched from. '
                'Written as each is requested, so that none is ever made twice.',
        'recordings': {}}
    return data, {l['id']: l for l in data['lines']}, jobs


def save(jobs):
    json.dump(jobs, open(JOBS, 'w'), indent=1)
    open(JOBS, 'a').write('\n')


def words_for(rec, by_id):
    """The text sent for one recording: its lines with a blank line between them."""
    return '\n\n'.join(by_id[i]['spoken'] for i in rec['lines'])


def todo():
    data, by_id, jobs = load()
    left = [r for r in data['recordings'] if r['id'] not in jobs['recordings']]
    print(f'{len(left)} of {len(data["recordings"])} recordings not yet requested')
    for r in left[:int(sys.argv[2]) if len(sys.argv) > 2 else 4]:
        name, voice, extra = CAST[r['speaker']]
        print(json.dumps({'rec': r['id'], 'voice': name, 'voice_id': voice, **extra, 'prompt': words_for(r, by_id)}))


def record(rec, job):
    data, by_id, jobs = load()
    if rec not in {r['id'] for r in data['recordings']}:
        sys.exit(f'no recording called {rec}')
    if rec in jobs['recordings'] and jobs['recordings'][rec]['job'] != job:
        sys.exit(f'{rec} already has job {jobs["recordings"][rec]["job"]}; not replaced')
    jobs['recordings'][rec] = {'job': job}
    save(jobs)


def url(job, address):
    data, by_id, jobs = load()
    for rec, entry in jobs['recordings'].items():
        if entry['job'] == job:
            entry['url'] = address
            save(jobs)
            return
    sys.exit(f'no recording has job {job}')


def expected_seconds(spoken, slow):
    """Roughly how long a sentence takes to say: about 14 letters a second, slower for Mr Creak."""
    return (0.35 + len(spoken) / 14.0) * (1.3 if slow else 1.0)


def clip_seconds(path):
    return float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path],
                                capture_output=True, text=True).stdout)


def fetch(work):
    data, by_id, jobs = load()
    raw, clips = os.path.join(work, 'raw'), os.path.join(work, 'clips')
    os.makedirs(raw, exist_ok=True)
    os.makedirs(clips, exist_ok=True)
    good, bad = 0, []
    for rec in data['recordings']:
        entry = jobs['recordings'].get(rec['id'])
        if not entry or 'url' not in entry:
            continue
        path = os.path.join(raw, rec['id'] + '.mp3')
        if not os.path.exists(path):
            urllib.request.urlretrieve(entry['url'], path)
        if not all(os.path.exists(os.path.join(clips, i + '.mp3')) for i in rec['lines']):
            if len(rec['lines']) == 1:
                # A single line: trim the quiet off both ends and keep the rest whole.
                quiet, length = cut.quiet_stretches(path)
                start = max([b for a, b in quiet if a < 0.05], default=0.0)
                end = min([a for a, b in quiet if b > length - 0.05], default=length)
                subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-ss', f'{max(0, start - cut.PAD):.3f}', '-to', f'{end + cut.PAD:.3f}',
                                '-i', path, '-ac', '1', '-ar', '22050', '-b:a', '48k', os.path.join(clips, rec['lines'][0] + '.mp3')], check=True)
            elif not cut.cut(path, clips, rec['lines']):
                bad.append((rec['id'], 'could not be cut'))
                continue
        # Each clip should last about as long as its words take to say.
        for i in rec['lines']:
            took, want = clip_seconds(os.path.join(clips, i + '.mp3')), expected_seconds(by_id[i]['spoken'], rec['speaker'] == 'CREAK')
            if took < want * 0.5 or took > want * 1.9:
                bad.append((rec['id'], f'{i} lasts {took:.1f} s, expected about {want:.1f} s: "{by_id[i]["spoken"]}"'))
            else:
                good += 1
    print(f'{good} clips cut and of a sensible length')
    for rec, why in bad:
        print(f'  PROBLEM {rec}: {why}')
    return not bad


def install(work):
    data, by_id, jobs = load()
    clips = os.path.join(work, 'clips')
    os.makedirs(ASSETS, exist_ok=True)
    manifest = {}
    for l in data['lines']:
        source = os.path.join(clips, l['id'] + '.mp3')
        if not os.path.exists(source):
            print(f'  no clip for {l["id"]}: {l["spoken"]}')
            continue
        # Even the loudness out, so no master booms and none whispers.
        subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', source, '-af', 'loudnorm=I=-18:TP=-1.5:LRA=11',
                        '-ac', '1', '-ar', '22050', '-b:a', '48k', os.path.join(ASSETS, l['id'] + '.mp3')], check=True)
        manifest.setdefault(l['speaker'], {})[l['key']] = l['id']
    json.dump(manifest, open(os.path.join(ASSETS, 'manifest.json'), 'w'), indent=0, sort_keys=True)
    size = sum(os.path.getsize(os.path.join(ASSETS, f)) for f in os.listdir(ASSETS))
    print(f'{sum(len(v) for v in manifest.values())} clips installed, {size / 1e6:.1f} MB')


if __name__ == '__main__':
    command = sys.argv[1] if len(sys.argv) > 1 else ''
    if command == 'todo':
        todo()
    elif command == 'record':
        record(sys.argv[2], sys.argv[3])
    elif command == 'url':
        url(sys.argv[2], sys.argv[3])
    elif command == 'fetch':
        sys.exit(0 if fetch(sys.argv[2]) else 1)
    elif command == 'install':
        install(sys.argv[2])
    else:
        print(__doc__)
        sys.exit(2)
