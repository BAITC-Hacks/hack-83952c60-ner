import { readFile, writeFile } from 'node:fs/promises';

// Run with --from-file after a manual download, or fetch a new public OSM snapshot.
const query = '[out:json][timeout:90];nwr["amenity"~"^(school|kindergarten|university|college|hospital|clinic|doctors)$"](50.98,71.18,51.32,71.72);out center tags;';
let raw;
if (process.argv.includes('--from-file')) {
  raw = JSON.parse(await readFile(new URL('../public/data/astana-osm-raw.json', import.meta.url), 'utf8'));
} else {
  const response = await fetch('https://overpass.kumi.systems/api/interpreter?data=' + encodeURIComponent(query), { signal: AbortSignal.timeout(120000) });
  if (!response.ok) throw new Error(`Overpass HTTP ${response.status}`);
  raw = await response.json();
}
if (raw.remark || !Array.isArray(raw.elements) || !raw.elements.length) throw new Error(raw.remark || 'Empty OSM response; keeping previous snapshot.');
const features = raw.elements.flatMap(element => {
  const lon = element.lon ?? element.center?.lon, lat = element.lat ?? element.center?.lat;
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return [];
  const tags = element.tags ?? {};
  return [{ type: 'Feature', id: `${element.type}/${element.id}`, geometry: { type: 'Point', coordinates: [lon, lat] }, properties: {
    ...tags, category: ['hospital', 'clinic', 'doctors'].includes(tags.amenity) ? 'health' : 'education',
    osmId: `${element.type}/${element.id}`, locationMethod: element.center ? 'OSM bounding-box center' : 'OSM node',
  } }];
});
const data = { type: 'FeatureCollection', metadata: {
  source: 'OpenStreetMap contributors / Overpass', fetchedAt: new Date().toISOString(), osmTimestamp: raw.osm3s?.timestamp_osm_base ?? '',
  bbox: [71.18, 50.98, 71.72, 51.32], description: 'Mapped education and health amenities in the Astana study rectangle. Not an exhaustive register. Polygon amenities are represented by bounding-box centers. ODbL 1.0.',
}, features };
await writeFile(new URL('../public/data/astana-infrastructure.geojson', import.meta.url), JSON.stringify(data));
console.log(`Saved ${features.length} OSM objects, source timestamp: ${data.metadata.osmTimestamp}`);
