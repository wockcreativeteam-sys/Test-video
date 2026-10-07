#!/usr/bin/env bash
# Render the film as 12 fixed chunks (265 frames each) on a worker pool, then mux with the score.
#   tools/render_all.sh                 # everything
#   CHUNKS="5 6" tools/render_all.sh    # re-render only chunks 5 and 6, then re-mux
#   WORKERS=3 OUT=out/film.mp4 tools/render_all.sh
set -euo pipefail
cd "$(dirname "$0")/.."
OUT="${OUT:-out/wockhardt_reengineered_1080p.mp4}"
WORKERS="${WORKERS:-3}"
TMP="out/chunks"
NCH=12
PER=265 # 12 x 265 = 3180 frames = 106 s @ 30 fps
mkdir -p "$TMP" "$(dirname "$OUT")"

node tools/export_cues.mjs
python3 -I film/audio/score.py film/audio/cues.json film/audio/score.wav
ffmpeg -y -loglevel error -i film/audio/score.wav -c:a aac -b:a 192k film/audio/score.m4a

CH="${CHUNKS:-$(seq -s ' ' 0 $((NCH - 1)))}"
for c in $CH; do
  a=$(python3 -c "print(f'{$c * $PER / 30:.4f}')")
  b=$(python3 -c "print(f'{($c + 1) * $PER / 30:.4f}')")
  echo "$c $a $b"
done | xargs -P "$WORKERS" -L 1 sh -c 'node tools/render.mjs video --from "$1" --to "$2" --out "out/chunks/chunk_$0.mkv" --crf 12 --preset fast > "out/chunks/log_$0.txt" 2>&1 && echo "chunk $0 done" || echo "chunk $0 FAILED"'

for c in $(seq 0 $((NCH - 1))); do
  [ -s "$TMP/chunk_$c.mkv" ] || { echo "missing chunk $c"; exit 1; }
done
for c in $(seq 0 $((NCH - 1))); do echo "file '$(pwd)/$TMP/chunk_$c.mkv'"; done > "$TMP/list.txt"
ffmpeg -y -loglevel error -f concat -safe 0 -i "$TMP/list.txt" -i film/audio/score.wav \
  -map 0:v -map 1:a -c:v libx264 -preset slow -crf 17 -tune grain -profile:v high -pix_fmt yuv420p \
  -c:a aac -b:a 256k -shortest -movflags +faststart "$OUT"
ffprobe -v error -show_entries format=duration,size:stream=codec_name,width,height,r_frame_rate -of compact "$OUT"
# a share/web version under 100 MB (two-pass, fixed bitrate)
WEB="${OUT%.mp4}_web.mp4"
ffmpeg -y -loglevel error -i "$OUT" -c:v libx264 -preset slow -b:v 6200k -pass 1 -an -f mp4 /dev/null
ffmpeg -y -loglevel error -i "$OUT" -c:v libx264 -preset slow -b:v 6200k -pass 2 -c:a aac -b:a 192k -movflags +faststart "$WEB"
rm -f ffmpeg2pass-0.log ffmpeg2pass-0.log.mbtree
ls -la "$OUT" "$WEB"
echo RENDER_ALL_DONE
