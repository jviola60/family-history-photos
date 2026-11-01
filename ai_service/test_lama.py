import os
import time
import numpy as np
from PIL import Image, ImageDraw
import onnxruntime as ort

print("Loading LaMa ONNX...")
session = ort.InferenceSession('ai_service/models/lama.onnx', providers=['CPUExecutionProvider'])

# Load sample image
img_path = 'public/previews/sample.jpg'
orig_img = Image.open(img_path).convert('RGB')
w, h = orig_img.size

# Create a mask around the lady in natural coords
mask_img = Image.new('L', (w, h), 0)
draw = ImageDraw.Draw(mask_img)
draw.ellipse([int(0.47 * w), int(0.18 * h), int(0.535 * w), int(0.53 * h)], fill=255)

# Test [0.0, 1.0] vs [0.0, 255.0]
for norm_type in ['0_1', '0_255']:
    img_512 = orig_img.resize((512, 512), Image.Resampling.BILINEAR)
    mask_512 = mask_img.resize((512, 512), Image.Resampling.NEAREST)

    arr_img = np.array(img_512).astype(np.float32)
    if norm_type == '0_1':
        arr_img = arr_img / 255.0
    tensor_img = np.transpose(arr_img, (2, 0, 1))[np.newaxis, ...]

    arr_mask = (np.array(mask_512).astype(np.float32) > 127).astype(np.float32)
    tensor_mask = arr_mask[np.newaxis, np.newaxis, ...]

    t0 = time.time()
    out = session.run(None, {'image': tensor_img, 'mask': tensor_mask})[0][0]
    dt = time.time() - t0

    print(f"Norm {norm_type}: min={out.min():.2f}, max={out.max():.2f}, time={dt:.2f}s")

    # If output is in [0, 255] or [0, 1]
    if out.max() <= 1.5:
        out_pixels = np.clip(out * 255.0, 0, 255).astype(np.uint8)
    else:
        out_pixels = np.clip(out, 0, 255).astype(np.uint8)

    res_512 = Image.fromarray(np.transpose(out_pixels, (1, 2, 0)))
    res_full = res_512.resize((w, h), Image.Resampling.LANCZOS)
    
    # Composite only the masked area back onto original
    mask_bin = np.array(mask_img) > 127
    final_arr = np.array(orig_img).copy()
    final_arr[mask_bin] = np.array(res_full)[mask_bin]
    
    out_file = f'ai_service/test_lama_{norm_type}.jpg'
    Image.fromarray(final_arr).save(out_file, quality=95)
    print(f"Saved {out_file}")
