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
