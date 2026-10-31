"""Shrinks every PNG under a directory to a 256-colour palette (about 3x smaller, visually the same for UI shots).

Usage: python3 scripts/screenshots/optimize.py screenshots
"""
import os
import sys

from PIL import Image

root = sys.argv[1] if len(sys.argv) > 1 else 'screenshots'
before = after = 0
for folder, _, files in os.walk(root):
    for name in files:
        if not name.endswith('.png'):
            continue
        path = os.path.join(folder, name)
        before += os.path.getsize(path)
        image = Image.open(path).convert('RGB')
        image.quantize(256, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.FLOYDSTEINBERG).save(path, 'PNG', optimize=True)
        after += os.path.getsize(path)
print(f'{before / 1e6:.1f} MB -> {after / 1e6:.1f} MB')
