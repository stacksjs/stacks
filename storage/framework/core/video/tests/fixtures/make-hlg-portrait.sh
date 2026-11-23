#!/bin/sh
# Rebuilds hlg-portrait.mov: what an iPhone portrait upload looks like to the
# web transcoder. 3840x2160 HEVC Main10 HLG (BT.2020, arib-std-b67) at 60 fps,
# a -90 degree display matrix (portrait on screen), AAC audio, and a GPS
# `location` tag. Needs an ffmpeg with libx265.
set -eu
here=$(cd "$(dirname "$0")" && pwd)
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
ffmpeg -hide_banner -loglevel error -y \
  -f lavfi -i "testsrc2=size=3840x2160:rate=60:duration=1" \
  -f lavfi -i "sine=frequency=440:sample_rate=48000:duration=1" \
  -c:v libx265 -preset ultrafast -crf 40 -pix_fmt yuv420p10le -tag:v hvc1 \
  -x265-params "colorprim=bt2020:transfer=arib-std-b67:colormatrix=bt2020nc:log-level=error" \
  -color_primaries bt2020 -color_trc arib-std-b67 -colorspace bt2020nc \
  -c:a aac -b:a 64k "$tmp/landscape.mov"
ffmpeg -hide_banner -loglevel error -y -display_rotation:v:0 -90 -i "$tmp/landscape.mov" \
  -map 0 -c copy \
  -metadata location="+37.7749-122.4194+010.000/" \
  -metadata location-eng="+37.7749-122.4194+010.000/" \
  -movflags +use_metadata_tags "$here/hlg-portrait.mov"
