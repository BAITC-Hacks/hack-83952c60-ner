/** Run: npx tsx scripts/population-example.ts (no key/network needed). */
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createCitizenVoiceService } from '../server/citizenVoices';
import { createPopulationSnapshot } from '../src/population/simulation';
import { createSeededRandom } from '../src/population/data';
import type { AkimDecision } from '../src/population/types';

const snapshot = createPopulationSnapshot({ hour: 8, seed: 42 });
const decision: AkimDecision = {
  id: 'nura-schools-001', topic: 'schools', districtIds: ['nura'],
  summary: 'Добавить школьные места в Нуре, чтобы сократить поездки семей в другие районы.',
  effect: 'improve',
};
// Explicit blank key means deterministic local examples, even if a key is configured in the environment.
const voices = createCitizenVoiceService({ apiKey: '', random: createSeededRandom(7) });
const thoughts = await voices.generateVoiceOfCitizens('nura', decision);
const output = {
  population: snapshot.population, visualParticles: snapshot.visualParticles,
  hour: snapshot.hour, trafficLoad: snapshot.trafficLoad, pulse: snapshot.pulse, thoughts,
};
const directory = new URL('../docs/examples/', import.meta.url);
await mkdir(directory, { recursive: true });
const files = {
  'population-input.json': { decision, selectedDistrict: 'nura', mode: 'focus' },
  'population-output.json': output,
  'population-districts.json': snapshot.districts,
  'population-focus-group.json': snapshot.focusGroup,
  'population-agents.json': snapshot.agents,
  'population-migration.json': snapshot.flows,
};
await Promise.all(Object.entries(files).map(([name, data]) => writeFile(new URL(name, directory), `${JSON.stringify(data, null, 2)}\n`, 'utf8')));
console.log(JSON.stringify({ directory: fileURLToPath(directory), ...output }, null, 2));
