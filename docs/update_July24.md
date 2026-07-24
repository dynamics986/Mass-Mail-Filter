# July 24, 2026 - Website Update Log

## Conclusion

The online Digest was not updated. The root cause was not the sorting logic of the opportunity filtering page, nor was it the `feed.json` reading the wrong date. Rather, it was that the pipeline testing gate before the fetching step in GitHub Actions failed. Because the fetching step was skipped, the repository's `public/data/feed.json` and `public/data/meta.json` remained stuck at 2026-07-17.

## Chain of Causation

1. The `Update CUHK digest data` workflow first executed `python -m pytest -q tests`.
2. The Chinese test case `g-cn-deadline` in `tests/test_eval_golden.py` generated the summary "Welcome students to attend the career lecture. The registration deadline is...".
3. The summary deduplication logic removed all punctuation, concatenating the adjacent sentences "lecture. The registration" into "lecture registration", mistakenly determining that the summary was merely a copy of the title, and cleared the summary.
4. After the test failed, `Fetch and validate public digest`, the data commit, and the subsequent Pages deployment were all skipped. As a result, the four issues displayed on the page remained July 17, July 10, July 3, and June 26.

## Already Fixed

- Corrected the summary deduplication logic for Chinese sentence boundaries and added regression tests.
- Added `--verify-recent --lookback-days 28` validation to the update workflow. It accesses the CUHK announcements page to confirm that `feed.json` indeed contains the latest four available Digests; if the feed is stale, the Actions will fail and explicitly list the missing dates, eliminating the false success state where "the task succeeded but the database was not updated."
- The latest four issues obtained by the current validation are 2026-07-24, 07-17, 07-10, and 07-03.

## `cu-link` Branch Configuration

`.github/workflows/pages.yml` originally specified `branches: [main, cu-link]`. This meant that the `push` trigger would only start when pushing to `main` or the old `cu-link` branch. Since the current repository only has `main`, the `cu-link` reference has been removed. The `workflow_run` trigger will still deploy Pages after the Digest update workflow completes successfully.

## Regarding `dist/assets/index-BohOPBTI.css`

The `BohOPBTI` in this filename is Vite's content hash, not an error code. The production build automatically generates files like `index-<hash>.css`, which are correctly referenced by `dist/index.html`. The local `npm run build` completed successfully, indicating that CSS compilation and syntax are both normal.

If the console online once showed a 404 for this file, it was typically due to the old Pages artifact, Service Worker, or CDN cache still referencing an older version of the HTML. After redeploying the complete `dist`, the HTML and the hashed CSS will be updated together as a matched set. Do not manually pin or rename this hashed file.