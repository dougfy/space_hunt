#!/usr/bin/env python3
"""Process reference cannon images into 256x256 RGBA game sprites."""

from PIL import Image
import numpy as np
import os

REF_DIR = "public/icons/_reference/cannons"
OUT_DIR = "public/icons/skins/cartoon"

# Mapping: level -> filename (timestamps differ slightly)
FILES = {
    1: "ChatGPT Image Aug 10, 2026, 05_21_56 PM (1).png",
    2: "ChatGPT Image Aug 10, 2026, 05_21_56 PM (2).png",
    3: "ChatGPT Image Aug 10, 2026, 05_21_56 PM (3).png",
    4: "ChatGPT Image Aug 10, 2026, 05_21_57 PM (4).png",
    5: "ChatGPT Image Aug 10, 2026, 05_21_57 PM (5).png",
    6: "ChatGPT Image Aug 10, 2026, 05_21_57 PM (6).png",
    7: "ChatGPT Image Aug 10, 2026, 05_21_58 PM (7).png",
    8: "ChatGPT Image Aug 10, 2026, 05_21_58 PM (8).png",
}

# Only process levels 2-8 (lv1 already exists and works)
LEVELS_TO_PROCESS = range(2, 9)

def remove_white_bg(img):
    """Remove white/near-white background, make transparent."""
    arr = np.array(img.convert("RGBA"))
    # Threshold: pixels where R, G, B are all > 240 become transparent
    r, g, b, a = arr[:,:,0], arr[:,:,1], arr[:,:,2], arr[:,:,3]
    white_mask = (r > 240) & (g > 240) & (b > 240)
    arr[white_mask, 3] = 0
    return Image.fromarray(arr)

def crop_to_content(img, padding=8):
    """Crop to non-transparent content with padding."""
    arr = np.array(img)
    alpha = arr[:,:,3]
    rows = np.any(alpha > 0, axis=1)
    cols = np.any(alpha > 0, axis=0)
    if not rows.any():
        return img
    rmin, rmax = np.where(rows)[0][[0, -1]]
    cmin, cmax = np.where(cols)[0][[0, -1]]
    # Add padding
    h, w = arr.shape[:2]
    rmin = max(0, rmin - padding)
    rmax = min(h - 1, rmax + padding)
    cmin = max(0, cmin - padding)
    cmax = min(w - 1, cmax + padding)
    return img.crop((cmin, rmin, cmax + 1, rmax + 1))

def pad_to_square(img):
    """Pad image to square with transparent pixels."""
    w, h = img.size
    size = max(w, h)
    result = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    x = (size - w) // 2
    y = (size - h) // 2
    result.paste(img, (x, y))
    return result

def process_image(input_path, output_path):
    """Full pipeline: remove bg, crop, square, resize to 256."""
    img = Image.open(input_path).convert("RGBA")
    img = remove_white_bg(img)
    img = crop_to_content(img)
    img = pad_to_square(img)
    img = img.resize((256, 256), Image.LANCZOS)
    img.save(output_path, "PNG")
    return img

if __name__ == "__main__":
    os.makedirs(OUT_DIR, exist_ok=True)
    
    for lv in LEVELS_TO_PROCESS:
        fname = FILES[lv]
        input_path = os.path.join(REF_DIR, fname)
        output_path = os.path.join(OUT_DIR, f"cannon_lv{lv}_256.png")
        
        if not os.path.exists(input_path):
            print(f"  SKIP lv{lv}: {fname} not found")
            continue
        
        process_image(input_path, output_path)
        size = os.path.getsize(output_path)
        print(f"  OK lv{lv}: {output_path} ({size} bytes)")
    
    print("\nDone! Processed cannon sprites lv2-lv8.")
