# Builds the hero particle map from a backlit portrait.
# Usage: python3 tools/build-particle-map.py tools/source/hero.jpg public_html/images/hero-particles.png 1.0 15
# (last two arguments: output scale, and clockwise rotation in degrees to straighten the figure)
# Output: 8-bit grayscale PNG cropped to the figure. 0 = empty, brighter = denser and brighter particles.
# Needs Pillow, numpy and scipy. Re-run after swapping the source photo.
import sys
from PIL import Image
import numpy as np
from scipy import ndimage as nd
src, out = sys.argv[1], sys.argv[2]
im = Image.open(src).convert('L')
a = np.asarray(im).astype(float) / 255.0
H, W = a.shape

# 1. Person mask: largest dark component, closed, holes filled, smoothed
m = a < 70/255
m = nd.binary_opening(m, iterations=2)
lab, n = nd.label(m)
sizes = nd.sum(m, lab, range(1, n + 1))
m = lab == (np.argmax(sizes) + 1)
m = nd.binary_closing(m, structure=np.ones((3,3)), iterations=6)
m = nd.binary_fill_holes(m)
m = nd.binary_opening(m, iterations=3)
soft = nd.gaussian_filter(m.astype(float), 2.0)
m = soft > 0.5

# 2. Contour: a faint rim keeps the outline legible. The photo is backlit, so the hair and
#    shoulders carry a bright halo; damp everything within a few pixels of the edge.
dist = nd.distance_transform_edt(m)
rim = np.exp(-dist / 6.0)
edge_damp = 1.0 - 0.7 * np.exp(-dist / 9.0)

# 3. Local detail: photo luminance relative to its neighbourhood (reveals face, glasses, hair, folds)
# Tones inside the figure sit in a narrow dark band (~13..120 of 255): stretch them.
lum = np.clip((a - 0.065) / (0.42 - 0.065), 0, 1) ** 0.75
mu = nd.gaussian_filter(a, 10)
sd = np.sqrt(np.maximum(nd.gaussian_filter(a * a, 10) - mu * mu, 1e-6))
detail = np.clip((a - mu) / (sd + 0.02) * 0.35, 0, 1)  # curls, folds, glasses edges

v = 0.10 + 0.12 * rim + (0.35 * detail + 1.1 * lum) * edge_damp
v = np.clip(v, 0, 1) * m

# The photo frame cuts the body at the bottom and right: fade into the dark there
# instead of ending on a hard straight edge.
yy, xx = np.mgrid[0:H, 0:W]
fade_bottom = np.clip((H - 1 - yy) / (0.16 * H), 0, 1) ** 1.5
fade_right = np.clip((W - 1 - xx) / (0.09 * W), 0, 1) ** 1.5
v = v * fade_bottom * fade_right

# The camera was tilted (dutch angle). Rotate the finished map clockwise so the figure
# stands upright. The faded frame edges rotate with it.
ROTATE_DEG = float(sys.argv[4]) if len(sys.argv) > 4 else 15.0
if ROTATE_DEG:
    v = np.asarray(Image.fromarray(v.astype(np.float32), 'F').rotate(-ROTATE_DEG, Image.BICUBIC, expand=True))
    v = np.clip(v, 0, 1)
    m = v > 0.01
    H, W = v.shape

# 4. Encode as 8-bit grayscale: 0 = empty, brighter = denser/brighter particles.
#    Crop to the figure and quantise to 32 levels so the PNG stays small.
scale = float(sys.argv[3]) if len(sys.argv) > 3 else 0.75
ys, xs = np.nonzero(m)
pad = 4
y0, y1 = max(ys.min() - pad, 0), min(ys.max() + pad + 1, H)
x0, x1 = max(xs.min() - pad, 0), min(xs.max() + pad + 1, W)
img = Image.fromarray((v[y0:y1, x0:x1] * 255).astype(np.uint8), 'L')
img = img.resize((round((x1 - x0) * scale), round((y1 - y0) * scale)), Image.LANCZOS)
q = (np.asarray(img).astype(int) + 4) // 8 * 8
img = Image.fromarray(np.clip(q, 0, 255).astype(np.uint8), 'L')
img.save(out, optimize=True)
print('saved', out, img.size)
