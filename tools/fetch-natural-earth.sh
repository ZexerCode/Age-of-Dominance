#!/usr/bin/env bash
# Natural Earth (public domain) kaynak verilerini indirir.
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)/.cache/ne"
mkdir -p "$DIR"
BASE="https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson"
for f in ne_10m_admin_1_states_provinces ne_10m_admin_0_countries ne_10m_populated_places_simple ne_10m_geography_regions_polys; do
  if [ ! -s "$DIR/$f.geojson" ]; then
    echo "indiriliyor: $f"
    curl -sSL -o "$DIR/$f.geojson" "$BASE/$f.geojson"
  fi
done
echo "tamam: $DIR"
