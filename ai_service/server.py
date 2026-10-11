"""
Local AI Photo Restoration & 4K Super-Resolution Server
Runs 100% offline using ONNX Runtime with Real-ESRGAN and GFPGAN.
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

print("Initializing Local AI Restoration Engine...")
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

print(f"Local AI Server ready on http://localhost:{PORT}")


def run_gfpgan_face(face_pil, fidelity=0.75):
    """
    Restore a 512x512 face crop using GFPGAN v1.4
    """
    if gfpgan_session is None:
        return face_pil

    orig_size = face_pil.size
    face_512 = face_pil.resize((512, 512), Image.Resampling.LANCZOS)
    arr = np.array(face_512).astype(np.float32)

    # Normalize RGB to [-1.0, 1.0]
    arr = (arr / 255.0 - 0.5) / 0.5
    tensor = np.transpose(arr, (2, 0, 1))[np.newaxis, ...]

    # Run inference
    out = gfpgan_session.run(None, {'input': tensor})[0][0]

    # Convert back from [-1.0, 1.0] to [0, 255]
    out = (out + 1.0) * 0.5 * 255.0
    out = np.clip(out, 0, 255).astype(np.uint8)
    out_img = Image.fromarray(np.transpose(out, (1, 2, 0)))

    # Blend with original according to fidelity parameter (keeps personal likeness)
    if fidelity < 1.0:
        out_img = Image.blend(face_512, out_img, fidelity)

    return out_img.resize(orig_size, Image.Resampling.LANCZOS)


def run_realesrgan_tile(pil_img, tile_size=400, overlap=32):
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

    # Calculate tiles
    for y in range(0, h, tile_size - overlap):
        for x in range(0, w, tile_size - overlap):
            x_end = min(x + tile_size, w)
            y_end = min(y + tile_size, h)
            x_start = max(0, x_end - tile_size)
            y_start = max(0, y_end - tile_size)

            tile = pil_img.crop((x_start, y_start, x_end, y_end))
            t_arr = np.array(tile).astype(np.float32) / 255.0
            t_tensor = np.transpose(t_arr, (2, 0, 1))[np.newaxis, ...]

            # Infer tile
            t_out = esrgan_session.run(None, {'input': t_tensor})[0][0]
            t_out = np.clip(np.transpose(t_out, (1, 2, 0)) * 255.0, 0, 255)

            # Feather mask for smooth border blending
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

    # Normalize by accumulated weights
    weight_arr = np.maximum(weight_arr, 1e-4)
    final_arr = np.clip(out_arr / weight_arr, 0, 255).astype(np.uint8)
    return Image.fromarray(final_arr)


class AIRestorationHandler(BaseHTTPRequestHandler):
    def _send_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def do_OPTIONS(self):
        self.send_response(204)
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
                "version": "1.0",
                "esrgan": esrgan_session is not None,
                "gfpgan": gfpgan_session is not None
            }
            self.wfile.write(json.dumps(data).encode("utf-8"))
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        if self.path != "/restore":
            self.send_response(404)
            self.end_headers()
            return

        content_length = int(self.headers.get("Content-Length", 0))
        post_data = self.rfile.read(content_length)

        try:
            req = json.loads(post_data.decode("utf-8"))
            data_url = req.get("image", "")
            fidelity = float(req.get("fidelity", 0.75))
            face_box = req.get("face_box", None)

            if "," in data_url:
                base64_data = data_url.split(",", 1)[1]
            else:
                base64_data = data_url

            img_bytes = base64.b64decode(base64_data)
            orig_img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
            w, h = orig_img.size

            t0 = time.time()
            print(f"Processing image {w}x{h}...")

            # 1. Step 1: Face restoration if face box is provided or image is a portrait
            processed_img = orig_img
            if gfpgan_session is not None:
                if face_box and face_box.get("width", 0) > 0.05:
                    bx = int(face_box["x"] * w)
                    by = int(face_box["y"] * h)
                    bw = int(face_box["width"] * w)
                    bh = int(face_box["height"] * h)

                    # Add padding around face box
                    pad_x = int(bw * 0.3)
                    pad_y = int(bh * 0.35)
                    crop_x1 = max(0, bx - pad_x)
                    crop_y1 = max(0, by - pad_y)
                    crop_x2 = min(w, bx + bw + pad_x)
                    crop_y2 = min(h, by + bh + pad_y)

                    face_crop = orig_img.crop((crop_x1, crop_y1, crop_x2, crop_y2))
                    enhanced_crop = run_gfpgan_face(face_crop, fidelity=fidelity)

                    # Smooth alpha blend back
                    mask = Image.new("L", (crop_x2 - crop_x1, crop_y2 - crop_y1), 255)
                    mask = mask.filter(ImageFilter.GaussianBlur(radius=8))

                    processed_img = orig_img.copy()
                    processed_img.paste(enhanced_crop, (crop_x1, crop_y1), mask)
                    print(f"[OK] Face restored in {time.time() - t0:.2f}s")
                elif w <= 1000 and h <= 1000 and (w / h > 0.6 and w / h < 1.4):
                    # Close-up portrait photo
                    processed_img = run_gfpgan_face(orig_img, fidelity=fidelity)
                    print(f"[OK] Full portrait restored in {time.time() - t0:.2f}s")

            # 2. Step 2: Real-ESRGAN Neural 4x Super Resolution
            if esrgan_session is not None:
                # Target up to 4K resolution (max 3840 wide)
                target_in_w = min(processed_img.width, 960)
                target_in_h = int(processed_img.height * (target_in_w / processed_img.width))
                if target_in_w < processed_img.width:
                    scale_img = processed_img.resize((target_in_w, target_in_h), Image.Resampling.LANCZOS)
                else:
                    scale_img = processed_img

                final_img = run_realesrgan_tile(scale_img, tile_size=384, overlap=28)
                print(f"[OK] 4x Super-resolution completed in {time.time() - t0:.2f}s. Result: {final_img.size}")
            else:
                final_img = processed_img.resize((processed_img.width * 2, processed_img.height * 2), Image.Resampling.LANCZOS)

            # Encode to JPEG
            out_buf = io.BytesIO()
            final_img.save(out_buf, format="JPEG", quality=94, subsampling=0)
            out_b64 = base64.b64encode(out_buf.getvalue()).decode("utf-8")
            result_data_url = f"data:image/jpeg;base64,{out_b64}"

            resp = {
                "success": True,
                "image": result_data_url,
                "width": final_img.width,
                "height": final_img.height,
                "duration_seconds": round(time.time() - t0, 2)
            }

            self.send_response(200)
            self._send_cors_headers()
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps(resp).encode("utf-8"))

        except Exception as err:
            import traceback
            traceback.print_exc()
            self.send_response(500)
            self._send_cors_headers()
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"success": False, "error": str(err)}).encode("utf-8"))


def main():
    server = ThreadingHTTPServer(("0.0.0.0", PORT), AIRestorationHandler)
    print("=======================================================")
    print("  Family History Photos - AI 4K Restoration Server Running")
    print(f"  URL: http://localhost:{PORT}")
    print("  Models: Real-ESRGAN 4x & GFPGAN v1.4")
    print("=======================================================")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("Stopping AI server...")
        server.server_close()


if __name__ == "__main__":
    main()
