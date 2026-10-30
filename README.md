# Shiva Prakash — portfolio

Personal portfolio at [shiva.uwce.ca](https://shiva.uwce.ca), built with HTML, CSS,
and JavaScript. No framework or runtime dependencies.

The opening PCB assembly plays at 1.5× speed, then continues into an idle loop.
Scrolling moves through education, experience, projects, and contact details.
The card returns with the idle loop at the end. Reduced-motion settings receive
a static opening and normal document scrolling.

The videos use streaming-friendly H.264 at full 1080p resolution. The idle loop
downloads only after assembly is buffered. Slow downloads keep waiting while
data arrives; stalled or interrupted playback gets two automatic reload attempts
before offering a manual retry. Switching tabs invalidates old playback requests.

## Preview and edit

With Node.js installed:

```sh
npm run build
npm start
```

Open `http://127.0.0.1:8780/`.

- `src/template.html`: page structure, education, experience, leadership, and skills.
- `src/content.json`: project descriptions, bullet points, galleries, and contact links.
- `styles.css`: layout, typography, and responsive styles.
- `app.js`: animation, scrolling, video playback, and image galleries.
- `assets/`: videos, project images, fonts, and résumé.

Run `npm run build` after editing the template or content, and commit the generated
`index.html` along with the source changes.

```sh
npm run check
npm test
```

## Publishing

GitHub Pages publishes the repository root on `main`. The generated `index.html`,
styles, script, and assets are committed, so no build workflow is required.
`CNAME` keeps the custom domain `shiva.uwce.ca`; `.nojekyll` serves the static files
directly. The old résumé URL, `Shiva_Prakash_Resume_+_Portfolio.pdf`, remains available
with the current résumé and portfolio.

## Credits

The PCB animation was rendered with [Silkreel](https://github.com/hridaya423/silkreel).
Its license is included in `assets/Silkreel-LICENSE.txt`. IBM Plex Mono is bundled
locally with its license in `assets/IBM-Plex-Mono-LICENSE.txt`.

The intro enables native muted autoplay only while the tab is visible, and script
playback waits for enough buffered data. Temporary autoplay refusals retry without
reloading the video; visibility and focus changes trigger a fresh attempt. Genuine
browser restrictions retain a manual fallback, and an ordinary trusted tap or key
can also unlock playback. Startup regression coverage includes these transitions.
