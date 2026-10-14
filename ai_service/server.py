"""
Local AI Photo Restoration & 4K Super-Resolution Server
Runs 100% offline using ONNX Runtime with Real-ESRGAN, CodeFormer, GFPGAN, and OpenCV.
"""

import os
import sys
import io
import json
import base64
import time
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
import numpy as np
from PIL import Image, ImageFilter
import onnxruntime as ort
import cv2

# Ensure clean UTF-8 output on Windows terminal
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

PORT = 8008
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = os.path.join(BASE_DIR, "models")

REAL_ESRGAN_PATH = os.path.join(MODELS_DIR, "real_esrgan_x4.onnx")
GFPGAN_PATH = os.path.join(MODELS_DIR, "gfpgan_1.4.onnx")
CODEFORMER_PATH = os.path.join(MODELS_DIR, "codeformer.onnx")

print("Initializing Local AI Restoration Engine (100% Offline)...")
print(f"Loading models from: {MODELS_DIR}")

# Load ONNX sessions with CPU Execution Provider
opts = ort.SessionOptions()
opts.intra_op_num_threads = max(2, os.cpu_count() // 2)

try:
    esrgan_session = ort.InferenceSession(REAL_ESRGAN_PATH, sess_options=opts, providers=['CPUExecutionProvider'])
    print("[OK] Real-ESRGAN x4 Neural Upscaler loaded.")
except Exception as e:
    print(f"Warning: Could not load Real-ESRGAN: {e}")
    esrgan_session = None

try:
    gfpgan_session = ort.InferenceSession(GFPGAN_PATH, sess_options=opts, providers=['CPUExecutionProvider'])
    print("[OK] GFPGAN v1.4 Facial Restoration GAN loaded.")
except Exception as e:
    print(f"Warning: Could not load GFPGAN: {e}")
    gfpgan_session = None

try:
    codeformer_session = ort.InferenceSession(CODEFORMER_PATH, sess_options=opts, providers=['CPUExecutionProvider'])
    print("[OK] CodeFormer Facial Restoration loaded.")
except Exception as e:
    print(f"Warning: Could not load CodeFormer: {e}")
    codeformer_session = None

print(f"Local AI Server ready on http://localhost:{PORT}")


# ==============================================================================
# 1. Scratch & Fold Inpainting (OpenCV Telea & Morphological Line Detection)
# ==============================================================================

def repair_scratches_and_folds(pil_img, mask_img=None, auto_detect=True, scratch_strength=0.75):
    """
    Detects and repairs hairline scratches, physical fold creases, tears, and dust spots.
    Uses multi-scale morphological opening/closing with directional kernels.
    """
    if scratch_strength <= 0:
        return pil_img

    cv_img = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)
    h, w = cv_img.shape[:2]

    # If user provided a specific painted mask
    if mask_img is not None:
        mask = np.array(mask_img.resize((w, h), Image.Resampling.NEAREST).convert("L"))
        if np.any(mask > 20):
            mask_bin = (mask > 20).astype(np.uint8) * 255
            mask_dilated = cv2.dilate(mask_bin, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3)))
            inpainted = cv2.inpaint(cv_img, mask_dilated, inpaintRadius=4, flags=cv2.INPAINT_TELEA)
            blended = cv2.addWeighted(inpainted, scratch_strength, cv_img, 1.0 - scratch_strength, 0)
            return Image.fromarray(cv2.cvtColor(blended, cv2.COLOR_BGR2RGB))

    if not auto_detect:
        return pil_img

    gray = cv2.cvtColor(cv_img, cv2.COLOR_BGR2GRAY)
    combined_mask = np.zeros_like(gray)

    # Multi-scale top-hat (bright cracks/scratches) and black-hat (dark creases/folds)
    for k in [3, 5, 7]:
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (k, k))
        tophat = cv2.morphologyEx(gray, cv2.MORPH_TOPHAT, kernel)
        blackhat = cv2.morphologyEx(gray, cv2.MORPH_BLACKHAT, kernel)
        
        _, t_top = cv2.threshold(tophat, 30, 255, cv2.THRESH_BINARY)
        _, t_black = cv2.threshold(blackhat, 30, 255, cv2.THRESH_BINARY)
        
        combined_mask = cv2.bitwise_or(combined_mask, t_top)
        combined_mask = cv2.bitwise_or(combined_mask, t_black)

    # Filter out facial features, eyes, and natural object edges
    num_labels, labels, stats, _ = cv2.connectedComponentsWithStats(combined_mask)
    clean_mask = np.zeros_like(combined_mask)
    for i in range(1, num_labels):
        area = stats[i, cv2.CC_STAT_AREA]
        bw = stats[i, cv2.CC_STAT_WIDTH]
        bh = stats[i, cv2.CC_STAT_HEIGHT]
        aspect = max(bw, bh) / max(1, min(bw, bh))

        # Scratches and folds are thin and elongated or very small flecks
        if (area < 120 and aspect > 1.5) or (area < 600 and aspect > 3.0) or (area < 40):
            clean_mask[labels == i] = 255

    if not np.any(clean_mask):
        return pil_img

    # Gentle dilation to bridge scratch edges
    clean_mask = cv2.dilate(clean_mask, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3)))
    inpainted = cv2.inpaint(cv_img, clean_mask, inpaintRadius=3, flags=cv2.INPAINT_TELEA)

    blended = cv2.addWeighted(inpainted, scratch_strength, cv_img, 1.0 - scratch_strength, 0)
    return Image.fromarray(cv2.cvtColor(blended, cv2.COLOR_BGR2RGB))


