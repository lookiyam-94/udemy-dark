# Udemy Dark

A Manifest V3 extension that gives Udemy a dark theme, including the course player. Built for Vivaldi, works in any Chromium browser.

## Install (unpacked)
1. Clone this repo.
2. Open `vivaldi://extensions` and turn on **Developer mode**.
3. Click **Load unpacked** and select this folder.

## Features
- Dark theme for the storefront and the course player (sidebar, Q&A, notes)
- Toolbar popup with an on/off switch (saved in `chrome.storage.local`)
- Only runs on `udemy.com`

## Notes
Udemy uses hashed class names, so selectors in `dark.css` prefer `[data-purpose]` attributes. Some pages may need more rules; PRs welcome.

## License
MIT
