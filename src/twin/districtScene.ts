import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { DistrictId } from '../engine/types';
import { DISTRICT_SHAPES, MapDistrict, trafficProfile } from './mapData';

export interface SceneSettings { motion: boolean; agents: boolean; hexagons: boolean; bloom: boolean }
export interface DistrictScene {
  update(data: MapDistrict[], selected: DistrictId, hovered: DistrictId | null, settings: SceneSettings): void;
  dispose(): void;
}
const world = (p: readonly number[]) => new THREE.Vector2((p[0] - 325) / 8, (p[1] - 220) / 8);
function inside(x: number, y: number, points: THREE.Vector2[]) {
  let hit = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i], b = points[j];
    if ((a.y > y) !== (b.y > y) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) hit = !hit;
  }
  return hit;
}
const materialLine = (color: string, opacity = 1) => new THREE.LineBasicMaterial({ color, transparent: true, opacity, toneMapped: false });
function segments(values: number[], material: THREE.LineBasicMaterial) {
  return new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(values, 3)), material);
}
function random(seed: number) { const n = Math.sin(seed * 127.1 + 311.7) * 43758.5453; return n - Math.floor(n); }

export function createDistrictScene(host: HTMLDivElement, initial: MapDistrict[], initialSettings: SceneSettings,
  onHover: (id: DistrictId | null) => void, onSelect: (id: DistrictId) => void,
  onProject: (id: DistrictId, x: number, y: number) => void, onError: () => void): DistrictScene {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
  renderer.setClearColor('#05080c');
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  host.appendChild(renderer.domElement);
  renderer.domElement.setAttribute('aria-hidden', 'true');
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#05080c');
  scene.fog = new THREE.FogExp2('#05080c', .003);
  const camera = new THREE.OrthographicCamera(-65, 65, 40, -40, .1, 500);
  camera.position.set(54, 105, 90);
  camera.lookAt(0, 0, 0);
  scene.add(new THREE.HemisphereLight('#b1deff', '#09141a', 2.5));
  const light = new THREE.DirectionalLight('#bce9ff', 3.8);
  light.position.set(-25, 55, -25); scene.add(light);
  const rim = new THREE.DirectionalLight('#1868ff', 2.5);
  rim.position.set(25, 12, 30); scene.add(rim);
  const grid = new THREE.GridHelper(600, 200, '#183a4b', '#102732');
  (grid.material as THREE.LineBasicMaterial).transparent = true;
  (grid.material as THREE.LineBasicMaterial).opacity = .38;
  grid.position.y = -2.8; scene.add(grid);
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloomPass = new UnrealBloomPass(new THREE.Vector2(1, 1), .85, .55, .65);
  composer.addPass(bloomPass);
  const outputPass = new OutputPass(); composer.addPass(outputPass);

  let data = initial, settings = initialSettings, selected: DistrictId = 'nura', hovered: DistrictId | null = null;
  let visible = true, width = 1, height = 1, disposed = false, raf = 0, elapsed = 0, previous = 0, dirty = true;
  const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2();
  const picking: THREE.Object3D[] = [];
  const modules = DISTRICT_SHAPES.map((district, index) => {
    const metric = data.find(d => d.id === district.id)!;
    const color = metric.color;
    const group = new THREE.Group(); scene.add(group);
    const points = district.points.map(world), shape = new THREE.Shape(points);
    const depth = 2.3 + (index % 3) * .28;
    const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: .23, bevelThickness: .2 });
    geometry.rotateX(Math.PI / 2); geometry.translate(0, depth, 0);
    const glass = new THREE.MeshPhysicalMaterial({ color: '#17323d', metalness: .35, roughness: .12, clearcoat: 1,
      clearcoatRoughness: .08, transparent: true, opacity: .68, emissive: color, emissiveIntensity: .055, side: THREE.DoubleSide, depthWrite: false });
    const mesh = new THREE.Mesh(geometry, glass); mesh.userData.district = district.id;
    group.add(mesh); picking.push(mesh);
    const edgeMaterial = materialLine(color, .88);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geometry, 22), edgeMaterial); group.add(edges);
    const baseGeo = new THREE.ExtrudeGeometry(shape, { depth: .7, bevelEnabled: false });
    baseGeo.rotateX(Math.PI / 2); baseGeo.translate(0, -1.6, 0);
    group.add(new THREE.Mesh(baseGeo, new THREE.MeshStandardMaterial({ color: '#101c25', metalness: .65, roughness: .35, emissiveIntensity: .035 })));
    const baseEdges = new THREE.LineSegments(new THREE.EdgesGeometry(baseGeo), materialLine(color, .23)); group.add(baseEdges);
    const roads: number[] = [], hex: number[] = [], buildings: THREE.BufferGeometry[] = [];
    const minX = Math.min(...points.map(p => p.x)), maxX = Math.max(...points.map(p => p.x));
    const minZ = Math.min(...points.map(p => p.y)), maxZ = Math.max(...points.map(p => p.y));
    let seed = index * 1000;
    // Short sampled segments are clipped to each original polygon, including the concave Yesil district.
    for (let x = Math.ceil(minX); x <= maxX; x += 1.8) for (let z = Math.ceil(minZ); z <= maxZ; z += 1.8) {
      if (!inside(x, z, points)) continue;
      if (inside(x + 1.8, z, points)) roads.push(x, depth + .26, z, x + 1.8, depth + .26, z);
      if (inside(x, z + 1.8, points)) roads.push(x, depth + .26, z, x, depth + .26, z + 1.8);
      if (random(seed++) > .24 && inside(x + 1.2, z + 1.2, points)) {
        const h = .3 + random(seed++) ** 3 * 3.8;
        const box = new THREE.BoxGeometry(.55 + random(seed++) * .5, h, .55 + random(seed++) * .5);
        box.translate(x + .65, depth + h / 2 + .12, z + .65); buildings.push(box);
      }
    }
    const buildingGeometry = mergeGeometries(buildings);
    buildings.forEach(g => g.dispose());
    if (buildingGeometry) {
      group.add(new THREE.Mesh(buildingGeometry, new THREE.MeshStandardMaterial({ color: '#152830', roughness: .25, metalness: .7, emissive: color, emissiveIntensity: .075 })));
      group.add(new THREE.LineSegments(new THREE.EdgesGeometry(buildingGeometry), materialLine(color, .32)));
    }
    const roadMaterial = materialLine(color, .35); group.add(segments(roads, roadMaterial));
    const innerRoads = segments(roads, materialLine(color, .2)); innerRoads.position.y = -1.7; group.add(innerRoads);
    for (let z = minZ; z < maxZ; z += 1.3) for (let x = minX; x < maxX; x += 1.5) {
      const cx = x + (Math.round((z - minZ) / 1.3) % 2) * .75;
      for (let n = 0; n < 6; n++) {
        const a = new THREE.Vector2(cx + .83 * Math.cos(n * Math.PI / 3), z + .83 * Math.sin(n * Math.PI / 3));
        const b = new THREE.Vector2(cx + .83 * Math.cos((n + 1) * Math.PI / 3), z + .83 * Math.sin((n + 1) * Math.PI / 3));
        if (inside(a.x, a.y, points) && inside(b.x, b.y, points)) hex.push(a.x, depth + .3, a.y, b.x, depth + .3, b.y);
      }
    }
    const hexMaterial = materialLine(color, 0); group.add(segments(hex, hexMaterial));
    // Traffic follows district borders in the spaces between glass modules.
    const path = points.map(p => new THREE.Vector3(p.x, .15, p.y)); path.push(path[0].clone());
    const route = new THREE.CurvePath<THREE.Vector3>();
    for (let i = 1; i < path.length; i++) route.add(new THREE.LineCurve3(path[i - 1], path[i]));
    const positions = new Float32Array(224 * 3), colors = new Float32Array(224 * 3);
    for (let i = 0; i < 224; i++) new THREE.Color(i % 7 === 0 ? '#65ffe1' : '#ff9d4b').multiplyScalar(2.4).toArray(colors, i * 3);
    const agentGeometry = new THREE.BufferGeometry();
    agentGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    agentGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const agents = new THREE.Points(agentGeometry, new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, vertexColors: true, blending: THREE.AdditiveBlending,
      vertexShader: 'varying vec3 vColor; void main(){ vColor=color; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); gl_PointSize=4.5; }',
      fragmentShader: 'varying vec3 vColor; void main(){ float d=length(gl_PointCoord-.5); if(d>.5)discard; gl_FragColor=vec4(vColor,pow(1.-d*2.,1.2)); }',
    })); scene.add(agents);
    const routeLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(path), materialLine('#9ba9aa', .24)); scene.add(routeLine);
    return { id: district.id, group, glass, edgeMaterial, roadMaterial, hexMaterial, route, agentGeometry, agents, positions,
      anchor: new THREE.Vector3(world(district.anchor).x, depth + 2, world(district.anchor).y), profile: trafficProfile(metric.load) };
  });

  // The canyon follows the same separation as the original river, below the glass skyline.
  const riverCurve = new THREE.CatmullRomCurve3([[0,168],[80,179],[130,192],[194,212],[289,163],[370,201],[435,215],[515,252],[650,277]].map(p => {
    const v = world(p); return new THREE.Vector3(v.x, -.7, v.y);
  }));
  const riverMaterial = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { time: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: 'uniform float time; varying vec2 vUv; void main(){float flow=pow(.5+.5*sin(vUv.x*240.-time*2.+sin(vUv.y*20.)),9.);vec3 c=mix(vec3(.015,.06,.19),vec3(.05,.55,1.5),flow*.75+.15);gl_FragColor=vec4(c,.92);}',
  });
  scene.add(new THREE.Mesh(new THREE.TubeGeometry(riverCurve, 180, .6, 8, false), riverMaterial));
  const riverGlow = new THREE.Mesh(new THREE.TubeGeometry(riverCurve, 120, 1.05, 6, false), new THREE.MeshBasicMaterial({ color: '#0757f0', transparent: true, opacity: .13, depthWrite: false, blending: THREE.AdditiveBlending })); scene.add(riverGlow);
  const ripplePositions = new Float32Array(110 * 3);
  const rippleGeo = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(ripplePositions, 3));
  const ripples = new THREE.Points(rippleGeo, new THREE.PointsMaterial({ color: '#3abaff', size: .16, transparent: true, opacity: .8, blending: THREE.AdditiveBlending })); scene.add(ripples);
  const riverPoint = new THREE.Vector3(), agentPoint = new THREE.Vector3(), projected = new THREE.Vector3();
  const resize = () => {
    dirty = true;
    width = Math.max(1, host.clientWidth); height = Math.max(1, host.clientHeight);
    const aspect = width / height, extent = Math.max(window.innerWidth > 540 && window.innerWidth <= 1100 ? 54 : 37, 47 / aspect);
    camera.left = -extent * aspect; camera.right = extent * aspect; camera.top = extent; camera.bottom = -extent;
    camera.updateProjectionMatrix(); renderer.setSize(width, height); composer.setSize(width, height);
  };
  const observer = new ResizeObserver(resize); observer.observe(host); resize();
  const visibility = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; }); visibility.observe(host);
  const pick = (event: PointerEvent) => {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    return raycaster.intersectObjects(picking, false)[0]?.object.userData.district as DistrictId | undefined;
  };
  const move = (event: PointerEvent) => { const id = pick(event) ?? null; if (id !== hovered) onHover(id); renderer.domElement.style.cursor = id ? 'pointer' : 'default'; };
  const leave = () => onHover(null);
  const click = (event: PointerEvent) => { const id = pick(event); if (id) onSelect(id); };
  const lost = (event: Event) => { event.preventDefault(); onError(); };
  renderer.domElement.addEventListener('pointermove', move);
  renderer.domElement.addEventListener('pointerleave', leave);
  renderer.domElement.addEventListener('pointerup', click);
  renderer.domElement.addEventListener('webglcontextlost', lost);
  const frame = (time: number) => {
    if (disposed) return;
    raf = requestAnimationFrame(frame);
    if (time - previous < 32) return;
    const dt = Math.min((time - previous) / 1000, .05); previous = time;
    if (!visible || document.hidden) return;
    if (!settings.motion && !dirty) return;
    dirty = false;
    if (settings.motion) elapsed += dt;
    modules.forEach(module => {
      const focus = hovered === module.id;
      module.group.position.y = THREE.MathUtils.lerp(module.group.position.y, focus ? 1.8 : 0, settings.motion ? .13 : 1);
      module.hexMaterial.opacity = settings.hexagons && focus ? .3 : 0;
      module.roadMaterial.opacity = focus ? .58 + .25 * Math.sin(elapsed * 4) : .3;
      module.edgeMaterial.opacity = focus || selected === module.id ? 1 : .7;
      module.glass.emissiveIntensity = focus ? .16 : .055;
      module.agents.visible = settings.agents;
      module.agentGeometry.setDrawRange(0, module.profile.count);
      for (let i = 0; i < module.profile.count; i++) {
        const progress = (i / module.profile.count + elapsed * module.profile.speed * .17 * (i % 2 ? 1 : -1) + 100) % 1;
        module.route.getPointAt(progress, agentPoint);
        agentPoint.x += i % 2 ? .2 : -.2; agentPoint.y = .4;
        agentPoint.toArray(module.positions, i * 3);
      }
      module.agentGeometry.attributes.position.needsUpdate = true;
      projected.copy(module.anchor); projected.y += module.group.position.y; projected.project(camera);
      onProject(module.id, (projected.x + 1) / 2 * width, (1 - projected.y) / 2 * height);
    });
    for (let i = 0; i < 110; i++) {
      riverCurve.getPointAt((i / 110 + elapsed * .012) % 1, riverPoint);
      riverPoint.z += Math.sin(i * 13.7) * .45; riverPoint.y += .55; riverPoint.toArray(ripplePositions, i * 3);
    }
    rippleGeo.attributes.position.needsUpdate = true;
    riverMaterial.uniforms.time.value = elapsed; bloomPass.enabled = settings.bloom;
    composer.render();
  };
  raf = requestAnimationFrame(frame);
  return {
    update(next, nextSelected, nextHovered, nextSettings) {
      dirty = true;
      data = next; selected = nextSelected; hovered = nextHovered; settings = nextSettings;
      modules.forEach(module => {
        const metric = data.find(d => d.id === module.id)!;
        module.profile = trafficProfile(metric.load);
        module.glass.emissive.set(metric.color);
        module.group.traverse(object => {
          if (object instanceof THREE.LineSegments) (object.material as THREE.LineBasicMaterial).color.set(metric.color);
          if (object instanceof THREE.Mesh && object.material instanceof THREE.MeshStandardMaterial) object.material.emissive.set(metric.color);
        });
      });
    },
    dispose() {
      disposed = true; cancelAnimationFrame(raf); observer.disconnect(); visibility.disconnect();
      renderer.domElement.removeEventListener('pointermove', move); renderer.domElement.removeEventListener('pointerleave', leave);
      renderer.domElement.removeEventListener('pointerup', click); renderer.domElement.removeEventListener('webglcontextlost', lost);
      const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
      scene.traverse(object => { const renderable = object as THREE.Mesh; if (renderable.geometry) geometries.add(renderable.geometry);
        if (renderable.material) (Array.isArray(renderable.material) ? renderable.material : [renderable.material]).forEach(m => materials.add(m)); });
      geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose());
      bloomPass.dispose(); outputPass.dispose(); composer.dispose(); renderer.dispose(); renderer.domElement.remove();
    },
  };
}