# ==============================================================================
# 2. Color Restoration & De-Fading (White-Balance + CLAHE + Saturation Recovery)
# ==============================================================================

def restore_color_and_defade(pil_img, defade_strength=0.70, balance_color=True, saturation_boost=1.18):
    """
    Restores vintage faded prints:
    1. Multi-channel percentile white balance to remove yellow/sepia/magenta aging casts.
    2. LAB CLAHE on the Luminance channel to lift washed-out blacks and recover dynamic range.
    3. HSV Saturation recovery to revitalize authentic pigments.
    """
    if defade_strength <= 0:
        return pil_img

    cv_img = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)

    # 1. White balance & cast correction
    if balance_color:
        out_channels = []
        for c in cv2.split(cv_img):
            low = np.percentile(c, 1)
            high = np.percentile(c, 99)
            if high > low:
                c_norm = np.clip((c.astype(np.float32) - low) * (255.0 / (high - low)), 0, 255).astype(np.uint8)
                c_blended = cv2.addWeighted(c, 1.0 - defade_strength, c_norm, defade_strength, 0)
                out_channels.append(c_blended)
            else:
                out_channels.append(c)
        cv_img = cv2.merge(out_channels)

    # 2. LAB CLAHE on L-channel (recovers contrast and shadow depth without color distortion)
    lab = cv2.cvtColor(cv_img, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    clip_limit = max(0.5, 2.2 * defade_strength)
    clahe = cv2.createCLAHE(clipLimit=clip_limit, tileGridSize=(8, 8))
    l_clahe = clahe.apply(l)
    l_final = cv2.addWeighted(l, 1.0 - defade_strength, l_clahe, defade_strength, 0)
    lab_restored = cv2.merge([l_final, a, b])
    cv_img = cv2.cvtColor(lab_restored, cv2.COLOR_LAB2BGR)

    # 3. Saturation revival in HSV space
    if saturation_boost > 1.0:
        hsv = cv2.cvtColor(cv_img, cv2.COLOR_BGR2HSV).astype(np.float32)
        h, s, v = cv2.split(hsv)
        s = np.clip(s * (1.0 + (saturation_boost - 1.0) * defade_strength), 0, 255)
        hsv = cv2.merge([h, s, v])
        cv_img = cv2.cvtColor(hsv.astype(np.uint8), cv2.COLOR_HSV2BGR)

    return Image.fromarray(cv2.cvtColor(cv_img, cv2.COLOR_BGR2RGB))


# ==============================================================================
# 3. Facial Restoration: CodeFormer & GFPGAN v1.4
# ==============================================================================

def run_codeformer_face(face_pil, fidelity=0.75):
    """
    Restore a 512x512 face crop using CodeFormer.
    fidelity (w parameter): controls quality vs. likeness preservation.
    """
    if codeformer_session is None:
        return face_pil

    orig_size = face_pil.size
    face_512 = face_pil.resize((512, 512), Image.Resampling.LANCZOS)
    arr = (np.array(face_512).astype(np.float32) / 255.0 - 0.5) / 0.5
    tensor = np.transpose(arr, (2, 0, 1))[np.newaxis, ...]
    w = np.array(fidelity, dtype=np.float64)

    out = codeformer_session.run(None, {'input': tensor, 'weight': w})[0][0]
    out = (np.clip(np.transpose(out, (1, 2, 0)), -1.0, 1.0) + 1.0) * 0.5 * 255.0
    out_img = Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))

    return out_img.resize(orig_size, Image.Resampling.LANCZOS)


