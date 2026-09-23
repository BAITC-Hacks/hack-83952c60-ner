// Rebuild the bundled OSM snapshot; see src/data/TRANSIT_MAP_SOURCES.md.
import fs from 'node:fs';
import path from 'node:path';

const cache = '.tmp';
const tiles = [
  '71.40,51.115,71.45,51.14', '71.45,51.115,71.50,51.14',
  '71.50,51.10,71.55,51.14', '71.40,51.14,71.45,51.165',
  '71.45,51.14,71.50,51.165', '71.38,51.085,71.43,51.115',
  '71.38,51.055,71.44,51.085', '71.41,51.025,71.48,51.055',
  '71.35,51.115,71.40,51.14', '71.35,51.14,71.40,51.165',
  '71.43,51.085,71.49,51.115',
];
const api = 'https://api.openstreetmap.org/api/0.6';
const inputs = [
  ['astana-lrt.json', `${api}/relation/19988457/full.json`],
  ...tiles.map((bbox, i) => [`astana-tile-${i}.json`, `${api}/map.json?bbox=${bbox}`]),
];
fs.mkdirSync(cache, { recursive: true });
if (process.argv.includes('--download')) {
  for (const [file, url] of inputs) {
    const response = await fetch(url, { signal: AbortSignal.timeout(60000) });
    if (!response.ok) throw new Error(`${url}: ${response.status}`);
    const data = await response.json();
    if (!Array.isArray(data.elements)) throw new Error(`Invalid OSM response: ${url}`);
    fs.writeFileSync(path.join(cache, file), JSON.stringify(data));
    console.log(`Downloaded ${file}`);
  }
}

// Local equirectangular projection: north up, equal longitude/latitude ground scale.
const bounds = { west: 71.34, south: 51.02, east: 71.575, north: 51.167 };
const width = 800;
const scale = width / ((bounds.east - bounds.west) * Math.cos((bounds.south + bounds.north) * Math.PI / 360));
const height = Math.round((bounds.north - bounds.south) * scale);
const project = node => [
  (node.lon - bounds.west) / (bounds.east - bounds.west) * width,
  (bounds.north - node.lat) * scale,
];
const inside = node => node.lon >= bounds.west && node.lon <= bounds.east && node.lat >= bounds.south && node.lat <= bounds.north;
const elements = new Map();
for (const [file] of inputs) {
  const data = JSON.parse(fs.readFileSync(path.join(cache, file), 'utf8'));
  for (const element of data.elements) elements.set(`${element.type}/${element.id}`, element);
}
const nodes = new Map([...elements.values()].filter(e => e.type === 'node').map(e => [e.id, e]));
const round = n => Math.round(n * 10) / 10;

// Clip paths before bundling; no remote tiles or full OSM metadata reach the browser.
function clipSegment(a, b) {
  let start = 0, end = 1;
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const p = [-dx, dx, -dy, dy];
  const q = [a[0], width - a[0], a[1], height - a[1]];
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) { if (q[i] < 0) return null; }
    else {
      const t = q[i] / p[i];
      if (p[i] < 0) start = Math.max(start, t);
      else end = Math.min(end, t);
      if (start > end) return null;
    }
  }
  return [[a[0] + start * dx, a[1] + start * dy], [a[0] + end * dx, a[1] + end * dy]];
}
function wayPath(way) {
  let previous = null, endpoint = '', result = '';
  for (const id of way.nodes || []) {
    const node = nodes.get(id);
    if (!node) { previous = null; endpoint = ''; continue; }
    const point = project(node);
    if (previous) {
      const segment = clipSegment(previous, point);
      if (segment) {
        const from = segment[0].map(round).join(',');
        const to = segment[1].map(round).join(',');
        if (from !== to) {
          result += `${endpoint === from ? '' : `M${from}`}L${to}`;
          endpoint = to;
        }
      } else endpoint = '';
    }
    previous = point;
  }
  return result;
}
const roadKinds = ['residential', 'unclassified', 'living_street', 'tertiary_link', 'tertiary', 'secondary_link', 'secondary', 'primary_link', 'primary', 'trunk_link', 'trunk', 'motorway_link', 'motorway'];
const roadsByKind = new Map(roadKinds.map(kind => [kind, []]));
const rivers = [];
let roadCount = 0;
for (const element of elements.values()) {
  if (element.type !== 'way') continue;
  const kind = element.tags?.highway;
  if (roadsByKind.has(kind)) {
    const geometry = wayPath(element);
    if (geometry) { roadsByKind.get(kind).push(geometry); roadCount++; }
  } else if (element.tags?.waterway === 'river') {
    const geometry = wayPath(element);
    if (geometry) rivers.push(geometry);
  }
}

