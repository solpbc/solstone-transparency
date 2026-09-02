#!/usr/bin/env python3
# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (c) 2026 sol pbc
"""Regenerate tuf-conformance-vectors.json from an INDEPENDENT reference implementation.

This script exists so the vectors' provenance is re-derivable by a third party rather
than resting on a comment inside the artifact it certifies. It deliberately does NOT
import, read, or call any code from this repository -- if it did, the vectors would be
this project checking its own homework, which is precisely the closed loop they exist
to open.

    python3 -m venv /tmp/tufvenv
    /tmp/tufvenv/bin/pip install "tuf==7.0.1" "cryptography==50.0.1"
    /tmp/tufvenv/bin/python generate-vectors.py > tuf-conformance-vectors.json

Pinned at the versions the committed vectors were generated with, and verified to
reproduce them byte-for-byte. Re-running under a different python-tuf version may
legitimately produce different bytes; that is a finding to investigate, not a file to
overwrite.

Two of the nine canonical-JSON vectors carry the discriminating power; the rest are
ASCII and pass under a naive JSON.stringify(Object.keys().sort()) implementation:

  astral-key-sort    pins key ordering to Unicode CODE POINT order. JavaScript's
                     default Array.prototype.sort compares UTF-16 code units and
                     orders U+1F600 / U+FF5E the other way round. (UTF-8 byte order
                     is order-preserving and agrees with code-point order; UTF-16
                     code-unit order is the odd one out.)
  control-chars-raw  pins string escaping to backslash and double-quote ONLY, every
                     other character emitted raw. JSON.stringify also escapes control
                     characters, producing different signature-input bytes.

Measured when the vectors landed: the naive implementation passes 7 of 9 and fails
exactly those two.
"""
import json, hashlib
from securesystemslib.formats import encode_canonical
from tuf.api.metadata import Key
import tuf

NL, BELL, TAB, EACUTE = chr(10), chr(7), chr(9), chr(0xE9)
EMOJI, WAVE, QUOTE, BSLASH = chr(0x1F600), chr(0xFF5E), chr(0x22), chr(0x5C)

cases = [
    ("ascii-key-sort",        {"b": 1, "a": 2}),
    ("nested-deep-sort",      {"z": {"y": 1, "x": [3, 2, 1]}, "a": True}),
    ("non-ascii-key-sort",    {EACUTE: 1, "a": 2}),
    ("astral-key-sort",       {EMOJI: 1, WAVE: 2}),
    ("control-chars-raw",     {"k": "ab" + EACUTE + NL + BELL + TAB}),
    ("quote-and-backslash",   {"k": QUOTE + BSLASH}),
    ("empty-containers",      {"o": {}, "a": [], "s": "", "n": None}),
    ("bools-and-big-int",     {"t": True, "f": False, "big": 2**53}),
    ("negative-and-zero",     {"z": 0, "n": -1}),
]

vectors = []
for name, value in cases:
    canon = encode_canonical(value)
    vectors.append({
        "name": name,
        "input": value,
        "canonical_utf8_hex": canon.encode("utf-8").hex(),
        "canonical_sha256": hashlib.sha256(canon.encode("utf-8")).hexdigest(),
    })

keyids = []
for label, pub in [("all-aa", "aa"*32), ("all-00", "00"*32), ("mixed", "0123456789abcdef"*4)]:
    k = Key.from_dict("X", {"keytype":"ed25519","scheme":"ed25519","keyval":{"public":pub}})
    d = k.to_dict(); d.pop("keyid", None)
    canon = encode_canonical(d)
    keyids.append({
        "name": label,
        "key_object": d,
        "canonical_utf8_hex": canon.encode("utf-8").hex(),
        "keyid": hashlib.sha256(canon.encode("utf-8")).hexdigest(),
    })

doc = {
    "_comment": [
        "Known-answer conformance vectors for TUF canonical JSON and key-ID construction.",
        "GENERATED FROM AN INDEPENDENT REFERENCE IMPLEMENTATION, NOT FROM THIS REPOSITORY.",
        "Source: python-tuf " + tuf.__version__ + " / securesystemslib encode_canonical, run 2026-09-02.",
        "These exist so this project's canonicalizer is pinned to something other than itself.",
        "A self-consistently wrong implementation passes a builder-verifies-its-own-output test;",
        "it cannot pass these. Do not regenerate them with this repository's own code.",
        "Two vectors carry the whole point: 'astral-key-sort' pins key ordering to Unicode",
        "CODE POINT order (JavaScript's default Array.prototype.sort uses UTF-16 code units and",
        "orders these two keys the other way round), and 'control-chars-raw' pins string escaping",
        "to backslash and double-quote ONLY (JSON.stringify additionally escapes control",
        "characters, producing different signature-input bytes).",
    ],
    "generator": {"python_tuf": tuf.__version__, "generated": "2026-09-02"},
    "canonical_json": vectors,
    "keyid": keyids,
}
print(json.dumps(doc, indent="\t", ensure_ascii=False))
