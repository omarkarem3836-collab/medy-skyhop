# Medy Skyhop

A mobile browser game with a home-screen app and offline play. This folder is the complete static site; no build step or package installation is required.

## Publish with GitHub Pages

Upload these files and the entire `assets/` folder to the root of the `omarkarem3836-collab/medy-skyhop` repository. Keep the filenames and folder structure unchanged. In **Settings → Pages**, deploy from the `main` branch and `/ (root)`. Set the custom domain to `play.medsky.aero` and keep the included `CNAME` and `.nojekyll` files.

Add a DNS **CNAME** record for **play** pointing to **omarkarem3836-collab.github.io**. The target has no protocol, repository path, or trailing slash. Do not replace the DNS records for the main Medsky website. After GitHub verifies DNS and issues the certificate, enable **Enforce HTTPS**. The intended address is `https://play.medsky.aero/`; it works only after deployment, DNS, and HTTPS setup are complete.

## Install and play

Open the game over HTTPS. Tap **Install app** for instructions. On iPhone/iPad, use Safari's Share menu → Add to Home Screen; on supporting Android browsers, use the install action or browser menu. Offline play becomes available after the first complete online load. Browser/device storage can be cleared by the user or operating system. No trial expiry is set.

Tap the flight area to flap. Scores and settings stay on the device/browser that saved them. Changing the host creates a separate app installation and separate local scores.

## Update

Replace the static files together and bump `REVISION` in `sw.js` whenever the cached app files change. Installed updates wait until all game windows close so an active flight is not interrupted. All app references, manifest URLs, and service-worker scope are relative, supporting either a domain root or a GitHub Pages project path.

## Expo competition on one Android screen

Use https://play.medsky.aero/?expo=2026-11-03 on the stand screen. Enter a unique nickname or numbered ticket before playing. The highest gate score from a single completed flight is saved per player; retries do not add scores together. Equal scores share a rank. Use the same ticket to return to an existing player, and **Next player** to hand over the screen. Set the same number of attempts for everyone and supervise prize-winning flights.

**Leaderboard → Export scores (CSV)** downloads the full ranked list, attempts, and timestamps. Keep backups during the event and at prize time. Scores are local to this browser, not synced or published online; use one tab and the same browser, keep the event URL unchanged, avoid private browsing and clearing site data. The ordinary installed app launches normal mode, so bookmark the full expo URL. Use a different expo query value for a separate event or rehearsal.
