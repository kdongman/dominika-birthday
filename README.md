# A Little Birthday Surprise for Dominika

A lightweight, three-scene birthday card built with React, TypeScript, Vite, CSS, and original SVG artwork. It has no backend; a local audio file or Spotify embed can be added to the preview.

## Customize the preview

The card opens directly on its photo side with Dominika's portrait included in the published page. Choose **Edit photo and music** to select a different photo and either choose an MP3, M4A, WAV, or OGG file up to 20 MB, or paste a Spotify track or podcast link. A local file is played as soon as the page loads when the browser allows it; if sound autoplay is blocked, press play in the player. Spotify playback is controlled by its own player. A Spotify podcast can start at a chosen second, but Spotify track embeds do not expose a supported custom start point. Use an audio file for a song excerpt. Photos and audio selected in the editor stay in the visitor's browser and reset when the tab reloads.

## Run locally

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. To check the production build locally:

```sh
npm run build
npm run preview
```

## Deploy

### Vercel or Netlify

Import this folder as a project and use:

- Build command: `npm run build`
- Output directory: `dist`

### GitHub Pages

The included GitHub Actions workflow can build and deploy the site when manually run from the Actions tab. For a public repository named `dominika-birthday`, the site URL is `https://kdongman.github.io/dominika-birthday/`. The repository must be public for visitors to access the site without GitHub sign-in.
