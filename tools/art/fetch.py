#!/usr/bin/env python3
"""Download every job's source image that is not yet on disk (into art-src/)."""
import os, sys, urllib.request, ssl
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from artlib import JOBS, ROOT, load_json

ctx = ssl.create_default_context(cafile=os.environ.get('SSL_CERT_FILE') or '/root/.ccr/ca-bundle.crt' if os.path.exists('/root/.ccr/ca-bundle.crt') else None)
for job in load_json(JOBS, {'jobs': []})['jobs']:
    dest = os.path.join(ROOT, job['source'])
    if os.path.exists(dest) or not job.get('url'):
        continue
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    try:
        with urllib.request.urlopen(job['url'], context=ctx, timeout=120) as r, open(dest, 'wb') as f:
            f.write(r.read())
        print('fetched', job['source'])
    except Exception as e:
        print('could not fetch', job['id'], '-', e)
