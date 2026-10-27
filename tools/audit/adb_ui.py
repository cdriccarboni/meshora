#!/usr/bin/env python3
"""MESHORA — pilote d'interface Android minimal par adb + uiautomator (essais sur émulateur).
Usage : python3 adb_ui.py dump | tap "<regex>" | has "<regex>" | text "<texte>" | wait "<regex>" [s]
Recherche dans text et content-desc de chaque nœud visible. SPDX-License-Identifier: AGPL-3.0-or-later
"""
import re, subprocess, sys, time, xml.etree.ElementTree as ET

def sh(*a):
    return subprocess.run(["adb", *a], capture_output=True, text=True).stdout

def nodes():
    for _ in range(3):
        sh("shell", "uiautomator", "dump", "/sdcard/ui.xml")
        x = sh("exec-out", "cat", "/sdcard/ui.xml")
        if x.strip().startswith("<?xml"):
            return list(ET.fromstring(x).iter("node"))
        time.sleep(1)
    return []

def find(pattern):
    r = re.compile(pattern, re.I)
    for n in nodes():
        label = (n.get("text") or "") + " | " + (n.get("content-desc") or "")
        if r.search(label):
            return n
    return None

def center(n):
    x1, y1, x2, y2 = map(int, re.findall(r"\d+", n.get("bounds")))
    return (x1 + x2) // 2, (y1 + y2) // 2

if __name__ == "__main__":
    cmd = sys.argv[1]
    if cmd == "dump":
        for n in nodes():
            t, d = n.get("text") or "", n.get("content-desc") or ""
            if t or d:
                print(f"{t!r} {d!r} {n.get('bounds')}")
    elif cmd == "has":
        print("yes" if find(sys.argv[2]) is not None else "no")
    elif cmd == "wait":
        limit = float(sys.argv[3]) if len(sys.argv) > 3 else 30
        t0 = time.time()
        while time.time() - t0 < limit:
            if find(sys.argv[2]) is not None:
                print("yes"); sys.exit(0)
            time.sleep(1.5)
        print("no"); sys.exit(1)
    elif cmd == "tap":
        n = find(sys.argv[2])
        if n is None:
            print("introuvable : " + sys.argv[2]); sys.exit(1)
        x, y = center(n); sh("shell", "input", "tap", str(x), str(y)); print(f"tap {x},{y}")
    elif cmd == "text":
        sh("shell", "input", "text", sys.argv[2].replace(" ", "%s"))
