# Shiva Prakash — PCB business card

A single-screen portfolio: the PCB assembles at 1.5× speed, then keeps hovering
while résumé, email, LinkedIn, X, and GitHub links fade in. There is no scrolling
résumé, project gallery, or scroll-driven camera animation.

## Preview and edit

With Node.js installed:

```sh
npm run build
npm start
```

Open `http://127.0.0.1:8780/`.

- `src/template.html`: the business card and contact screen.
- `src/content.json`: résumé URL, email, and social profile URLs.
- `styles.css`: responsive layout and typography.
- `app.js`: assembly, idle playback, replay, and tab visibility handling.
- `image-animation.js`: animated image fallback for restricted autoplay.
- `assets/`: animation assets, fonts, licenses, and the existing résumé PDF.

Update the résumé URL in `src/content.json` or replace the linked PDF, then rebuild.
Commit the generated page with source changes. The old project descriptions,
bullet points, and gallery images are removed; prior versions remain in Git.

```sh
npm run check
npm test
```

## Playback and accessibility

The intro requests muted inline playback immediately while visible, including
before metadata loads. It waits through advancing downloads and retries stalls.
Browsers that block video autoplay automatically use the matching single-pass
animated WebP, followed by an animated WebP idle loop. Image downloads complete
before their playback clock starts. Replay restarts from the beginning, and
background tabs pause playback. Refreshes and restored pages restart assembly.

The links remain hidden during assembly. A keyboard-accessible skip button
reveals them immediately. Reduced-motion visitors get the static card and links;
visitors without JavaScript get the same usable static contact screen.

When changing the videos, regenerate their WebP fallbacks with FFmpeg/libwebp:

```sh
ffmpeg -i pcb-reveal.mp4 -vf 'setpts=PTS/1.5,fps=24,scale=960:-1:flags=lanczos' -an -c:v libwebp_anim -quality 78 -compression_level 4 -loop 1 pcb-reveal-fallback.webp
ffmpeg -i pcb-idle.mp4 -vf 'fps=24,scale=960:-1:flags=lanczos' -an -c:v libwebp_anim -quality 78 -compression_level 4 -loop 0 pcb-idle-fallback.webp
```

The intro WebP plays once for 10.666 seconds; the idle WebP loops indefinitely.
Keep the image player's completion duration aligned if source timing changes.

## Credits

The PCB animation was rendered with [Silkreel](https://github.com/hridaya423/silkreel).
Its license and IBM Plex Mono's license are included with the assets. The site
uses local fonts and has no analytics, forms, or third-party JavaScript.

## Publishing

GitHub Pages publishes the repository root on `main` at
[shiva.uwce.ca](https://shiva.uwce.ca). `CNAME` preserves the custom domain and
`.nojekyll` serves static files directly. The legacy résumé URL,
`Shiva_Prakash_Resume_+_Portfolio.pdf`, remains available.
