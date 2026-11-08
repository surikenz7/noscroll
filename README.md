# NoScroll

Instagram without the endless scrolling, in plain Safari on iPhone with nothing to install. `noscroll.js` runs as a bookmarklet: you tap it after instagram.com opens.

- Home feed posts hidden, the stories tray stays
- Explore shows only the search bar
- Reels tab hidden, and swiping from one reel to the next goes back
- DMs, notes, stories, profiles and settings untouched

Setup page (builds and copies the bookmarklet): https://surikenz7.github.io/noscroll/

## Updating
Change `noscroll.js`, commit and push, then copy the code from the setup page into the bookmark again.

All Instagram-specific selectors and paths are in `CONFIG` at the top of the script. Use whole-line comments only: the setup page strips them when it builds the bookmarklet.
