# Egor Electionaire — personal website

Static site (HTML + CSS, no build step). Everything that gets published lives in `public_html/`.

```
public_html/
  index.html     main page — edit the [bracketed] placeholders here
  css/style.css  styles (colors are variables at the top)
  404.html       not-found page
  favicon.svg
  robots.txt
  .htaccess      Apache settings (404 page, caching, optional HTTPS redirect)
.cpanel.yml      deploy script for cPanel Git Version Control
```

## Editing

Open `public_html/index.html`, replace each `[placeholder]`, and set the `href="#"` links
(LinkedIn, IMDb, CV) to real URLs. For a CV PDF, drop it in `public_html/` (e.g. `cv.pdf`)
and use `href="cv.pdf"`. Preview locally by opening `index.html` in a browser.

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
