# Egor Electionaire — personal website

Static site (HTML + CSS, no build step). Everything that gets published lives in `public_html/`.

```
public_html/
  index.html     main page — edit the [bracketed] placeholders here
  css/style.css  styles (colors are variables at the top)
  js/particles.js  hero particle portrait (WebGL), reads images/hero-particles.png
  404.html       not-found page
  favicon.svg
  robots.txt
  .htaccess      Apache settings (404 page, caching, optional HTTPS redirect)
.cpanel.yml      deploy script for cPanel Git Version Control
tools/           particle-map builder and its source photo (not deployed)
```

## Editing

Open `public_html/index.html`, replace each `[placeholder]`, and set the `href="#"` links
(LinkedIn, IMDb, CV) to real URLs. For a CV PDF, drop it in `public_html/` (e.g. `cv.pdf`)
and use `href="cv.pdf"`. Preview locally by opening `index.html` in a browser.

## Hero particle portrait

The cover figure is drawn from `public_html/images/hero-particles.png`, a grayscale map where
brighter pixels become denser, brighter particles. To use a different photo, rebuild it
(needs Python with Pillow, numpy and scipy):

```
python3 tools/build-particle-map.py tools/source/hero.jpg public_html/images/hero-particles.png 1.0
```

Browsers block reading image pixels from `file://`, so preview the particles through a local server:
`cd public_html && python3 -m http.server`, then open http://localhost:8000. Without WebGL the
hero falls back to the plain centred name.

## Deploying to cPanel

### Option A — File Manager upload (simplest)
1. In cPanel open **File Manager** → `public_html`. Turn on **Settings → Show Hidden Files** so `.htaccess` is visible.
2. Remove the host's default `index.html`/`default.html` if present.
3. Upload the **contents** of this repo's `public_html/` folder (not the folder itself).
   Tip: zip the contents, upload the zip, then right-click → **Extract**.

### Option B — Git Version Control (auto-deploy from this repo)
1. Push this repo to GitHub (or similar).
2. cPanel → **Git™ Version Control** → **Create** → paste the clone URL,
   set the repository path to something outside `public_html` (e.g. `repositories/electionaire`).
3. Open **Manage** → **Pull or Deploy** → **Update from Remote**, then **Deploy HEAD Commit**.
   `.cpanel.yml` copies `public_html/` into your live `~/public_html`.
4. After future changes: push, then repeat step 3.

### After it's live
- cPanel → **SSL/TLS Status** → run **AutoSSL** for your domain.
- Once `https://` works, uncomment the "Force HTTPS" block in `public_html/.htaccess`.
