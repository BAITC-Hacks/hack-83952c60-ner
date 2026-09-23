The application supports `ru` (Russian), `kk` (Kazakh), and `en` (English).

`catalog.json` maps the original source strings to English and Kazakh. Use `t(source, parameters)` for text and `{0}`, `{1}`, etc. for interpolated values. Translate data descriptions when displaying them; keep domain IDs and the `Город` / `Район` scope values unchanged in simulation logic.

Components subscribe through `useLanguage()`. `setLanguage()` updates subscribers synchronously, persists the preference under `astana-language`, and updates the document language, title, and description. It does not remount the application or reset scenario state.

The built-in advisor stores localized answers for all three languages so existing answers update immediately. User-written questions and team names remain as entered. Future external AI integrations should pass the selected language through `LLMConfig.language`; external free-form responses are not automatically translated retroactively.

Run `npm test` to check catalog placeholders, translated component rendering, exports, advisor answers, and simulation regressions.
