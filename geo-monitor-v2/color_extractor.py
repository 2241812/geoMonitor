import sys
from PIL import Image
from collections import Counter

img = Image.open("Screenshot from 2026-06-30 13-07-29.png")
img = img.convert("RGB")
w, h = img.size
colors = img.getcolors(w*h)
colors.sort(key=lambda x: x[0], reverse=True)
for count, color in colors[:20]:
    hex_color = '#%02x%02x%02x' % color
    print(f"{hex_color}: {count}")
