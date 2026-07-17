# FunkeeB Collage Studio

Static sideproject for composing FunkeeB-style product image layouts.

## Run locally

Open `index.html` in a browser. No build step or server is required.

## Publish on GitHub Pages

Push this folder to a repository and set GitHub Pages to serve it from the repo root, or copy these files into the Pages root:

- `index.html`
- `styles.css`
- `app.js`
- `assets/transparent-logo-v3.svg`

## What it does

- uploads multiple local photos
- renders a FunkeeB-branded PNG on canvas
- uses the light FunkeeB visual style
- adds the FunkeeB icon and HTML wordmark at the top of the app
- supports editable title and subtitle text for every photo
- supports per-photo frame positioning with X/Y crop controls
- autosaves layout, spacing, captions, and crop settings in localStorage
- supports grid, collage, and card layouts
- maps 4 photos to `2 x 2` and 6 photos to `3 x 2`
