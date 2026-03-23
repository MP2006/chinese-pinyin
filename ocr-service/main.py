from fastapi import FastAPI, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from paddleocr import PaddleOCR
import numpy as np
from PIL import Image
import io

app = FastAPI(title="PaddleOCR Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["POST"],
    allow_headers=["*"],
)

# Initialize PaddleOCR once at startup — models are cached after first download
ocr = PaddleOCR(use_angle_cls=True, lang="ch", show_log=False)


@app.post("/recognize")
async def recognize(file: UploadFile):
    contents = await file.read()
    image = Image.open(io.BytesIO(contents)).convert("RGB")
    img_array = np.array(image)

    result = ocr.ocr(img_array, cls=True)

    lines = []
    if result and result[0]:
        for line in result[0]:
            bbox_pts = line[0]  # [[x1,y1], [x2,y1], [x2,y2], [x1,y2]]
            text = line[1][0]
            confidence = float(line[1][1])

            # Convert polygon bbox to simple rectangle
            x_coords = [p[0] for p in bbox_pts]
            y_coords = [p[1] for p in bbox_pts]

            lines.append(
                {
                    "text": text,
                    "confidence": confidence,
                    "bbox": {
                        "x0": min(x_coords),
                        "y0": min(y_coords),
                        "x1": max(x_coords),
                        "y1": max(y_coords),
                    },
                }
            )

    return {"lines": lines}


@app.get("/health")
async def health():
    return {"status": "ok"}
