#!/usr/bin/env bash
# Stitch rendered shards into the final video and (optionally) mux final audio.
#
# Usage:
#   scripts/stitch.sh <shard-dir> <audio-file|-> [output-file]
#
# - Shards are concatenated in filename order (shard-00.mp4, shard-01.mp4, ...)
#   with the ffmpeg concat demuxer and stream copy (no re-encode).
# - <audio-file> is the FINAL, already loudness-normalized audio (e.g. an AAC
#   .m4a committed under audio/<slug>/). Pass "-" for a silent final video.
# - Verifies the stitched video frame count with ffprobe and prints a summary.
set -euo pipefail

SHARD_DIR="${1:?usage: stitch.sh <shard-dir> <audio-file|-> [output-file]}"
AUDIO_FILE="${2:?missing audio-file (use - for silent)}"
OUTPUT="${3:-final.mp4}"

command -v ffmpeg >/dev/null || { echo "ERROR: ffmpeg not found" >&2; exit 1; }
command -v ffprobe >/dev/null || { echo "ERROR: ffprobe not found" >&2; exit 1; }

ls "$SHARD_DIR"/shard-*.mp4 >/dev/null 2>&1 || { echo "ERROR: no shard-*.mp4 in $SHARD_DIR" >&2; exit 1; }

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

# Build concat list in sorted order, with absolute paths.
: > "$TMP_DIR/concat.txt"
for f in $(ls "$SHARD_DIR"/shard-*.mp4 | sort); do
  printf "file '%s'\n" "$(cd "$(dirname "$f")" && pwd)/$(basename "$f")" >> "$TMP_DIR/concat.txt"
done
echo "Concat order:"; cat "$TMP_DIR/concat.txt"

ffmpeg -hide_banner -v error -y \
  -f concat -safe 0 -i "$TMP_DIR/concat.txt" \
  -c copy "$TMP_DIR/silent.mp4"

if [ "$AUDIO_FILE" != "-" ]; then
  [ -f "$AUDIO_FILE" ] || { echo "ERROR: audio file not found: $AUDIO_FILE" >&2; exit 1; }
  ffmpeg -hide_banner -v error -y \
    -i "$TMP_DIR/silent.mp4" -i "$AUDIO_FILE" \
    -map 0:v:0 -map 1:a:0 -c copy "$OUTPUT"
else
  cp "$TMP_DIR/silent.mp4" "$OUTPUT"
fi

FRAMES="$(ffprobe -v error -select_streams v:0 -count_frames \
  -show_entries stream=nb_read_frames -of csv=p=0 "$OUTPUT")"
DUR="$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$OUTPUT")"
echo "Final: $OUTPUT  frames=$FRAMES  duration=${DUR}s"
