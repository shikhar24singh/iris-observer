# IRIS — The ASCII Observer

A browser-based ASCII eye inspired by the supplied video. Its gaze follows the cursor, a local webcam face detector, or a gentle autopilot. Includes three iris colors, response speed, blinking, fullscreen, mobile layout, and reduced-motion support.

## Run locally

Install Node.js, open a terminal in this folder, and run:

```sh
npm start
```

Open http://127.0.0.1:4173 in Chrome, Edge, Firefox, or Safari. Click **Enable camera**, allow camera permission, and move your face from side to side. Camera mode tracks faces, not arbitrary objects. Pointer and Autopilot switch the camera off. Moving the tab to the background also stops camera capture.

No build or npm dependency installation is required. The face detector and model are bundled. Camera images are processed locally in a worker; they are not uploaded, recorded, or persisted. Host the `dist` directory on HTTPS for camera access outside localhost. Opening the HTML as a `file://` URL will not work for module scripts and workers.

## Files

- `dist/app.js`: canvas rendering, tracking state, webcam lifecycle, and controls.
- `dist/tracker-worker.js`: MediaPipe face detector running in a classic web worker.
- `dist/vendor/`: pinned MediaPipe Tasks Vision 0.10.32 and WebAssembly runtimes.
- `dist/models/`: BlazeFace short-range face detection model.
- `server.mjs`: dependency-free static server bound to localhost.

The camera preview is mirrored; the eye moves in the same screen direction as the subject's mirrored position. The detector stays near its previous face position; when selecting a new subject it chooses the largest face. If the face disappears, it enters a gentle searching state.

## Validation

Verified in headless Chrome with a simulated moving-face camera: successful face detection, changing eye position, face loss and reacquisition, stopped camera tracks on mode changes, permission-denial recovery, pointer movement, color selection, mobile width, and browser error checks. Actual hardware camera performance depends on the browser, lighting, and device.

## Third-party software

Google MediaPipe Tasks Vision 0.10.32 and the BlazeFace short-range model are used under Apache License 2.0. See `dist/vendor/LICENSE.txt` and `dist/vendor/THIRD_PARTY_NOTICES.md`.
