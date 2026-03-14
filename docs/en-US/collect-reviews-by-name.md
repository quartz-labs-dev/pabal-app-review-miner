# Usage: `collect-reviews-by-name`

For prerequisites and registered app setup, see [Setup](./setup.md).

This guide documents the name-based collector script:

- `npm run collect-reviews-by-name -- --my-app <owner> --name "<query>" ...`
- `node dist/addByName.js ...`

## CLI Options

- `--my-app` (required): owner app key (`slug`, `name`, `bundleId`, `packageName`, or `appId`)
- `--name` (required): app name query used to search app ids
- `--play-id`: optional Google Play app id override
- `--ios-id`: optional App Store app id override
- `--platform`: source filter `both` | `ios` | `android` (default `both`)
- `--limit`: number of reviews per source request (default `200`)
- `--global`: collect reviews across global store markets/countries (default enabled)
- `--no-global`: disable global sweep and use only default market requests (`us/en` for Play, `us` for App Store)
- `--registered-apps-path`: custom registered apps file path
- `--output text|json`: output mode (default `text`)

## Basic Run

```bash
npm run collect-reviews-by-name -- --my-app golden-horizon --name "BJJBuddy" --limit 200
```

## Store-Scoped Run

iOS only:

```bash
npm run collect-reviews-by-name -- --my-app golden-horizon --name "BJJBuddy" --platform ios
```

Android only:

```bash
npm run collect-reviews-by-name -- --my-app golden-horizon --name "BJJBuddy" --platform android
```

## Explicit Id Override

```bash
npm run collect-reviews-by-name -- --my-app golden-horizon --name "BJJBuddy" \
  --play-id com.bjja.buddy \
  --ios-id 123456789
```

## JSON Output

```bash
npm run collect-reviews-by-name -- --my-app golden-horizon --name "BJJBuddy" --output json
```

## Output

- `data/{myAppId}/reviews/manual__play-<id>__ios-<id>.json` (shape depends on resolved ids)
