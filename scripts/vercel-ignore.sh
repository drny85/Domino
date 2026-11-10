#!/usr/bin/env bash
# Vercel "Ignored Build Step": exit 0 skips the build, exit 1 runs it.
#
# A preview build needs a Convex *preview* deploy key. A Vercel project that
# only has a production key cannot build previews (Convex refuses to use a
# production key outside production), so skip the build there instead of
# failing every pull request.
case "${VERCEL_ENV:-}:${CONVEX_DEPLOY_KEY:-}" in
  preview:prod:*)
    echo "Preview build skipped: this project only has a production Convex deploy key."
    exit 0
    ;;
esac
exit 1
