#!/usr/bin/env bash
# Render the da Vinci Xi teaser: sound, then 6 picture chunks on a worker pool (Chromium on Xvfb,
# ANGLE -> Mesa llvmpipe), then mux.
#   tools/dv/render_all.sh                # everything
#   CHUNKS="2 3" tools/dv/render_all.sh   # re-render some chunks, then re-mux
#   SKIP_AUDIO=1 ...                      # keep dv/audio/mix.wav
set -euo pipefail
cd "$(dirname "$0")/../.."
OUT="${OUT:-out/dv/wockhardt_da_vinci_x_teaser_1080p_master.mp4}"
WORKERS="${WORKERS:-3}"
TMP="${CHUNK_DIR:-out/dv/chunks}"
export TMP
NCH=6
PER=150 # 6 x 150 = 900 frames = 30 s @ 30 fps
mkdir -p "$TMP" "$(dirname "$OUT")"

if [ -z "${SKIP_AUDIO:-}" ]; then
  node tools/dv/export_cues.mjs
  python3 -I dv/audio/sound.py dv/audio/cues.json dv/audio/ > "$TMP/audio_log.txt"
fi

CH="${CHUNKS:-$(seq -s ' ' 0 $((NCH - 1)))}"
for c in $CH; do
  a=$(python3 -c "print(f'{$c * $PER / 30:.4f}')")
  b=$(python3 -c "print(f'{($c + 1) * $PER / 30:.4f}')")
  echo "$c $a $b"
done | xargs -r -P "$WORKERS" -L 1 sh -c 'GL=llvm LP_NUM_THREADS=2 xvfb-run -a -s "-screen 0 1920x1080x24" node tools/dv/render.mjs video --from "$1" --to "$2" --out "$TMP/chunk_$0.mkv" --crf 12 --preset fast > "$TMP/log_$0.txt" 2>&1 && echo "chunk $0 done" || echo "chunk $0 FAILED"'

for c in $(seq 0 $((NCH - 1))); do
  [ -s "$TMP/chunk_$c.mkv" ] || { echo "missing chunk $c"; exit 1; }
done
for c in $(seq 0 $((NCH - 1))); do echo "file '$(pwd)/$TMP/chunk_$c.mkv'"; done > "$TMP/list.txt"
ffmpeg -y -loglevel error -f concat -safe 0 -i "$TMP/list.txt" -i dv/audio/mix.wav \
  -map 0:v -map 1:a -c:v libx264 -preset slow -crf 15 -tune grain -profile:v high -pix_fmt yuv420p \
  -c:a aac -b:a 256k -shortest -movflags +faststart "$OUT"
# web version (two-pass, ~14 Mb/s) — the deliverable that lives in the repo
WEB="${OUT%_master.mp4}.mp4"
ffmpeg -y -loglevel error -i "$OUT" -c:v libx264 -preset slow -b:v 14000k -pass 1 -passlogfile "$TMP/2pass" -an -f mp4 /dev/null
ffmpeg -y -loglevel error -i "$OUT" -c:v libx264 -preset slow -b:v 14000k -pass 2 -passlogfile "$TMP/2pass" -c:a aac -b:a 256k -movflags +faststart "$WEB"
ffprobe -v error -show_entries format=duration,size:stream=codec_name,width,height,r_frame_rate -of compact "$WEB"
ls -la "$OUT" "$WEB"
echo RENDER_ALL_DONE
