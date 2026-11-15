#!/usr/bin/env python3
"""
THE FULL SET OF VOICE CLIPS: keeping track, fetching, cutting, checking

The recordings are made through Higgsfield by hand (a request per recording).
This script does everything either side of that, and keeps a record in
tools/voice/set-jobs.json so that no recording is ever paid for twice:

    set.py batch N              the next N recordings not yet requested, as a ready-made request list
                                (each is numbered by its place in lines.json)
    set.py recorded JSON        note the job numbers that came back for a batch: [{"index":..,"job_id":..},..]
    set.py record REC JOB       note one job number by the recording's name
    set.py discard REC WHY      set a recording aside (it could not be cut cleanly, or its words changed);
                                its job stays on record under "discarded" and it can be requested afresh
    set.py first-phrase REC     keep only what a single recording says before its first pause (for a
                                recording where the voice said the line and then added more)
    set.py url URL [URL ...]    note where finished recordings can be fetched from (the job number is in the address)
    set.py fetch WORK           download finished recordings into WORK/raw, cut them into
                                WORK/clips (tools/voice/cut.py), and check every clip's length
    set.py install WORK         copy the checked clips into assets/voice/, evened out in
                                loudness, and write assets/voice/manifest.json

The list of lines and how they are grouped comes from tools/voice/lines.json
(made by tools/voice/build-lines.mjs).
"""
import json
import os
import re
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


def batch(n):
    data, by_id, jobs = load()
    left = [(i, r) for i, r in enumerate(data['recordings']) if r['id'] not in jobs['recordings']]
    requests = []
    for i, r in left[:n]:
        name, voice, extra = CAST[r['speaker']]
        requests.append({'index': i, 'params': {'model': 'seed_audio', 'prompt': words_for(r, by_id), 'voice_type': 'preset', 'voice_id': voice,
                                                'format': 'mp3', **extra, 'use_unlim': False}})
    print(f'{len(left)} of {len(data["recordings"])} recordings not yet requested; next: {" ".join(r["id"] for i, r in left[:n])}', file=sys.stderr)
    print(json.dumps(requests))


def recorded(text):
    data, by_id, jobs = load()
    for item in json.loads(text):
        rec = data['recordings'][item['index']]['id']
        if rec in jobs['recordings'] and jobs['recordings'][rec]['job'] != item['job_id']:
            sys.exit(f'{rec} already has job {jobs["recordings"][rec]["job"]}; not replaced')
        jobs['recordings'][rec] = {'job': item['job_id']}
    save(jobs)
    waiting = [{'index': i, 'job_id': jobs['recordings'][r['id']]['job']} for i, r in enumerate(data['recordings'])
               if r['id'] in jobs['recordings'] and 'url' not in jobs['recordings'][r['id']]]
    print('waiting for:', json.dumps(waiting))


def record(rec, job):
    data, by_id, jobs = load()
    if rec not in {r['id'] for r in data['recordings']}:
        sys.exit(f'no recording called {rec}')
    if rec in jobs['recordings'] and jobs['recordings'][rec]['job'] != job:
        sys.exit(f'{rec} already has job {jobs["recordings"][rec]["job"]}; not replaced')
    jobs['recordings'][rec] = {'job': job}
    save(jobs)


def discard(rec, why):
    data, by_id, jobs = load()
    entry = jobs['recordings'].pop(rec, None)
    if not entry:
        sys.exit(f'{rec} has no job on record')
    jobs.setdefault('discarded', []).append({'recording': rec, **entry, 'why': why})
    save(jobs)


def first_phrase(rec):
    data, by_id, jobs = load()
    jobs['recordings'][rec]['first_phrase_only'] = True
    save(jobs)


def url(addresses):
    data, by_id, jobs = load()
    by_job = {entry['job']: entry for entry in jobs['recordings'].values()}
    for address in addresses:
        job = re.search(r'([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.mp3', address)
        if not job or job.group(1) not in by_job:
            sys.exit(f'no recording has the job in {address}')
        by_job[job.group(1)]['url'] = address
    save(jobs)


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
                start = max([b for a, b in quiet if a < 0.15], default=0.0)      # (the quiet at the start can begin a moment in)
                end = min([a for a, b in quiet if b > length - 0.05], default=length)
                if entry.get('first_phrase_only'):
                    # The voice said the line and then carried on with something that
                    # was not asked for: keep what comes before the first pause.
                    end = min([a for a, b in quiet if a > start + 0.3], default=end)
                subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-ss', f'{max(0, start - cut.PAD):.3f}', '-to', f'{end + cut.PAD:.3f}',
                                '-i', path, '-ac', '1', '-ar', '22050', '-b:a', '48k', os.path.join(clips, rec['lines'][0] + '.mp3')], check=True)
            elif not cut.cut(path, clips, rec['lines']):
                bad.append((rec['id'], 'could not be cut'))
                continue
        # Each clip should last about as long as its words take to say, and the
        # clips of one recording should all run at about the same pace (a clip
        # much slower or faster than its neighbours has probably been cut in the
        # wrong place).
        pace = {}
        for i in rec['lines']:
            took, want = clip_seconds(os.path.join(clips, i + '.mp3')), expected_seconds(by_id[i]['spoken'], rec['speaker'] == 'CREAK')
            pace[i] = (took / want, took, want)
        middle = sorted(p[0] for p in pace.values())[len(pace) // 2]
        for i, (ratio, took, want) in pace.items():
            if ratio < 0.5 or ratio > 1.9 or ratio < middle * 0.6 or ratio > middle * 1.6:
                bad.append((rec['id'], f'{i} lasts {took:.1f} s, expected about {want * middle:.1f} s: "{by_id[i]["spoken"]}"'))
            else:
                good += 1
    # A recording with any doubtful clip keeps none of its clips: if one line was
    # cut in the wrong place, its neighbours may carry the wrong words too.
    for rec_id in {r for r, why in bad}:
        for i in next(r['lines'] for r in data['recordings'] if r['id'] == rec_id):
            if os.path.exists(os.path.join(clips, i + '.mp3')):
                os.remove(os.path.join(clips, i + '.mp3'))
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
    if command == 'batch':
        batch(int(sys.argv[2]))
    elif command == 'recorded':
        recorded(sys.argv[2])
    elif command == 'record':
        record(sys.argv[2], sys.argv[3])
    elif command == 'discard':
        discard(sys.argv[2], sys.argv[3])
    elif command == 'first-phrase':
        first_phrase(sys.argv[2])
    elif command == 'url':
        url(sys.argv[2:])
    elif command == 'fetch':
        sys.exit(0 if fetch(sys.argv[2]) else 1)
    elif command == 'install':
        install(sys.argv[2])
    else:
        print(__doc__)
        sys.exit(2)
