# Computer Vision Training Frontend

Next.js frontend for the no-code Computer Vision training platform.

The UI lets a user:

- Upload and inspect datasets.
- Select a Computer Vision task and model family.
- Edit model-specific training parameters.
- Submit training jobs to the FastAPI backend.
- Monitor status, logs, and metrics.
- Browse run artifacts and download results.

## Supported workflows

| Task | Models exposed in the UI |
| --- | --- |
| Image Classification | ResNet, EfficientNet |
| Semantic / Instance Segmentation | DeepLabV3+, Mask R-CNN |
| OCR / Document Vision | PaddleOCR, Tesseract |
| Object Detection | YOLOv11, Faster R-CNN |

The frontend requests the backend catalog from:

```text
GET /api/model-catalog
```

`lib/cvCatalog.ts` is the client fallback catalog when that API is not reachable during configuration rendering.

## Pages

```text
app/
|-- dashboard/page.tsx    # Navigation overview
|-- dataset/page.tsx      # Upload, list, delete, and inspect dataset formats
|-- config/page.tsx       # Task, model, dataset, and parameter configuration
|-- training/page.tsx     # Training submission and live monitoring
`-- results/page.tsx      # Runs, latest metrics, and artifact downloads
```

Important shared files:

```text
components/
|-- MainLayout.tsx
|-- Navbar.tsx
`-- Sidebar.tsx

lib/
|-- cvCatalog.ts          # Catalog types and fallback task/model specs
|-- useTrainingConfig.ts  # Persisted Zustand draft training config
`-- utils.ts
```

## State and data flow

`Zustand` is used for the user's draft training configuration across pages:

- Selected task.
- Selected model.
- Selected dataset.
- Project name.
- Shared training settings.
- Model-specific parameter values.

Backend data stays API-driven:

- Dataset list from `/api/datasets`.
- Model catalog from `/api/model-catalog`.
- Backend availability badge from `GET /`.
- Live job snapshots and incremental updates from `/api/jobs/{job_id}/events`.
- Recovery snapshots from `/api/status/{job_id}`, `/api/logs/{job_id}`, and
  `/api/metrics/{project_name}`.
- Run artifacts from `/api/runs`.

This keeps draft UI state separate from server state.

The navbar and dashboard do not assume that a worker is ready. They probe the
backend root endpoint and display `Checking backend`, `Backend online`, or
`Backend offline`.

The training monitor uses Server-Sent Events (SSE), not interval polling. The
browser receives one snapshot when it connects or reconnects, then appends only
new log text and applies changed status or metrics events. The active job ID is
stored in `sessionStorage` so refreshing the monitor reconnects to the same run.

## Backend connection

The frontend reads:

```text
NEXT_PUBLIC_API_URL
```

Fallback value:

```text
http://localhost:8000
```

Example `.env`:

```text
NEXT_PUBLIC_API_URL=http://localhost:8000
```

Start the backend before using dataset, training, or result pages. A browser `TypeError: Failed to fetch` usually means the backend URL is unreachable, the backend is not running, or the page was opened outside the Next.js dev server.

## Development

Install dependencies:

```powershell
npm.cmd install
```

Start the dev server:

```powershell
npm.cmd run dev
```

Open:

```text
http://localhost:3000
```

On Windows PowerShell, `npm.cmd` avoids execution policy issues that can block `npm.ps1`.

## Training request flow

The configuration page stores a draft in `useTrainingConfig.ts`. The training page converts it into the backend request:

```json
{
  "task_type": "image_classification",
  "model_type": "resnet",
  "model_name": "resnet50",
  "dataset_name": "flowers",
  "project_name": "flowers_1760000000000",
  "epochs": 50,
  "batch_size": 16,
  "params": {
    "device": "0",
    "workers": 4,
    "amp": true,
    "architecture": "resnet50",
    "learning_rate": 0.001
  }
}
```

## Dataset page

The dataset page accepts ZIP uploads and displays backend-detected metadata:

- Number of images.
- Class names when available.
- Compatible task IDs.
- Detected dataset format IDs.

Examples of supported backend format IDs include:

- `imagefolder`
- `yolo_detection`
- `semantic_masks`
- `coco_instances`
- `paddleocr_labels`
- `tesseract_ground_truth`

## Results page

The results page reads backend run folders from `/api/runs` and exposes downloadable files such as:

- Model weights.
- Metrics CSV files.
- Logs.
- Job config JSON.
- OCR result files.

## Quality checks

Lint:

```powershell
npm.cmd run lint
```

Production build:

```powershell
npm.cmd run build
```

The production build can need network access while `next/font/google` fetches Geist font metadata.
