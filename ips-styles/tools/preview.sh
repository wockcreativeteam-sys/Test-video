#!/bin/sh
# preview.sh <film dir> : 12 fps, 540x960 preview with the mix -> <film>/out/preview.mp4
set -e
F=$(cd "$1" && pwd); LIB=/home/user/lemomo-ai/lemo-opuscar; cd $LIB
node core/render/video.mjs "$F" --size 1080x1920 --fps 12 --workers 3 --q 'preview=1' --out "$F/out/prev_raw.mp4"
[ -f "$F/out/mix.wav" ] || .venv/bin/python /home/user/Test-video/ips-styles/tools/score.py "$F"
ffmpeg -y -loglevel error -i "$F/out/prev_raw.mp4" -i "$F/out/mix.wav" -vf scale=540:960 -c:v libx264 -crf 24 -c:a aac -b:a 160k -shortest "$F/out/preview.mp4"
echo "done $F/out/preview.mp4"
