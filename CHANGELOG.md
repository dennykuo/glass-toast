# Changelog

## 0.1.1 (2026-11-14)

### Added

- Added a [Traditional Chinese documentation site](https://dennykuo.github.io/glass-toast/) and an [interactive demo](https://dennykuo.github.io/glass-toast/demo.html), with links from both READMEs.
- Added `register({ closeLabel })` to localize the close button's accessible name. The default is `Close`.

### Fixed

- Closing a notification preserves focus when the user moves it elsewhere during the exit animation.
- Improved action button text contrast in dark mode and when hovering over an error action in light mode.
- Long action labels wrap on narrow screens, leaving room for the message and close button. The close icon is easier to see in light mode.
- Clearing or evicting notifications cancels their timers. Clearing all notifications restores focus to the trigger when focus was inside a toast and the trigger is still available.
- Screen reader messages update separate live regions while the visible buttons remain available for interaction.
- Added CommonJS type declarations for the main entry point so TypeScript can resolve types from both ESM and CommonJS.
- Added a declaration for the stylesheet entry so strict TypeScript projects can import it without a global CSS shim.

### Changed

- The supported Node.js range for the package and development tools is now `^22.13.0 || >=24.0.0`.

## 0.1.0 (2026-10-08)

- Initial stable npm release of the dependency-free toast library, with ESM and UMD builds, TypeScript declarations, and a standalone stylesheet.