def run_gfpgan_face(face_pil, fidelity=0.75):
    """
    Restore a 512x512 face crop using GFPGAN v1.4
    """
    if gfpgan_session is None:
        return face_pil

    orig_size = face_pil.size
    face_512 = face_pil.resize((512, 512), Image.Resampling.LANCZOS)
    arr = (np.array(face_512).astype(np.float32) / 255.0 - 0.5) / 0.5
    tensor = np.transpose(arr, (2, 0, 1))[np.newaxis, ...]

    out = gfpgan_session.run(None, {'input': tensor})[0][0]
    out = (np.clip(np.transpose(out, (1, 2, 0)), -1.0, 1.0) + 1.0) * 0.5 * 255.0
    out_img = Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))

    if fidelity < 1.0:
        out_img = Image.blend(face_512, out_img, fidelity)

    return out_img.resize(orig_size, Image.Resampling.LANCZOS)


def restore_faces_in_image(img, face_box=None, face_model='codeformer', fidelity=0.75):
    """
    Restores faces in the image using the selected model (CodeFormer or GFPGAN).
    Blends the restored crop seamlessly using a Gaussian blurred alpha mask.
    """
    if face_model == 'none':
        return img

    restore_func = run_codeformer_face if (face_model == 'codeformer' and codeformer_session is not None) else run_gfpgan_face

    w, h = img.size
    processed = img.copy()

    if face_box and face_box.get("width", 0) > 0.05:
        bx = int(face_box["x"] * w)
        by = int(face_box["y"] * h)
        bw = int(face_box["width"] * w)
        bh = int(face_box["height"] * h)

        pad_x = int(bw * 0.32)
        pad_y = int(bh * 0.38)
        crop_x1 = max(0, bx - pad_x)
        crop_y1 = max(0, by - pad_y)
        crop_x2 = min(w, bx + bw + pad_x)
        crop_y2 = min(h, by + bh + pad_y)

        face_crop = img.crop((crop_x1, crop_y1, crop_x2, crop_y2))
        enhanced_crop = restore_func(face_crop, fidelity=fidelity)

        mask = Image.new("L", (crop_x2 - crop_x1, crop_y2 - crop_y1), 255)
        mask = mask.filter(ImageFilter.GaussianBlur(radius=8))

        processed.paste(enhanced_crop, (crop_x1, crop_y1), mask)
    elif w <= 1000 and h <= 1000 and (0.6 < (w / h) < 1.4):
        # Close-up portrait
        processed = restore_func(img, fidelity=fidelity)

    return processed


# ==============================================================================
# 4. Neural 4x Super Resolution: Real-ESRGAN
# ==============================================================================

def run_realesrgan_tile(pil_img, tile_size=384, overlap=28):
    """
    Run 4x Real-ESRGAN on full image using seamless tiled processing
    to avoid high memory spikes while producing crisp 4K output.
    """
    if esrgan_session is None:
        return pil_img.resize((pil_img.width * 4, pil_img.height * 4), Image.Resampling.LANCZOS)

    w, h = pil_img.size
    scale = 4
    out_w, out_h = w * scale, h * scale

    out_arr = np.zeros((out_h, out_w, 3), dtype=np.float32)
    weight_arr = np.zeros((out_h, out_w, 3), dtype=np.float32)

    for y in range(0, h, tile_size - overlap):
        for x in range(0, w, tile_size - overlap):
            x_end = min(x + tile_size, w)
            y_end = min(y + tile_size, h)
            x_start = max(0, x_end - tile_size)
            y_start = max(0, y_end - tile_size)

            tile = pil_img.crop((x_start, y_start, x_end, y_end))
            t_arr = np.array(tile).astype(np.float32) / 255.0
            t_tensor = np.transpose(t_arr, (2, 0, 1))[np.newaxis, ...]

            t_out = esrgan_session.run(None, {'input': t_tensor})[0][0]
            t_out = np.clip(np.transpose(t_out, (1, 2, 0)) * 255.0, 0, 255)

            th, tw, _ = t_out.shape
            mask = np.ones((th, tw, 3), dtype=np.float32)
            feather = overlap * scale
            if x_start > 0:
                mask[:, :feather, :] *= np.linspace(0, 1, feather)[np.newaxis, :, np.newaxis]
            if x_end < w:
                mask[:, -feather:, :] *= np.linspace(1, 0, feather)[np.newaxis, :, np.newaxis]
            if y_start > 0:
                mask[:feather, :, :] *= np.linspace(0, 1, feather)[:, np.newaxis, np.newaxis]
            if y_end < h:
                mask[-feather:, :, :] *= np.linspace(1, 0, feather)[:, np.newaxis, np.newaxis]

            out_x = x_start * scale
            out_y = y_start * scale
            out_arr[out_y:out_y + th, out_x:out_x + tw] += t_out * mask
            weight_arr[out_y:out_y + th, out_x:out_x + tw] += mask

    weight_arr = np.maximum(weight_arr, 1e-4)
    final_arr = np.clip(out_arr / weight_arr, 0, 255).astype(np.uint8)
    return Image.fromarray(final_arr)


