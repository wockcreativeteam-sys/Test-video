#!/usr/bin/env bash
# Render the whole film in parallel chunks, then mux with the score.
#   tools/render_all.sh [out.mp4] [workers]
set -euo pipefail
cd "$(dirname "$0")/.."
OUT="${1:-out/wockhardt_reengineered_1080p.mp4}"
WORKERS="${2:-3}"
DUR=106
TMP="out/chunks"
mkdir -p "$TMP" "$(dirname "$OUT")"
rm -f "$TMP"/chunk_*.mkv

node tools/export_cues.mjs
python3 -I film/audio/score.py film/audio/cues.json film/audio/score.wav

# split into equal ranges on frame boundaries
python3 - "$DUR" "$WORKERS" > "$TMP/ranges.txt" <<'EOF'
import sys
dur, w = float(sys.argv[1]), int(sys.argv[2])
fps = 30
frames = int(round(dur * fps))
step = frames // w
for i in range(w):
    a = i * step
    b = frames if i == w - 1 else (i + 1) * step
    print(f"{a / fps:.4f} {b / fps:.4f}")
EOF

i=0
pids=()
while read -r a b; do
  node tools/render.mjs video --from "$a" --to "$b" --out "$TMP/chunk_$i.mkv" --crf 12 --preset fast > "$TMP/log_$i.txt" 2>&1 &
  pids+=($!)
  i=$((i+1))
done < "$TMP/ranges.txt"
for p in "${pids[@]}"; do wait "$p"; done

ls "$TMP"/chunk_*.mkv | sort -V | sed "s#^#file '$(pwd)/#; s#\$#'#" > "$TMP/list.txt"
ffmpeg -y -loglevel error -f concat -safe 0 -i "$TMP/list.txt" -i film/audio/score.wav \
  -map 0:v -map 1:a -c:v libx264 -preset slow -crf 17 -tune grain -profile:v high -pix_fmt yuv420p \
  -c:a aac -b:a 256k -shortest -movflags +faststart "$OUT"
ffprobe -v error -show_entries format=duration,size:stream=codec_name,width,height,r_frame_rate -of compact "$OUT"
# a web/share version under 100 MB (two-pass, fixed bitrate)
WEB="${OUT%.mp4}_web.mp4"
ffmpeg -y -loglevel error -i "$OUT" -c:v libx264 -preset slow -b:v 6200k -pass 1 -an -f mp4 /dev/null
ffmpeg -y -loglevel error -i "$OUT" -c:v libx264 -preset slow -b:v 6200k -pass 2 -c:a aac -b:a 192k -movflags +faststart "$WEB"
rm -f ffmpeg2pass-0.log ffmpeg2pass-0.log.mbtree
ls -la "$OUT" "$WEB"
