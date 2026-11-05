#!/usr/bin/env bash
# Offline, silent promo assets. Uses repository artwork only; never reads hooks or user sessions.
set -euo pipefail
cd "$(dirname "$0")/.."
command -v swiftc >/dev/null
command -v ffmpeg >/dev/null
mkdir -p promo-output
mkdir -p site/assets
promo_tmp="$(mktemp -d)"
trap 'rm -rf "$promo_tmp"' EXIT
swiftc -O -module-cache-path "$promo_tmp/module-cache" tools/render_promo.swift -o "$promo_tmp/render"
"$promo_tmp/render" office png site/assets/office-hero-v1.png
"$promo_tmp/render" avatar png site/assets/tian-portrait-v1.png
"$promo_tmp/render" office raw - 20 | ffmpeg -hide_banner -loglevel error -y -f rawvideo -pixel_format rgba -video_size 1448x1086 -framerate 20 -i pipe:0 -an -c:v libx264 -preset fast -crf 20 -pix_fmt yuv420p -movflags +faststart site/assets/office-loop-v1.mp4
"$promo_tmp/render" landscape-zh png promo-output/hero-1920x1080.png
"$promo_tmp/render" portrait png promo-output/xiaohongshu-cover-1080x1920.png
"$promo_tmp/render" landscape-en png promo-output/x-cover-1920x1080.png
"$promo_tmp/render" landscape-en raw - 20 | ffmpeg -hide_banner -loglevel error -y -f rawvideo -pixel_format rgba -video_size 1920x1080 -framerate 20 -i pipe:0 -an -c:v libx264 -preset fast -crf 20 -pix_fmt yuv420p -movflags +faststart promo-output/x-promo-1920x1080.mp4
"$promo_tmp/render" portrait raw - 20 | ffmpeg -hide_banner -loglevel error -y -f rawvideo -pixel_format rgba -video_size 1080x1920 -framerate 20 -i pipe:0 -an -c:v libx264 -preset fast -crf 20 -pix_fmt yuv420p -movflags +faststart promo-output/xiaohongshu-promo-1080x1920.mp4
ffmpeg -hide_banner -loglevel error -y -i promo-output/x-promo-1920x1080.mp4 -filter_complex 'fps=10,scale=960:540:flags=lanczos,split[a][b];[a]palettegen=max_colors=128:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle' -loop 0 promo-output/x-promo-960x540.gif
echo '宣传素材已生成：promo-output/（演示画面，无配乐）'
