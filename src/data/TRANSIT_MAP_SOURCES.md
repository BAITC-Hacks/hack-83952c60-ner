# Astana transit map

The map is a bundled geographic snapshot, styled in midnight navy and gold to
match the supplied reference. It works without a map service key or runtime tile
requests. It is separate from the simulator's schematic district boundaries.

## Data and attribution

- Streets, river centerlines, named bus-stop coordinates and LRT track/station
  coordinates: [OpenStreetMap](https://www.openstreetmap.org/), downloaded
  **2026-09-23** through the public OSM API.
- LRT track geometry: [relation 19988457](https://www.openstreetmap.org/relation/19988457),
  including its member ways and 18 station nodes.
- Official route description (airport, Qabanbay Batyr, Syganak, Arys bridge,
  Shamshi Kaldayakov, Nurly Zhol):
  [Astana government](https://www.gov.kz/memleket/entities/astana-upr/press/news/details/1194587?lang=ru).
- Official confirmation of 18 stations and a 22.4 km route:
  [Astana Maslikhat, July 2026](https://www.gov.kz/memleket/entities/astana-maslihat/press/news/details/1259294?lang=ru).
- Station names and 101–118 numbering: CTS station diagram reproduced by
  [Kazinform, 15 May 2026](https://www.inform.kz/amp/opublikovana-shema-stantsiy-lrt-v-astane-aab321b1).
  Several OSM `ref` tags were outdated, so the builder specifies the official order.

Geographic data is © OpenStreetMap contributors and available under the
[Open Database License (ODbL)](https://www.openstreetmap.org/copyright).
`transitMap.json` contains a transformed extract of that data; retain this notice
and the displayed attribution when redistributing it. Projection and coordinate
rounding are performed by `scripts/build-transit-map.mjs`.

The bus layer includes named OSM bus stops in the downloaded central-city and
LRT-corridor sections. It is not a complete city transit directory. Opposite-side
platforms retain separate markers. Station and stop names have Russian, Kazakh
and English display forms; English proper names are transliterated where needed.
The snapshot contains locations, not live arrivals, timetables or service status.

## Updating

From the repository root, with Node 22 or later:

```sh
node scripts/build-transit-map.mjs --download --date=YYYY-MM-DD
```

This downloads 11 small geographic sections plus the complete LRT relation,
in sequence, into the ignored `.tmp` directory. The builder removes contributor
metadata, clips paths to the map extent, groups streets by road class, and writes
`src/data/transitMap.json`. It deliberately fails if a named bus stop has no entry
in `transitStopNames.json`; add its three display names, then rerun without
`--download` to use the cached source data. Update the snapshot date above.

The local equirectangular projection preserves relative ground scale around
Astana, with north at the top. River lines are stylized centerlines, not surveyed
bank outlines. The generated paths remain clipped at the edges while zooming.
