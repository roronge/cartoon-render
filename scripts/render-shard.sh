#!/usr/bin/env bash
# Render ONE shard (frame range) of a Remotion composition, video-only.
#
# Usage:
#   scripts/render-shard.sh <composition-id> <shard-index> <num-shards> [out-dir]
#
# Environment:
#   ENTRY_POINT   Remotion entry file        (default: src/index.ts)
#   TOTAL_FRAMES  Total frames of the comp   (default: 0 = auto-detect via
#                 `npx remotion compositions`)
#   CONCURRENCY   Remotion --concurrency     (default: 50%)
#   CRF           H.264 CRF                  (default: 16)
#   TIMEOUT_MS    Remotion --timeout per frame/page function, ms
#                 (default: 120000 — heavy three.js first frames can exceed
#                 the 30s Remotion default on small/software-GL machines)
#
# Shard math (must match the workflow + README):
#   per   = ceil(total / num_shards)
#   start = shard * per
#   end   = min(total, (shard + 1) * per) - 1
# Output: <out-dir>/shard-<NN>.mp4  (NN = zero-padded shard index)
set -euo pipefail

COMP="${1:?usage: render-shard.sh <composition-id> <shard-index> <num-shards> [out-dir]}"
SHARD="${2:?missing shard-index}"
NUM_SHARDS="${3:?missing num-shards}"
OUT_DIR="${4:-shards}"

ENTRY_POINT="${ENTRY_POINT:-src/index.ts}"
TOTAL_FRAMES="${TOTAL_FRAMES:-0}"
CONCURRENCY="${CONCURRENCY:-50%}"
CRF="${CRF:-16}"
TIMEOUT_MS="${TIMEOUT_MS:-120000}"

if [ "$TOTAL_FRAMES" = "0" ] || [ -z "$TOTAL_FRAMES" ]; then
  echo "Detecting total frames for composition '$COMP' ..."
  TOTAL_FRAMES="$(npx remotion compositions "$ENTRY_POINT" 2>/dev/null \
    | awk -v id="$COMP" '$1 == id {print $4}' | head -n1)"
fi
case "$TOTAL_FRAMES" in
  ''|*[!0-9]*) echo "ERROR: could not determine total frames (got '$TOTAL_FRAMES'). Set TOTAL_FRAMES explicitly." >&2; exit 1 ;;
esac

PER=$(( (TOTAL_FRAMES + NUM_SHARDS - 1) / NUM_SHARDS ))
START=$(( SHARD * PER ))
END=$(( (SHARD + 1) * PER ))
if [ "$END" -gt "$TOTAL_FRAMES" ]; then END=$TOTAL_FRAMES; fi
END=$(( END - 1 ))

if [ "$START" -gt "$END" ]; then
  echo "Shard $SHARD is empty (total=$TOTAL_FRAMES, shards=$NUM_SHARDS); nothing to render."
  exit 0
fi

mkdir -p "$OUT_DIR"
OUT_FILE="$(printf '%s/shard-%02d.mp4' "$OUT_DIR" "$SHARD")"
echo "Rendering '$COMP' shard $SHARD/$NUM_SHARDS: frames $START-$END (total $TOTAL_FRAMES) -> $OUT_FILE"

npx remotion render "$ENTRY_POINT" "$COMP" "$OUT_FILE" \
  --frames="${START}-${END}" \
  --codec=h264 \
  --crf="$CRF" \
  --concurrency="$CONCURRENCY" \
  --timeout="$TIMEOUT_MS" \
  --muted

echo "Done: $OUT_FILE"