# ==============================================================================
# HTTP Request Handler
# ==============================================================================

ALLOWED_ORIGINS = {
    "https://jviola60.github.io",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:4173",
    "http://127.0.0.1:4173",
}
MAX_BODY_BYTES = 60 * 1024 * 1024  # 60 MB cap to prevent memory exhaustion


class AIRestorationHandler(BaseHTTPRequestHandler):
    def _origin_allowed(self):
        return self.headers.get("Origin", "") in ALLOWED_ORIGINS

    def _send_cors_headers(self):
        origin = self.headers.get("Origin", "")
        if origin in ALLOWED_ORIGINS:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
            self.send_header("Access-Control-Allow-Private-Network", "true")

    def do_OPTIONS(self):
        self.send_response(204 if self._origin_allowed() else 403)
        self._send_cors_headers()
        self.end_headers()

    def do_GET(self):
        if self.path == "/health":
            self.send_response(200)
            self._send_cors_headers()
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            data = {
                "status": "ready",
                "version": "2.0",
                "esrgan": esrgan_session is not None,
                "gfpgan": gfpgan_session is not None,
                "codeformer": codeformer_session is not None,
                "scratch_repair": True,
                "color_restoration": True
            }
            self.wfile.write(json.dumps(data).encode("utf-8"))
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        # Block cross-site requests from untrusted web pages
        if not self._origin_allowed():
            self.send_response(403)
            self.end_headers()
            return
        try:
            content_length = int(self.headers.get("Content-Length", 0))
        except ValueError:
            content_length = -1
        if content_length < 0 or content_length > MAX_BODY_BYTES:
            self.send_response(413)
            self._send_cors_headers()
            self.end_headers()
            return
        post_data = self.rfile.read(content_length)

        if self.path == "/inpaint":
            self._handle_inpaint(post_data)
        elif self.path == "/restore":
            self._handle_restore(post_data)
        else:
            self.send_response(404)
            self.end_headers()

    def _handle_inpaint(self, post_data):
        """Dedicated inpainting endpoint for manual brush repair."""
        try:
            req = json.loads(post_data.decode("utf-8"))
            data_url = req.get("image", "")
            mask_url = req.get("mask", "")

            if "," in data_url:
                data_url = data_url.split(",", 1)[1]
            if "," in mask_url:
                mask_url = mask_url.split(",", 1)[1]

            orig_img = Image.open(io.BytesIO(base64.b64decode(data_url))).convert("RGB")
            mask_img = Image.open(io.BytesIO(base64.b64decode(mask_url))).convert("L")

            cv_img = cv2.cvtColor(np.array(orig_img), cv2.COLOR_RGB2BGR)
            cv_mask = np.array(mask_img.resize(orig_img.size, Image.Resampling.NEAREST))
            mask_bin = (cv_mask > 20).astype(np.uint8) * 255
            mask_bin = cv2.dilate(mask_bin, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3)))

            inpainted = cv2.inpaint(cv_img, mask_bin, inpaintRadius=4, flags=cv2.INPAINT_TELEA)
            res_img = Image.fromarray(cv2.cvtColor(inpainted, cv2.COLOR_BGR2RGB))

            out_buf = io.BytesIO()
            res_img.save(out_buf, format="JPEG", quality=95)
            out_b64 = base64.b64encode(out_buf.getvalue()).decode("utf-8")

            resp = {"success": True, "image": f"data:image/jpeg;base64,{out_b64}"}
            self.send_response(200)
            self._send_cors_headers()
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps(resp).encode("utf-8"))
        except Exception as err:
            self._send_error(err)

    def _handle_restore(self, post_data):
        """Full photo restoration pipeline."""
        try:
            req = json.loads(post_data.decode("utf-8"))
            data_url = req.get("image", "")
            face_model = req.get("face_model", "codeformer")  # 'codeformer' | 'gfpgan' | 'none'
            fidelity = float(req.get("fidelity", 0.75))
            face_box = req.get("face_box", None)
            
            repair_scratches = bool(req.get("repair_scratches", True))
            scratch_strength = float(req.get("scratch_strength", 0.75))
            
            restore_color = bool(req.get("restore_color", True))
            defade_strength = float(req.get("defade_strength", 0.70))
            
            upscale = bool(req.get("upscale", True))

            if "," in data_url:
                base64_data = data_url.split(",", 1)[1]
            else:
                base64_data = data_url

            img_bytes = base64.b64decode(base64_data)
            current_img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
            w, h = current_img.size

            t0 = time.time()
            print(f"\n[AI Pipeline] Processing photo ({w}x{h})...")

            # Step 1: Local Scratch & Fold Repair
            if repair_scratches and scratch_strength > 0:
                t_scratch = time.time()
                current_img = repair_scratches_and_folds(
                    current_img,
                    auto_detect=True,
                    scratch_strength=scratch_strength
                )
                print(f" [1/4] Scratch & fold repair done ({time.time() - t_scratch:.2f}s)")

            # Step 2: Color Restoration & De-Fading
            if restore_color and defade_strength > 0:
                t_color = time.time()
                current_img = restore_color_and_defade(
                    current_img,
                    defade_strength=defade_strength,
                    balance_color=True,
                    saturation_boost=1.18
                )
                print(f" [2/4] Color restoration & de-fading done ({time.time() - t_color:.2f}s)")

            # Step 3: Facial Restoration (CodeFormer or GFPGAN)
            if face_model != "none":
                t_face = time.time()
                current_img = restore_faces_in_image(
                    current_img,
                    face_box=face_box,
                    face_model=face_model,
                    fidelity=fidelity
                )
                print(f" [3/4] Facial restoration ({face_model}, fidelity={fidelity}) done ({time.time() - t_face:.2f}s)")

            # Step 4: Real-ESRGAN Neural 4x Super Resolution
            if upscale and esrgan_session is not None:
                t_up = time.time()
                target_in_w = min(current_img.width, 960)
                target_in_h = int(current_img.height * (target_in_w / current_img.width))
                if target_in_w < current_img.width:
                    scale_img = current_img.resize((target_in_w, target_in_h), Image.Resampling.LANCZOS)
                else:
                    scale_img = current_img

                final_img = run_realesrgan_tile(scale_img, tile_size=384, overlap=28)
                print(f" [4/4] 4x Real-ESRGAN super-resolution done ({time.time() - t_up:.2f}s) -> {final_img.size}")
            else:
                final_img = current_img

            out_buf = io.BytesIO()
            final_img.save(out_buf, format="JPEG", quality=94, subsampling=0)
            out_b64 = base64.b64encode(out_buf.getvalue()).decode("utf-8")
            result_data_url = f"data:image/jpeg;base64,{out_b64}"

            duration = round(time.time() - t0, 2)
            print(f"[OK] Total restoration completed in {duration}s")

            resp = {
                "success": True,
                "image": result_data_url,
                "width": final_img.width,
                "height": final_img.height,
                "duration_seconds": duration,
                "face_model": face_model
            }

            self.send_response(200)
            self._send_cors_headers()
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps(resp).encode("utf-8"))

        except Exception as err:
            self._send_error(err)

    def _send_error(self, err):
        import traceback
        traceback.print_exc()
        self.send_response(500)
        self._send_cors_headers()
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps({"success": False, "error": str(err)}).encode("utf-8"))


def main():
    # Bind to loopback only so other devices on the network cannot reach it
    server = ThreadingHTTPServer(("127.0.0.1", PORT), AIRestorationHandler)
    print("==================================================================")
    print("  Family History Photos - 100% Offline AI Restoration Engine v2.0")
    print(f"  URL: http://localhost:{PORT}")
    print("  Models: CodeFormer, Real-ESRGAN 4x, GFPGAN v1.4, OpenCV Inpaint")
    print("==================================================================")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("Stopping AI server...")
        server.server_close()


if __name__ == "__main__":
    main()
