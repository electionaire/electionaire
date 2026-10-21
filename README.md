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
mecheng/         mecheng.electionaire.com: computational mechanics course apps
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

## Subdomain: mecheng.electionaire.com

`mecheng/` is a separate small site: an exam trainer for TU/e 4MC10 Computational Mechanics.
Plain HTML, CSS and JS with no build step. `.cpanel.yml` copies it to `~/mecheng.electionaire.com/`
on every deploy.

```
mecheng/
  index.html        menu of the ten exam questions
  assets/lab.css    shared theme (matches electionaire.com) and one-screen dashboard layout
  assets/lab.js     question registry (titles, covered past problems), header, maths, past-exam widget
  q1/ … q10/        one page per exam slot: method, interactive lab, past exams with worked solutions
```

Each question page loads KaTeX from jsDelivr for the maths. To add a past exam, append an item to the
`Lab.exam(...)` list at the bottom of that question's `index.html`; to change a menu card, edit `QS` in
`assets/lab.js`.

One-time setup in cPanel:
1. **Domains** → **Create A New Domain**. Enter `mecheng.electionaire.com`.
   Untick "Share document root" and set the document root to `mecheng.electionaire.com`
   (so it becomes `/home/<user>/mecheng.electionaire.com`, outside `public_html`).
2. Deploy as usual (Git Version Control → Update from Remote → Deploy HEAD Commit).
3. **SSL/TLS Status** → run **AutoSSL** so the subdomain gets a certificate. Once `https://` works,
   uncomment the "Force HTTPS" block in `mecheng/.htaccess`.

If the domain's DNS is not managed by this cPanel host, also add a DNS record at your DNS provider:
`mecheng` as a CNAME to `electionaire.com` (or an A record to the server's IP).

Each page is served at its folder, e.g. `mecheng.electionaire.com/q9/`.

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