// Official 101–118 numbering overrides a few outdated refs in the OSM snapshot.
const stationNames = [
  [13609021254, 'Әуежай', 'Аэропорт', 'Airport'],
  [13609021226, 'Атамекен', 'Атамекен', 'Atameken'],
  [13609020686, 'Есіл', 'Есиль', 'Yesil'],
  [13081694252, 'Мәңгілік Ел', 'Мангилик Ел', 'Mangilik El'],
  [13081694253, 'Астана жұлдызы', 'Астана жулдызы', 'Astana Zhuldyzy'],
  [13609226009, 'Нұра', 'Нура', 'Nura'],
  [13081694255, 'Университет', 'Университет', 'University'],
  [13081694256, 'Ұлы Дала', 'Улы Дала', 'Uly Dala'],
  [13081694257, 'Астана Арена', 'Астана Арена', 'Astana Arena'],
  [13081694258, 'Жекпе-жек сарайы', 'Дворец единоборств', 'Martial Arts Palace'],
  [13081694259, 'Сығанақ', 'Сыганак', 'Syganak'],
  [13081694260, 'Бәйтерек', 'Байтерек', 'Baiterek'],
  [13081694261, 'Министрліктер үйі', 'Дом министерств', 'House of Ministries'],
  [13081694262, 'Ұлттық музей', 'Национальный музей', 'National Museum'],
  [13081694263, 'Театр', 'Театр', 'Theatre'],
  [13081694264, 'Мыңжылдық аллеясы', 'Аллея Мынжылдык', 'Myngzhyldyk Alley'],
  [13081694265, 'Жібек жолы', 'Жибек жолы', 'Zhibek Zholy'],
  [13081694266, 'Нұрлы жол', 'Нурлы жол', 'Nurly Zhol'],
];
const lrtStations = stationNames.map(([id, kk, ru, en], i) => {
  const node = nodes.get(id);
  if (!node || !inside(node)) throw new Error(`Missing or out-of-bounds LRT station ${id}`);
  const [x, y] = project(node).map(round);
  return { id: String(id), ref: String(101 + i), x, y, names: { ru, kk, en } };
});
const relation = elements.get('relation/19988457');
const lrtPaths = relation.members.filter(m => m.type === 'way').map(m => {
  const way = elements.get(`way/${m.ref}`);
  if (!way) throw new Error(`Missing LRT way ${m.ref}`);
  return wayPath(way);
}).filter(Boolean);

const translations = JSON.parse(fs.readFileSync('src/data/transitStopNames.json', 'utf8'));
const busStops = [...nodes.values()].filter(node => node.tags?.highway === 'bus_stop' && inside(node)).flatMap(node => {
  const tags = node.tags;
  const source = tags.name || tags['name:ru'] || tags['name:kk'];
  if (!source) return [];
  const names = translations[source];
  if (!names) throw new Error(`Missing bus stop translation: ${source}`);
  const [x, y] = project(node).map(round);
  return [{ id: String(node.id), x, y, names }];
}).sort((a, b) => Number(a.id) - Number(b.id));
const dateArg = process.argv.find(arg => arg.startsWith('--date='));
const updatedAt = dateArg?.slice(7) || new Date().toISOString().slice(0, 10);
const data = {
  width, height, bounds, updatedAt, roadCount,
  roads: [...roadsByKind].filter(([, paths]) => paths.length).map(([kind, paths]) => ({ kind, path: paths.join('') })),
  rivers, lrtPaths, lrtStations, busStops,
};
if (!busStops.length || !roadCount || lrtStations.length !== 18 || !lrtPaths.length) throw new Error('Incomplete transit snapshot');
fs.writeFileSync('src/data/transitMap.json', JSON.stringify(data) + '\n');
console.log(`${roadCount} roads, ${rivers.length} river sections, ${busStops.length} bus stops, ${lrtStations.length} LRT stations`);
