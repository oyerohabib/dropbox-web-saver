# Contributing to Web Saver for Dropbox

Thanks for helping out. Bug reports, feature ideas, docs fixes, and pull requests are all welcome.

By taking part you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md). Report security problems privately as described in [SECURITY.md](SECURITY.md), not in public issues.

## Reporting bugs and ideas

- Inside the extension, use **Send feedback** in the popup or settings page. It opens a prefilled GitHub issue with your extension version and browser.
- Or open an issue directly on [GitHub](https://github.com/oyerohabib/dropbox-web-saver/issues/new/choose) and pick the bug, feature, or feedback template.
- Search existing issues first, and include steps to reproduce for bugs.

## Getting set up

You need Node.js 20 or newer and a Chromium browser (Chrome, Brave, or Edge).

```bash
git clone https://github.com/oyerohabib/dropbox-web-saver.git
cd dropbox-web-saver
npm install
npm run dev
```

`npm run dev` builds the extension and reloads it as you edit. To load a production build manually:

1. Run `npm run build`.
2. Open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked**, and select `.output/chrome-mv3`.
3. Follow the setup guide on the settings page to create your own Dropbox app and connect it.

## Scripts

| Command | What it does |
| --- | --- |
| `npx tsc --noEmit` | Type check |
| `npm test` | Run the Vitest unit tests |
| `npm run build` | Production build into `.output/chrome-mv3` |
| `npm run zip` | Zip the build for sharing or store upload |

CI runs the type check, tests, and build on every pull request, so run them locally before pushing.

## Project structure

- `src/entrypoints/`: one folder or file per extension surface: `background.ts`, `content.ts`, and the `popup`, `options` (settings), `save` (review window), `privacy`, and `feedback` pages.
- `src/lib/`: framework-free logic such as Dropbox auth and API calls, storage, the save orchestrator, and helpers in `utils/`. Unit tests live next to the code as `*.test.ts`.
- `src/components/`: shared React components, including the small design-system primitives in `ui.tsx`.
- `src/assets/`: global styles and the source icon (`icon.svg`), which is turned into toolbar icons at build time.

## Making changes

- Keep pull requests focused on one change, and prefer several small commits with clear messages over one large one.
- Add or update tests for logic in `src/lib`.
- Match the surrounding code style. Reuse the components in `src/components/ui.tsx` and the CSS tokens in `src/assets/style.css` rather than adding new one-off styles.
- If you change what data the extension stores or sends, update both `PRIVACY.md` and `src/entrypoints/privacy/App.tsx` so they stay in sync.
- If you add a permission or host permission, explain why in the pull request and in the privacy policy.
- Never commit a Dropbox app key, app secret, or access token.

## Pull request checklist

- [ ] `npx tsc --noEmit`, `npm test`, and `npm run build` pass
- [ ] Tested by loading the unpacked build in a Chromium browser
- [ ] Screenshots included for visible UI changes
- [ ] Privacy policy and README updated if behaviour or data handling changed

## License

By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE).
