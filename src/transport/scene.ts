import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { AGENT_COUNT, BRIDGES, CameraView, createTraffic, sampleAgent, seededRandom, smooth, stepTraffic, XYZ } from './simulation';
import { getLanguage, t } from '../i18n';

export interface SceneOptions { project: boolean; paused: boolean; view: CameraView; agentsVisible: boolean; buildingsVisible: boolean }
export interface Telemetry { blend: number; occupancy: number[]; congestion: number[]; fps: number; elapsed: number; completed: number }
export interface SceneController { setOptions(options: SceneOptions): void; updateLanguage(): void; reset(): void; dispose(): void }

const C = { amber: new THREE.Color('#ffbd60'), cyan: new THREE.Color('#5ffff0'), red: new THREE.Color('#ff455b') };
const riverX = (z: number) => Math.sin(z * .048) * 4;

/** Owns the entire WebGL lifecycle; React only receives telemetry at 8 Hz. */
export function createTransportScene(host: HTMLDivElement, initial: SceneOptions, onTelemetry: (value: Telemetry) => void, onError: (message: string) => void): SceneController {
  let options = initial;
  let model = createTraffic();
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#0d141c');
  scene.fog = new THREE.FogExp2('#0d141c', .0032);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setClearColor('#0d141c');
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  host.appendChild(renderer.domElement);
  const updateCanvasDescription = () => {
    renderer.domElement.setAttribute('aria-label', t('Интерактивная 3D-карта Астаны: река Ишим, три моста и {0} транспортных агентов', [AGENT_COUNT]));
    renderer.domElement.lang = getLanguage();
  };
  updateCanvasDescription();
  renderer.domElement.setAttribute('role', 'img');
  const camera = new THREE.PerspectiveCamera(39, 1, .1, 400);
  if (initial.view === 'junction') camera.position.set(33, 31, 39);
  else camera.position.set(83, 80, 93);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = .07;
  controls.minDistance = 35;
  controls.maxDistance = 180;
  controls.maxPolarAngle = Math.PI * .44;
  controls.minPolarAngle = .2;
  controls.target.set(0, initial.view === 'junction' ? 1 : 0, initial.view === 'junction' ? -3 : 0);
  scene.add(new THREE.AmbientLight('#7798ba', 1.4));
  const key = new THREE.DirectionalLight('#aacfe0', 2.3);
  key.position.set(-30, 70, 30);
  scene.add(key);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(118, 108), new THREE.MeshStandardMaterial({ color: '#101c25', roughness: .9, metalness: .15 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -.19;
  scene.add(ground);
  const grid = new THREE.GridHelper(120, 60, '#233947', '#1a2c37');
  grid.position.y = -.16;
  scene.add(grid);

  const river = new THREE.Shape();
  for (let i = 0; i <= 80; i++) { const z = -53 + i * 106 / 80; i === 0 ? river.moveTo(riverX(z) - 5.2, z) : river.lineTo(riverX(z) - 5.2, z); }
  for (let i = 80; i >= 0; i--) { const z = -53 + i * 106 / 80; river.lineTo(riverX(z) + 5.2, z); }
  river.closePath();
  const water = new THREE.Mesh(new THREE.ShapeGeometry(river), new THREE.MeshBasicMaterial({ color: '#10343e', side: THREE.DoubleSide }));
  water.rotation.x = Math.PI / 2;
  water.position.y = -.1;
  scene.add(water);

  const lines: number[] = [], roadLines: number[] = [], waterLines: number[] = [];
  const segment = (array: number[], a: XYZ, b: XYZ) => array.push(...a, ...b);
  for (let z = -52; z < 52; z += 1) {
    for (const side of [-1, 1]) segment(waterLines, [riverX(z) + side * 5.2, 0, z], [riverX(z + 1) + side * 5.2, 0, z + 1]);
    if (z % 4 === 0) segment(waterLines, [riverX(z) - 3.8, -.03, z], [riverX(z) + 3.8, -.03, z]);
  }
  for (const x of [-38, -26, -14, 14, 26, 38]) {
    segment(roadLines, [x, .06, -43], [x, .06, 43]);
    for (const offset of [-.8, .8]) segment(lines, [x + offset, .035, -43], [x + offset, .035, 43]);
  }
  for (let z = -36; z <= 36; z += 12) {
    for (const side of [-1, 1]) {
      const edge = riverX(z) + side * 6;
      segment(roadLines, [side * 47, .06, z], [edge, .06, z]);
      for (const offset of [-.8, .8]) segment(lines, [side * 47, .035, z + offset], [edge, .035, z + offset]);
    }
  }
  function lineObject(vertices: number[], color: string, opacity = 1) {
    return new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)), new THREE.LineBasicMaterial({ color, transparent: true, opacity }));
  }
  scene.add(lineObject(lines, '#376574', .5), lineObject(roadLines, '#66a6b0', .3), lineObject(waterLines, '#34b2bd', .45));

  // One instanced building mesh + one merged edge mesh for the whole city.
  const buildings = new THREE.Group();
  const random = seededRandom(38);
  const transforms: THREE.Matrix4[] = [];
  const edgeParts: THREE.BufferGeometry[] = [];
  const box = new THREE.BoxGeometry(1, 1, 1);
  const edge = new THREE.EdgesGeometry(box);
  const dummy = new THREE.Object3D();
  for (const side of [-1, 1]) for (let col = 0; col < 3; col++) for (let row = 0; row < 6; row++) {
    const centerX = side * (20 + col * 12), centerZ = -30 + row * 12;
    for (let b = 0; b < 4; b++) {
      if (random() < .13) continue;
      const width = 2.3 + random() * 1.9, depth = 2.3 + random() * 1.7;
      const height = side === 1 ? 3 + random() * 10 : 1.5 + random() * 4.5;
      dummy.position.set(centerX + (b % 2 === 0 ? -2.9 : 2.9), height / 2, centerZ + (b < 2 ? -2.9 : 2.9));
      dummy.scale.set(width, height, depth); dummy.updateMatrix();
      transforms.push(dummy.matrix.clone());
      edgeParts.push(edge.clone().applyMatrix4(dummy.matrix));
    }
  }
  const city = new THREE.InstancedMesh(box, new THREE.MeshStandardMaterial({ color: '#2e4957', roughness: .8, metalness: .1 }), transforms.length);
  transforms.forEach((matrix, i) => city.setMatrixAt(i, matrix));
  city.instanceMatrix.needsUpdate = true;
  buildings.add(city);
  const mergedEdges = mergeGeometries(edgeParts);
  edgeParts.forEach(part => part.dispose()); edge.dispose();
  buildings.add(new THREE.LineSegments(mergedEdges, new THREE.LineBasicMaterial({ color: '#6e9ca8', transparent: true, opacity: .62 })));
  scene.add(buildings);

  // Small architectural landmark: a geometric observation tower on the administrative bank.
  const landmark = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(.65, 1.4, 9, 8), new THREE.MeshStandardMaterial({ color: '#538491', wireframe: true }));
  shaft.position.y = 4.5;
  const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(2, 1), new THREE.MeshBasicMaterial({ color: '#7bd8c7', wireframe: true, transparent: true, opacity: .6 }));
  crown.position.y = 10;
  landmark.add(shaft, crown); landmark.position.set(19, 0, 6); buildings.add(landmark);

  const bridgeMaterials: THREE.MeshBasicMaterial[] = [];
  for (const z of BRIDGES) {
    const deck = new THREE.Mesh(new THREE.BoxGeometry(18, .3, 2.2), new THREE.MeshStandardMaterial({ color: '#243d49', roughness: .65 }));
    deck.position.set(riverX(z), .13, z); scene.add(deck);
    const material = new THREE.MeshBasicMaterial({ color: z === 0 ? '#ff6670' : '#7abcc4', transparent: true, opacity: .8 });
    bridgeMaterials.push(material);
    for (const offset of [-1.15, 1.15]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(18, .08, .07), material);
      rail.position.set(riverX(z), .5, z + offset); scene.add(rail);
    }
  }

  // Procedural flyover deck, guard rails, piers and luminous construction outlines.
  const flyover = new THREE.Group();
  const deckVertices: number[] = [], deckIndices: number[] = [], railVertices: number[] = [];
  const flyPoint = (t: number, offset: number): XYZ => [-26 + 52 * t, .28 + Math.sin(Math.PI * t) ** 2 * 5.8, -6 * Math.sin(Math.PI * t) ** 2 + offset];
  for (let i = 0; i <= 80; i++) {
    const t = i / 80;
    deckVertices.push(...flyPoint(t, -1.3), ...flyPoint(t, 1.3));
    if (i < 80) {
      const n = i * 2; deckIndices.push(n, n + 1, n + 2, n + 1, n + 3, n + 2);
      for (const offset of [-1.3, 0, 1.3]) segment(railVertices, flyPoint(t, offset), flyPoint((i + 1) / 80, offset));
    }
  }
  const flyGeometry = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(deckVertices, 3));
  flyGeometry.setIndex(deckIndices); flyGeometry.computeVertexNormals();
  const flyMaterial = new THREE.MeshBasicMaterial({ color: '#29cab9', transparent: true, opacity: .16, side: THREE.DoubleSide, depthWrite: false });
  flyover.add(new THREE.Mesh(flyGeometry, flyMaterial));
  const rails = lineObject(railVertices, '#72ffdf', .95); flyover.add(rails);
  for (const t of [.2, .35, .5, .65, .8]) {
    const p = flyPoint(t, 0);
    const pier = new THREE.Mesh(new THREE.BoxGeometry(.35, p[1], 1.5), new THREE.MeshBasicMaterial({ color: '#48d8c1', wireframe: true, transparent: true, opacity: .45 }));
    pier.position.set(p[0], p[1] / 2, p[2]); flyover.add(pier);
  }
  scene.add(flyover);

  // Feeder ramps connect both peripheral bridges to the elevated central spine.
  for (const baseZ of [-24, 24]) {
    const vertices: number[] = [], indices: number[] = [], edges: number[] = [];
    const pointAt = (t: number, side: number): XYZ => [-26 + 52 * t, .28 + Math.sin(Math.PI * t) ** 2 * 5.8, baseZ + (-6 - baseZ) * Math.sin(Math.PI * t) ** 2 + side];
    for (let i = 0; i <= 80; i++) {
      vertices.push(...pointAt(i / 80, -.8), ...pointAt(i / 80, .8));
      if (i < 80) {
        const n = i * 2; indices.push(n, n + 1, n + 2, n + 1, n + 3, n + 2);
        for (const side of [-.8, .8]) segment(edges, pointAt(i / 80, side), pointAt((i + 1) / 80, side));
      }
    }
    const geometry = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices);
    flyover.add(new THREE.Mesh(geometry, flyMaterial), lineObject(edges, '#62dbc6', .55));
  }

  // GPU sprites provide a soft bloom halo without a costly fullscreen postprocessing pass.
  const TRAIL = 4, positions = new Float32Array(AGENT_COUNT * TRAIL * 3), colors = new Float32Array(positions.length);
  const sizes = new Float32Array(AGENT_COUNT * TRAIL);
  for (let i = 0; i < sizes.length; i++) sizes[i] = i % TRAIL === 0 ? 1 : .65 - (i % TRAIL) * .13;
  const particleGeometry = new THREE.BufferGeometry();
  particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
  particleGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3).setUsage(THREE.DynamicDrawUsage));
  particleGeometry.setAttribute('weight', new THREE.BufferAttribute(sizes, 1));
  const particleMaterial = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true,
    uniforms: { pixelRatio: { value: renderer.getPixelRatio() } },
    vertexShader: `attribute float weight; varying vec3 vColor; varying float vWeight; uniform float pixelRatio;
      void main(){vColor=color; vWeight=weight; vec4 mv=modelViewMatrix*vec4(position,1.); gl_Position=projectionMatrix*mv; gl_PointSize=clamp(950.0/max(1.0,-mv.z),4.0,24.0)*pixelRatio*(.65+weight*.35);}`,
    fragmentShader: `varying vec3 vColor; varying float vWeight;
      void main(){float d=length(gl_PointCoord-.5)*2.; if(d>1.)discard; float glow=exp(-d*d*5.5)*.35; float core=1.-smoothstep(.05,.28,d); gl_FragColor=vec4(vColor,(glow+core*.65)*vWeight);}`,
  });
  const particles = new THREE.Points(particleGeometry, particleMaterial); particles.frustumCulled = false; scene.add(particles);

  // Map labels are canvas-backed sprites and remain attached to world coordinates during orbit.
  const textures: THREE.Texture[] = [];
  const redrawLabels: Array<() => void> = [];
  const label = (source: string, position: XYZ, color = '#9db6c1', scale = 1, spaced = false) => {
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 96;
    const ctx = canvas.getContext('2d')!;
    const texture = new THREE.CanvasTexture(canvas); textures.push(texture);
    const redraw = () => {
      const translated = t(source).toLocaleUpperCase(getLanguage());
      const text = spaced ? Array.from(translated).join(' ') : translated;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = color; ctx.font = '500 30px sans-serif'; ctx.textAlign = 'center';
      // Longer translations fit the same world-space label without clipping.
      const fontSize = Math.min(30, 30 * 490 / Math.max(1, ctx.measureText(text).width));
      ctx.font = `500 ${fontSize}px sans-serif`;
      ctx.fillText(text, 256, 57);
      texture.needsUpdate = true;
    };
    redrawLabels.push(redraw); redraw();
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false, opacity: .85 }));
    sprite.position.set(...position); sprite.scale.set(22 * scale, 4.12 * scale, 1); scene.add(sprite);
    return sprite;
  };
  label('Сарыарка', [-29, 1, -44], '#b4c5cb', 1, true);
  label('Нура', [33, 1, 40], '#b4c5cb', 1, true);
  label('Есиль', [35, 1, -43], '#b4c5cb', 1, true);
  label('Ишим', [-1, .3, 39], '#53b7c3', .65, true);
  label('Правый берег', [-43, 1, 27], '#63828f', .68);
  label('Левый берег', [45, 1, -9], '#63828f', .68);
  const junctionLabel = label('01 / Центральный узел', [1, 9, 1], '#ff929a', .76);
  const newLabel = label('Автобусная полоса / +40% потока', [0, 10, -9], '#7affe1', .74);
  newLabel.visible = false;

  const pulse = new THREE.Mesh(new THREE.RingGeometry(4.7, 4.78, 64), new THREE.MeshBasicMaterial({ color: '#ff5968', transparent: true, opacity: .4, side: THREE.DoubleSide, depthWrite: false }));
  pulse.rotation.x = -Math.PI / 2; pulse.position.y = .15; scene.add(pulse);
  const orbitPosition = new THREE.Vector3(83, 80, 93), junctionPosition = new THREE.Vector3(33, 31, 39);
  const desiredPosition = orbitPosition.clone(), desiredTarget = new THREE.Vector3();
  let flying = false;
  controls.addEventListener('start', () => { flying = false; });
  let width = 0, height = 0;
  const resize = () => {
    width = host.clientWidth; height = host.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height, false); camera.aspect = width / height;
    camera.zoom = Math.min(1, Math.max(.65, camera.aspect / 1.15));
    camera.updateProjectionMatrix();
  };
  const observer = new ResizeObserver(resize); observer.observe(host); resize();
  let frame = 0, last = 0, lastReport = 0, frameCount = 0, fps = 60, disposed = false;
  const point: XYZ = [0, 0, 0], color = new THREE.Color();
  let lost = false;
  const contextLost = (event: Event) => { event.preventDefault(); lost = true; onError('Контекст WebGL потерян. Перезапустите 3D-сцену.'); };
  renderer.domElement.addEventListener('webglcontextlost', contextLost);
  const animate = (now: number) => {
    if (disposed) return;
    frame = requestAnimationFrame(animate);
    const dt = last ? Math.min((now - last) / 1000, .25) : 0; last = now;
    if (document.hidden || !width || !height || lost) return;
    if (!options.paused) {
      // Substeps preserve the two-second transition even when a frame takes > 50 ms.
      const steps = Math.max(1, Math.ceil(dt / .05));
      for (let i = 0; i < steps; i++) stepTraffic(model, dt / steps, options.project);
    }
    const blend = smooth(model.blend);
    buildings.visible = options.buildingsVisible; particles.visible = options.agentsVisible;
    flyover.visible = blend > .001; flyover.scale.y = Math.max(.001, blend);
    flyMaterial.opacity = .2 * blend;
    newLabel.visible = blend > .6;
    junctionLabel.visible = blend < .5;
    bridgeMaterials[1].color.copy(C.red).lerp(C.cyan, blend);
    pulse.visible = blend < .98;
    pulse.scale.setScalar(1 + Math.sin(model.elapsed * 2) * .09);
    (pulse.material as THREE.MeshBasicMaterial).opacity = .4 * (1 - blend);
    for (const agent of model.agents) {
      sampleAgent(agent, agent.progress, blend, point);
      const queue = Math.abs(point[0]) < 18 ? model.congestion[agent.bridge] : 0;
      color.copy(agent.transit ? C.cyan : C.amber);
      if (agent.converts) color.lerp(C.cyan, blend);
      if (!agent.transit) color.lerp(C.red, queue);
      for (let trail = 0; trail < TRAIL; trail++) {
        const index = (agent.id * TRAIL + trail) * 3;
        sampleAgent(agent, agent.progress - trail * .27 / agent.length, blend, point);
        positions[index] = point[0]; positions[index + 1] = point[1]; positions[index + 2] = point[2];
        colors[index] = color.r; colors[index + 1] = color.g; colors[index + 2] = color.b;
      }
    }
    particleGeometry.attributes.position.needsUpdate = true; particleGeometry.attributes.color.needsUpdate = true;
    if (flying) {
      const alpha = 1 - Math.exp(-dt * 4);
      camera.position.lerp(desiredPosition, alpha); controls.target.lerp(desiredTarget, alpha);
      if (camera.position.distanceTo(desiredPosition) < .05) flying = false;
    }
    controls.update(); renderer.render(scene, camera); frameCount++;
    if (now - lastReport > 125) {
      fps = fps * .6 + Math.min(144, frameCount * 1000 / Math.max(1, now - lastReport)) * .4;
      onTelemetry({ blend, occupancy: [...model.occupancy], congestion: [...model.congestion], fps: Math.round(fps), elapsed: model.elapsed, completed: model.completed });
      lastReport = now; frameCount = 0;
    }
  };
  frame = requestAnimationFrame(animate);
  return {
    updateLanguage() {
      if (disposed) return;
      updateCanvasDescription();
      redrawLabels.forEach(redraw => redraw());
    },
    setOptions(next) {
      if (next.view !== options.view) { desiredPosition.copy(next.view === 'orbit' ? orbitPosition : junctionPosition); desiredTarget.set(0, next.view === 'orbit' ? 0 : 1, next.view === 'orbit' ? 0 : -3); flying = true; }
      options = next;
    },
    reset() { model = createTraffic(); desiredPosition.copy(orbitPosition); desiredTarget.set(0, 0, 0); flying = true; },
    dispose() {
      disposed = true; cancelAnimationFrame(frame); observer.disconnect(); controls.dispose();
      renderer.domElement.removeEventListener('webglcontextlost', contextLost);
      const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
      scene.traverse(object => {
        const mesh = object as THREE.Mesh;
        if (mesh.geometry) geometries.add(mesh.geometry);
        if (mesh.material) (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach(material => materials.add(material));
        if (object instanceof THREE.InstancedMesh) object.dispose();
      });
      geometries.forEach(geometry => geometry.dispose()); materials.forEach(material => material.dispose()); textures.forEach(texture => texture.dispose());
      renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove();
    },
  };
}
