#!/usr/bin/env bash
# Render "Every Step" (World OA Day) as 8 chunks on a worker pool, then mux with the mix.
#   tools/oa/render_all.sh                  # everything
#   CHUNKS="3 4" tools/oa/render_all.sh     # re-render some chunks, then re-mux
set -euo pipefail
cd "$(dirname "$0")/../.."
OUT="${OUT:-out/oa/wockhardt_world_oa_day_every_step_1080p_master.mp4}"
WORKERS="${WORKERS:-4}"
TMP="${CHUNK_DIR:-out/oa/chunks}"
export TMP
NCH=8
PER=225 # 8 x 225 = 1800 frames = 60 s @ 30 fps
mkdir -p "$TMP" "$(dirname "$OUT")"

if [ -z "${SKIP_AUDIO:-}" ]; then
  node tools/oa/export_cues.mjs
  python3 -I oa/audio/sound.py oa/audio/cues.json oa/audio/ > "$TMP/audio_log.txt"
fi

CH="${CHUNKS:-$(seq -s ' ' 0 $((NCH - 1)))}"
for c in $CH; do
  a=$(python3 -c "print(f'{$c * $PER / 30:.4f}')")
  b=$(python3 -c "print(f'{($c + 1) * $PER / 30:.4f}')")
  echo "$c $a $b"
done | xargs -r -P "$WORKERS" -L 1 sh -c 'node tools/oa/render.mjs video --from "$1" --to "$2" --out "$TMP/chunk_$0.mkv" --crf 12 --preset fast > "$TMP/log_$0.txt" 2>&1 && echo "chunk $0 done" || echo "chunk $0 FAILED"'

for c in $(seq 0 $((NCH - 1))); do
  [ -s "$TMP/chunk_$c.mkv" ] || { echo "missing chunk $c"; exit 1; }
done
for c in $(seq 0 $((NCH - 1))); do echo "file '$(pwd)/$TMP/chunk_$c.mkv'"; done > "$TMP/list.txt"
ffmpeg -y -loglevel error -f concat -safe 0 -i "$TMP/list.txt" -i oa/audio/mix.wav \
  -map 0:v -map 1:a -c:v libx264 -preset slow -crf 16 -tune grain -profile:v high -pix_fmt yuv420p \
  -c:a aac -b:a 256k -shortest -movflags +faststart "$OUT"
# web version under 100 MB (two-pass, fixed bitrate) + the same picture with the music & effects only
WEB="${OUT%_master.mp4}.mp4"
ME="${OUT%_master.mp4}_music-and-effects.mp4"
ffmpeg -y -loglevel error -i "$OUT" -c:v libx264 -preset slow -b:v 9500k -pass 1 -passlogfile "$TMP/2pass" -an -f mp4 /dev/null
ffmpeg -y -loglevel error -i "$OUT" -c:v libx264 -preset slow -b:v 9500k -pass 2 -passlogfile "$TMP/2pass" -c:a aac -b:a 192k -movflags +faststart "$WEB"
ffmpeg -y -loglevel error -i "$WEB" -i oa/audio/me.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k -shortest -movflags +faststart "$ME"
ffprobe -v error -show_entries format=duration,size:stream=codec_name,width,height,r_frame_rate -of compact "$WEB"
ls -la "$OUT" "$WEB" "$ME"
echo RENDER_ALL_DONE
