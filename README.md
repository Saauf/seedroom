---
title: Seedroom
emoji: 🌱
colorFrom: green
colorTo: yellow
sdk: static
app_file: index.html
fullWidth: true
short_description: A visual prompt lab you can duplicate. Visitors bring their own Pollen.
tags:
  - image-generation
  - pollinations
  - prompt-engineering
---

# Seedroom

[![Made with pollinations.ai](https://raw.githubusercontent.com/pollinations/pollinations/main/packages/ui/src/brand/badge-made-with.svg)](https://pollinations.ai/?ref=badge)

An image prompt lab: keep a seed steady, explore visual styles, revisit your session gallery, and save images with their exact recipes. Visitors connect their own Pollinations account. No shared developer key is required.

Built for [quest #17249](https://github.com/pollinations/pollinations/issues/17249). [Open the Space](https://huggingface.co/spaces/Saauf/seedroom).

## Duplicate it

1. Use Hugging Face’s **Duplicate this Space** control on this Space.
2. Keep **Static** hosting. No GPU, paid hardware, secrets, or environment variables are needed.
3. Open the copied app. If it is embedded, use **Open full app to connect** first.
4. Connect Pollen, review the chosen model and limits, then click Generate.

The return URL comes from the running app’s current origin and directory. A duplicate never redirects to the original author. This uses Pollinations’ documented, state-bound fragment authorization flow without a shared App Key, so each new Space works without registering callbacks. The returned key is removed from the URL immediately, kept only in memory, and forgotten when you disconnect or reload. Pending state and non-secret form preferences use session storage. No account scopes are requested.

## Make it yours

Edit `config.mjs` to change the title, default prompt, preferred model, budget, and style presets. Edit `style.css` for colors and layout. Model choices and listed prices come from the live `/image/models` catalog; the app offers built-in, text-only image models that accept Quest Pollen. A different model needs its own authorization. The template link points to the original source template deliberately.

Static HTML hosting is free according to [Hugging Face’s documentation](https://huggingface.co/docs/hub/spaces-sdks-static). Pollinations generation consumes the visitor’s Pollen. Review the final budget and model permissions on the consent page; select **Quest pollen only** to exclude Paid Pollen. The app never buys or tops up Pollen, starts background generations, retries automatically, or changes models after a failed request.

## API and privacy

`core.mjs` sends one native `POST /v1/images/generations` request per Generate click, with a Bearer header, `n: 1`, explicit seed and size, and `response_format: b64_json`. The prompt and key stay out of request URLs. Image downloads use the returned bytes and their actual MIME type. Exported recipes contain generation settings and API-reported usage, never keys or authorization headers.

The app uses no analytics or third-party fonts. Generated images remain in browser memory and disappear on reload; save anything you want to keep. A seed is a model input, not a guarantee of identical output across provider changes.

## Local checks

No dependencies or build step are needed. Node.js 22+ runs the tests; Python 3 serves the preview.

```sh
npm test
npm run dev
```

Open http://127.0.0.1:4174/. Tests cover structured model eligibility, exact request encoding against a local HTTP fixture, pricing units, input bounds, image MIME detection, error handling without retries, state validation, duplicate-host redirects, and credential-free recipe export. Automated API responses are fixtures; live verification is recorded separately.
