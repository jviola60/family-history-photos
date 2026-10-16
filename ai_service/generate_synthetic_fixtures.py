"""Draw the committed ai_service test fixtures.

These are geometric stand-ins (gradients, shapes, a stick-figure silhouette).
They are not photographs and contain no real people. Regenerate with:

    python3 ai_service/generate_synthetic_fixtures.py
"""

import os

from PIL import Image, ImageDraw

FIXTURE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "test_fixtures")


def _vertical_gradient(width, height, top, bottom):
    img = Image.new("RGB", (width, height))
    px = img.load()
    for y in range(height):
        t = y / max(1, height - 1)
        color = tuple(int(top[i] + (bottom[i] - top[i]) * t) for i in range(3))
        for x in range(width):
            px[x, y] = color
    return img


def draw_standing_figure(path):
    """Simple figure silhouette on a gradient. No face, no photograph."""
    img = _vertical_gradient(344, 438, (186, 214, 236), (232, 220, 196))
    draw = ImageDraw.Draw(img)
    # ground
    draw.rectangle([0, 360, 344, 438], fill=(120, 150, 110))
    # body
    draw.rounded_rectangle([142, 150, 202, 280], radius=16, fill=(40, 70, 120))
    # head
    draw.ellipse([150, 78, 194, 140], fill=(40, 70, 120))
    # arms and legs
    draw.line([(142, 175), (100, 240)], fill=(40, 70, 120), width=10)
    draw.line([(202, 175), (244, 240)], fill=(40, 70, 120), width=10)
    draw.line([(160, 270), (140, 360)], fill=(40, 70, 120), width=12)
    draw.line([(184, 270), (204, 360)], fill=(40, 70, 120), width=12)
    img.save(path, format="PNG")


def draw_kitchen_shapes(path):
    """Abstract kitchen-like rectangles and circles. No person."""
    img = _vertical_gradient(255, 471, (245, 236, 214), (210, 186, 150))
    draw = ImageDraw.Draw(img)
    # cabinet blocks
    draw.rectangle([16, 24, 120, 160], fill=(90, 120, 150))
    draw.rectangle([132, 24, 236, 160], fill=(70, 100, 130))
    draw.rectangle([16, 180, 236, 210], fill=(160, 130, 90))
    # counter
    draw.rectangle([10, 220, 245, 250], fill=(230, 220, 200))
    # plate and cup
    draw.ellipse([40, 280, 140, 380], fill=(250, 250, 248), outline=(80, 80, 80), width=4)
    draw.rounded_rectangle([160, 300, 220, 390], radius=8, fill=(180, 70, 60))
    # window
    draw.rectangle([70, 50, 110, 110], fill=(170, 210, 230))
    draw.line([(90, 50), (90, 110)], fill=(90, 120, 150), width=3)
    draw.line([(70, 80), (110, 80)], fill=(90, 120, 150), width=3)
    img.save(path, format="PNG")


def main():
    os.makedirs(FIXTURE_DIR, exist_ok=True)
    standing = os.path.join(FIXTURE_DIR, "synthetic_standing_figure.png")
    kitchen = os.path.join(FIXTURE_DIR, "synthetic_kitchen_shapes.png")
    draw_standing_figure(standing)
    draw_kitchen_shapes(kitchen)
    print(standing)
    print(kitchen)


if __name__ == "__main__":
    main()
