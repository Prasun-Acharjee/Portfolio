// Diwali page: the portfolio's topo map on a new-moon night.
// Source for diwali/app.js. Build: npx esbuild src/diwali.js --bundle --format=esm --minify --outfile=diwali/app.js
import {
  WebGLRenderer, Scene, PerspectiveCamera, Color, FogExp2, CanvasTexture, SRGBColorSpace, PlaneGeometry, Mesh,
  MeshStandardMaterial, HemisphereLight, DirectionalLight, BufferGeometry, BufferAttribute, LineSegments, LineBasicMaterial,
  Line, Vector2, Vector3, Raycaster, CatmullRomCurve3, TubeGeometry, MeshBasicMaterial, LatheGeometry, InstancedMesh,
  Object3D, Points, ShaderMaterial, AdditiveBlending, Sprite, SpriteMaterial, ACESFilmicToneMapping, MathUtils
} from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

const root = document.documentElement;
const params = new URLSearchParams(location.search);
const OG = params.has('og');
if (OG) root.classList.add('og');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches && !OG;
const mobile = Math.min(innerWidth, innerHeight) < 700 || matchMedia('(pointer: coarse)').matches;
const $ = (id) => document.getElementById(id);

/* ---------------- dates: which Diwali is this ---------------- */
const SEASONS = [
  { start: '2026-11-06', main: '2026-11-08', end: '2026-11-10', label: 'Sunday, 8 November 2026' },
  { start: '2027-10-27', main: '2027-10-29', end: '2027-10-31', label: 'Friday, 29 October 2027' },
  { start: '2028-10-15', main: '2028-10-17', end: '2028-10-19', label: 'Tuesday, 17 October 2028' },
];
(function setWhen() {
  const d = new Date(); const today = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const at = (s) => { const [y, m, dd] = s.split('-').map(Number); return new Date(y, m - 1, dd); };
  const days = (a, b) => Math.round((b - a) / 864e5);
  const s = SEASONS.find((x) => today <= at(x.end));
  const el = $('when');
  if (!s) { el.textContent = 'Diwali falls on the new-moon night of Kartik.'; return; }
  const main = at(s.main), start = at(s.start);
  if (today >= start) {
    const n = days(today, main);
    el.textContent = n > 0 ? `Diwali falls on the new-moon night of ${s.label}. ${n === 1 ? 'Tomorrow' : n + ' days to go'}.`
      : n === 0 ? `Tonight is Diwali, the new-moon night of ${s.label}.`
      : `Diwali fell on the new-moon night of ${s.label}. The lamps stay lit here a little longer.`;
  } else {
    const n = days(today, main);
    el.textContent = `The next Diwali falls on ${s.label}, ${n} days from now. The lamps here stay lit all year.`;
  }
})();

/* ---------------- renderer and scene ---------------- */
const canvas = $('scene');
const renderer = new WebGLRenderer({ canvas, antialias: !mobile, powerPreference: 'high-performance', preserveDrawingBuffer: OG });
renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.5 : 2));
renderer.toneMapping = ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
const scene = new Scene();
const camera = new PerspectiveCamera(42, innerWidth / innerHeight, 0.1, 500);

// sky: indigo overhead, a faint maroon glow over the city on the horizon
const sky = document.createElement('canvas'); sky.width = 4; sky.height = 512;
{ const g = sky.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 512);
  gr.addColorStop(0, '#04071A'); gr.addColorStop(0.45, '#0B1236'); gr.addColorStop(0.72, '#1C1840'); gr.addColorStop(0.86, '#3A1838'); gr.addColorStop(1, '#22132E');
  g.fillStyle = gr; g.fillRect(0, 0, 4, 512); }
const skyTex = new CanvasTexture(sky); skyTex.colorSpace = SRGBColorSpace;
scene.background = skyTex;
scene.fog = new FogExp2(0x1a1636, 0.014);
scene.add(new HemisphereLight(0x3b4a8f, 0x1a0e1c, 0.75));
const moonless = new DirectionalLight(0x8d7bd6, 0.25); moonless.position.set(-20, 30, 10); scene.add(moonless);

/* ---------------- terrain ---------------- */
const HILLS = [[-16, -12, 3.4, 7], [19, -15, 2.7, 6], [-32, 8, 2.4, 8], [28, 12, 2.1, 6.5], [6, 24, 1.5, 7], [-6, -30, 2.6, 9], [38, -30, 3, 8], [-40, -26, 2.2, 7], [-24, 30, 1.8, 7]];
function H(x, z) {
  let h = 0;
  for (const [hx, hz, a, s] of HILLS) h += a * Math.exp(-((x - hx) ** 2 + (z - hz) ** 2) / (2 * s * s));
  h += 0.22 * Math.sin(x * 0.21 + z * 0.13) * Math.cos(z * 0.17 - x * 0.07);
  return Math.max(0, h);
}
const W = 170, D = 120;
{
  const g = new PlaneGeometry(W, D, mobile ? 120 : 200, mobile ? 84 : 140); g.rotateX(-Math.PI / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, H(p.getX(i), p.getZ(i)));
  g.computeVertexNormals();
  scene.add(new Mesh(g, new MeshStandardMaterial({ color: 0x111a3d, roughness: 1, metalness: 0 })));
  var ground = scene.children[scene.children.length - 1];
  const outer = new PlaneGeometry(1200, 1200); outer.rotateX(-Math.PI / 2); outer.translate(0, -0.02, 0);
  scene.add(new Mesh(outer, new MeshStandardMaterial({ color: 0x111a3d, roughness: 1 })));
}

// contour lines, marching squares over the height field
{
  const step = mobile ? 0.6 : 0.42, x0 = -W / 2, z0 = -D / 2, nx = Math.floor(W / step), nz = Math.floor(D / step);
  const f = new Float32Array((nx + 1) * (nz + 1));
  for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) f[j * (nx + 1) + i] = H(x0 + i * step, z0 + j * step);
  const minor = [], major = [];
  const LV = 0.32;
  for (let k = 1; k * LV < 4.2; k++) {
    const L = k * LV, out = k % 4 === 0 ? major : minor;
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const a = f[j * (nx + 1) + i], b = f[j * (nx + 1) + i + 1], c = f[(j + 1) * (nx + 1) + i + 1], d = f[(j + 1) * (nx + 1) + i];
      const idx = (a > L) | ((b > L) << 1) | ((c > L) << 2) | ((d > L) << 3);
      if (idx === 0 || idx === 15) continue;
      const X = x0 + i * step, Z = z0 + j * step;
      const e = [
        [X + step * (L - a) / (b - a), Z], [X + step, Z + step * (L - b) / (c - b)],
        [X + step * (L - d) / (c - d), Z + step], [X, Z + step * (L - a) / (d - a)],
      ];
      const T = { 1: [[3, 0]], 2: [[0, 1]], 3: [[3, 1]], 4: [[1, 2]], 5: [[3, 0], [1, 2]], 6: [[0, 2]], 7: [[3, 2]], 8: [[2, 3]], 9: [[0, 2]], 10: [[0, 1], [2, 3]], 11: [[1, 2]], 12: [[1, 3]], 13: [[0, 1]], 14: [[0, 3]] }[idx];
      for (const [u, v] of T) out.push(e[u][0], L + 0.03, e[u][1], e[v][0], L + 0.03, e[v][1]);
    }
  }
  const mk = (arr, op) => { const g = new BufferGeometry(); g.setAttribute('position', new BufferAttribute(new Float32Array(arr), 3));
    return new LineSegments(g, new LineBasicMaterial({ color: 0xb08a3e, transparent: true, opacity: op })); };
  scene.add(mk(minor, 0.32)); scene.add(mk(major, 0.6));
}
// the river from the portfolio hero
{
  const pts = []; for (let x = -W / 2; x <= W / 2; x += 1) { const z = 34 + 5 * Math.sin(x * 0.07) + 2 * Math.sin(x * 0.19); pts.push(new Vector3(x, H(x, z) + 0.05, z)); }
  scene.add(new Line(new BufferGeometry().setFromPoints(pts), new LineBasicMaterial({ color: 0x3d7fb8, transparent: true, opacity: 0.7 })));
}

/* ---------------- stars (no moon tonight) ---------------- */
const starMat = new ShaderMaterial({
  uniforms: { uTime: { value: 0 }, uPixel: { value: renderer.getPixelRatio() } }, transparent: true, depthWrite: false, fog: false,
  vertexShader: `uniform float uTime;uniform float uPixel;attribute float aSeed;varying float vA;
    void main(){vec4 mv=modelViewMatrix*vec4(position,1.0);gl_Position=projectionMatrix*mv;
    vA=.45+.55*sin(uTime*(.6+aSeed*1.7)+aSeed*40.0);gl_PointSize=(1.0+aSeed*1.6)*uPixel;}`,
  fragmentShader: `varying float vA;void main(){float d=length(gl_PointCoord-.5);if(d>.5)discard;gl_FragColor=vec4(vec3(.85,.86,1.0),vA*(1.0-d*2.0));}`,
});
{
  const N = mobile ? 700 : 1400, p = new Float32Array(N * 3), s = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const th = Math.random() * Math.PI * 2, ph = Math.random() * 1.25 + 0.12, r = 220;
    p[i * 3] = r * Math.cos(th) * Math.cos(ph); p[i * 3 + 1] = r * Math.sin(ph) - 10; p[i * 3 + 2] = r * Math.sin(th) * Math.cos(ph); s[i] = Math.random();
  }
  const g = new BufferGeometry(); g.setAttribute('position', new BufferAttribute(p, 3)); g.setAttribute('aSeed', new BufferAttribute(s, 1));
  scene.add(new Points(g, starMat));
}

/* ---------------- the route ---------------- */
const svgNS = 'http://www.w3.org/2000/svg';
const routeEl = document.createElementNS(svgNS, 'path');
routeEl.setAttribute('d', 'M610 110 C570 220 490 280 420 330 S300 420 300 520 C300 610 160 620 132 520 C108 432 150 330 205 292');
const toWorld = (px, py) => { const x = (px - 380) / 760 * 46, z = (py - 340) / 680 * 40; return new Vector3(x, H(x, z) + 0.14, z); };
const routeLen = routeEl.getTotalLength();
const routePts = []; for (let i = 0; i <= 160; i++) { const q = routeEl.getPointAtLength(routeLen * i / 160); routePts.push(toWorld(q.x, q.y)); }
const curve = new CatmullRomCurve3(routePts);
const tube = new TubeGeometry(curve, 400, mobile ? 0.11 : 0.09, 6, false);
const routeMesh = new Mesh(tube, new MeshBasicMaterial({ color: 0xd6264f }));
scene.add(routeMesh);
const tubeIdx = tube.index.count;
const STOPS = [{ p: toWorld(610, 110), name: 'Kolkata' }, { p: toWorld(300, 520), name: 'Bengaluru' }, { p: toWorld(205, 292), name: 'Home' }];

function label(text, pos) {
  const c = document.createElement('canvas'), g = c.getContext('2d'); c.width = 512; c.height = 128;
  g.font = 'italic 64px Newsreader, Georgia, serif'; g.fillStyle = '#E9DCC0'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowColor = 'rgba(14,21,48,.9)'; g.shadowBlur = 12; g.fillText(text, 256, 64);
  const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace;
  const s = new Sprite(new SpriteMaterial({ map: t, transparent: true, opacity: 0.8, depthWrite: false, fog: false }));
  s.scale.set(6.4, 1.6, 1); s.position.copy(pos).add(new Vector3(0, 1.7, 0)); s.renderOrder = 5; scene.add(s); return s;
}

/* ---------------- diyas ---------------- */
const MAXD = mobile ? 600 : 1000;
const bowlGeo = new LatheGeometry([new Vector2(0, 0), new Vector2(0.14, 0.01), new Vector2(0.25, 0.07), new Vector2(0.31, 0.16), new Vector2(0.27, 0.17), new Vector2(0.19, 0.11), new Vector2(0, 0.1)], 14);
const bowls = new InstancedMesh(bowlGeo, new MeshStandardMaterial({ color: 0x8a3519, roughness: 0.85, emissive: 0x4a1606, emissiveIntensity: 0.9 }), MAXD);
bowls.count = 0; scene.add(bowls);
const flamePos = new Float32Array(MAXD * 3), flameSeed = new Float32Array(MAXD), flameBorn = new Float32Array(MAXD).fill(-100), flameSize = new Float32Array(MAXD);
const flameGeo = new BufferGeometry();
flameGeo.setAttribute('position', new BufferAttribute(flamePos, 3));
flameGeo.setAttribute('aSeed', new BufferAttribute(flameSeed, 1));
flameGeo.setAttribute('aBorn', new BufferAttribute(flameBorn, 1));
flameGeo.setAttribute('aSize', new BufferAttribute(flameSize, 1));
flameGeo.setDrawRange(0, 0);
const flameVS = (scale) => `uniform float uTime;uniform float uPixel;uniform float uStill;attribute float aSeed;attribute float aBorn;attribute float aSize;varying float vOn;varying float vSeed;
  void main(){float age=uTime-aBorn;float on=aBorn<-50.0?0.0:smoothstep(0.0,0.7,age);
  float fl=uStill>0.5?1.0:(.86+.1*sin(uTime*8.0+aSeed*31.0)+.06*sin(uTime*21.0+aSeed*7.0));
  vec4 mv=modelViewMatrix*vec4(position,1.0);gl_Position=projectionMatrix*mv;
  gl_PointSize=aSize*${scale}*fl*on*uPixel*(${mobile ? '340.0' : '300.0'}/-mv.z);vOn=on;vSeed=aSeed;}`;
const flameUniforms = { uTime: { value: 0 }, uPixel: { value: renderer.getPixelRatio() }, uStill: { value: reduce ? 1 : 0 } };
const flames = new Points(flameGeo, new ShaderMaterial({
  uniforms: flameUniforms, transparent: true, depthWrite: false, blending: AdditiveBlending,
  vertexShader: flameVS('1.0'),
  fragmentShader: `varying float vOn;varying float vSeed;void main(){vec2 uv=gl_PointCoord;float y=1.0-uv.y;float x=(uv.x-.5)*2.0;
    float w=y<.32?1.0:mix(1.0,.08,smoothstep(.32,1.0,y));float r=length(vec2(x/w,(y-.32)*(y<.32?3.0:1.2)));
    float a=clamp(1.0-r,0.0,1.0);if(a<=0.0)discard;vec3 c=mix(vec3(1.0,.42,.08),vec3(1.0,.92,.7),pow(a,1.6));gl_FragColor=vec4(c*1.6,a*vOn);}`,
}));
const halos = new Points(flameGeo, new ShaderMaterial({
  uniforms: flameUniforms, transparent: true, depthWrite: false, blending: AdditiveBlending,
  vertexShader: flameVS('4.0'),
  fragmentShader: `varying float vOn;void main(){float d=length(gl_PointCoord-.5)*2.0;float a=pow(clamp(1.0-d,0.0,1.0),2.2);gl_FragColor=vec4(vec3(1.0,.5,.16),a*.16*vOn);}`,
}));
scene.add(halos); scene.add(flames);
let nD = 0, firstUser = -1;
const tmp = new Object3D();
function addDiya(x, z, born, size = 1) {
  let i = nD;
  if (nD >= MAXD) { if (firstUser < 0) return -1; i = firstUser + ((nD - firstUser) % (MAXD - firstUser)); nD++; } else nD++;
  const y = H(x, z), s = size * (0.85 + Math.random() * 0.35);
  tmp.position.set(x, y, z); tmp.rotation.set(0, Math.random() * 6.28, 0); tmp.scale.setScalar(s); tmp.updateMatrix();
  bowls.setMatrixAt(i, tmp.matrix); bowls.count = Math.min(nD, MAXD); bowls.instanceMatrix.needsUpdate = true;
  flamePos.set([x, y + 0.27 * s, z], i * 3); flameSeed[i] = Math.random(); flameBorn[i] = born; flameSize[i] = (mobile ? 1.9 : 1.6) * s;
  for (const k of ['position', 'aSeed', 'aBorn', 'aSize']) flameGeo.attributes[k].needsUpdate = true;
  flameGeo.setDrawRange(0, Math.min(nD, MAXD));
  return i;
}

/* ---------------- fireworks ---------------- */
const MAXF = mobile ? 2600 : 5000;
const fPos = new Float32Array(MAXF * 3), fCol = new Float32Array(MAXF * 3), fLife = new Float32Array(MAXF), fSize = new Float32Array(MAXF);
const fVel = new Float32Array(MAXF * 3), fDecay = new Float32Array(MAXF), fDrag = new Float32Array(MAXF);
const fGeo = new BufferGeometry();
fGeo.setAttribute('position', new BufferAttribute(fPos, 3)); fGeo.setAttribute('color', new BufferAttribute(fCol, 3));
fGeo.setAttribute('aLife', new BufferAttribute(fLife, 1)); fGeo.setAttribute('aSize', new BufferAttribute(fSize, 1));
const fireworks = new Points(fGeo, new ShaderMaterial({
  uniforms: { uPixel: flameUniforms.uPixel }, transparent: true, depthWrite: false, blending: AdditiveBlending, vertexColors: true,
  vertexShader: `uniform float uPixel;attribute float aLife;attribute float aSize;varying vec3 vC;varying float vL;
    void main(){vec4 mv=modelViewMatrix*vec4(position,1.0);gl_Position=projectionMatrix*mv;vC=color;vL=aLife;gl_PointSize=aSize*uPixel*(0.4+0.6*aLife)*(260.0/-mv.z);}`,
  fragmentShader: `varying vec3 vC;varying float vL;void main(){if(vL<=0.0)discard;float d=length(gl_PointCoord-.5)*2.0;float a=pow(clamp(1.0-d,0.0,1.0),1.6)*vL;gl_FragColor=vec4(vC*2.0,a);}`,
}));
fireworks.frustumCulled = false; scene.add(fireworks);
let fi = 0;
const PALETTES = [[0xffb547, 0xfff1c9], [0xd6264f, 0xffb547], [0xf28c28, 0xffe08a], [0x9fd3ff, 0xffffff], [0xff5fa2, 0xffd1e4], [0x7cff9a, 0xfff1c9]];
const cA = new Color(), cB = new Color();
function spark(x, y, z, vx, vy, vz, col, size, decay, drag) {
  const i = fi; fi = (fi + 1) % MAXF;
  fPos[i * 3] = x; fPos[i * 3 + 1] = y; fPos[i * 3 + 2] = z; fVel[i * 3] = vx; fVel[i * 3 + 1] = vy; fVel[i * 3 + 2] = vz;
  fCol[i * 3] = col.r; fCol[i * 3 + 1] = col.g; fCol[i * 3 + 2] = col.b; fLife[i] = 1; fSize[i] = size; fDecay[i] = decay; fDrag[i] = drag;
}
const rockets = [];
function launch(target) {
  const from = new Vector3(target.x + (Math.random() - 0.5) * 4, H(target.x, target.z), target.z + (Math.random() - 0.5) * 4);
  rockets.push({ p: from, to: target.clone(), t: 0, dur: 0.9 + Math.random() * 0.4, pal: PALETTES[(Math.random() * PALETTES.length) | 0], kind: Math.random() });
}
function burst(p, pal, kind) {
  const n = (mobile ? 110 : 180) * (kind > 0.8 ? 0.7 : 1);
  cA.setHex(pal[0]); cB.setHex(pal[1]);
  const willow = kind < 0.25, ring = kind > 0.8;
  const ax = new Vector3(Math.random() - 0.5, Math.random() * 0.6 + 0.4, Math.random() - 0.5).normalize();
  for (let k = 0; k < n; k++) {
    let v = new Vector3().randomDirection();
    if (ring) v = v.projectOnPlane(ax).normalize();
    const sp = (willow ? 4.2 : ring ? 8.5 : 6.5) * (ring ? 1 : 0.65 + Math.random() * 0.45);
    const col = (Math.random() < 0.35 ? cB : cA).clone();
    if (willow) col.setHex(0xffc56b);
    spark(p.x, p.y, p.z, v.x * sp, v.y * sp, v.z * sp, col, willow ? 1.0 : 1.25, willow ? 0.42 : 0.75 + Math.random() * 0.35, willow ? 0.55 : 0.32);
  }
  // a quick white flash at the centre
  spark(p.x, p.y, p.z, 0, 0, 0, new Color(1, 0.95, 0.85), 7, 4.5, 1);
}

/* ---------------- fanush (sky lanterns) ---------------- */
const MAXL = 70;
const lPos = new Float32Array(MAXL * 3), lBorn = new Float32Array(MAXL).fill(-100), lSeed = new Float32Array(MAXL);
const lVel = []; for (let i = 0; i < MAXL; i++) lVel.push({ up: 0, sx: 0, sz: 0, ph: 0 });
const lGeo = new BufferGeometry();
lGeo.setAttribute('position', new BufferAttribute(lPos, 3)); lGeo.setAttribute('aBorn', new BufferAttribute(lBorn, 1)); lGeo.setAttribute('aSeed', new BufferAttribute(lSeed, 1));
const lanterns = new Points(lGeo, new ShaderMaterial({
  uniforms: flameUniforms, transparent: true, depthWrite: false, blending: AdditiveBlending,
  vertexShader: `uniform float uTime;uniform float uPixel;attribute float aBorn;attribute float aSeed;varying float vOn;varying float vF;
    void main(){vOn=aBorn<-50.0?0.0:smoothstep(0.0,1.2,uTime-aBorn);vF=.85+.15*sin(uTime*5.0+aSeed*20.0);
    vec4 mv=modelViewMatrix*vec4(position,1.0);gl_Position=projectionMatrix*mv;gl_PointSize=(4.2+aSeed*1.6)*uPixel*(300.0/-mv.z)*vOn;}`,
  fragmentShader: `varying float vOn;varying float vF;void main(){vec2 uv=gl_PointCoord;float y=1.0-uv.y;float x=abs(uv.x-.5)*2.0;
    float halfw=mix(.42,.6,y);float body=step(x,halfw)*step(.12,y)*step(y,.86);
    float edge=smoothstep(halfw,halfw-.18,x)*smoothstep(.12,.3,y)*smoothstep(.86,.72,y);
    float glow=pow(clamp(1.0-length(vec2(uv.x-.5,(y-.4)*1.2))*1.6,0.0,1.0),2.0);
    vec3 c=mix(vec3(1.0,.45,.12),vec3(1.0,.85,.55),smoothstep(.1,.5,1.0-y));
    float a=max(body*(.35+.65*edge)*vF,glow*.55);if(a<=0.01)discard;gl_FragColor=vec4(c*(1.2+.8*(1.0-y)),a*vOn);}`,
}));
lanterns.frustumCulled = false; scene.add(lanterns);
let li = 0;
function fanush(x, z, born, y0) {
  const i = li; li = (li + 1) % MAXL;
  lPos.set([x, y0 ?? H(x, z) + 0.6, z], i * 3); lBorn[i] = born; lSeed[i] = Math.random();
  Object.assign(lVel[i], { up: 0.9 + Math.random() * 0.6, sx: (Math.random() - 0.5) * 0.5, sz: -0.3 - Math.random() * 0.5, ph: Math.random() * 6.28 });
  lGeo.attributes.position.needsUpdate = lGeo.attributes.aBorn.needsUpdate = lGeo.attributes.aSeed.needsUpdate = true;
}

/* ---------------- post-processing ---------------- */
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new Vector2(innerWidth / 2, innerHeight / 2), mobile ? 0.75 : 0.85, 0.55, 0.42);
composer.addPass(bloom);
composer.addPass(new OutputPass());
function resize() {
  renderer.setSize(innerWidth, innerHeight, false); composer.setSize(innerWidth, innerHeight);
  bloom.resolution.set(innerWidth / 2, innerHeight / 2);
  camera.aspect = innerWidth / innerHeight; camera.fov = camera.aspect < 0.8 ? 58 : 42; camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();

/* ---------------- camera follows the page ---------------- */
const KEYS = [
  { at: 0.0, pos: [2, 24, 44], look: [-1, 0, -3] },
  { at: 0.22, pos: [12, 13, 22], look: [-2, 0, -2] },
  { at: 0.48, pos: [-6, 9, 30], look: [2, 3, -6] },
  { at: 0.72, pos: [0, 5, 34], look: [0, 13, -20] },
  { at: 1.0, pos: [0, 5.5, 36], look: [0, 15, -20] },
];
const camPos = new Vector3(...KEYS[0].pos), camLook = new Vector3(...KEYS[0].look), wantPos = new Vector3(), wantLook = new Vector3();
let mx = 0, my = 0;
addEventListener('pointermove', (e) => { mx = e.clientX / innerWidth - 0.5; my = e.clientY / innerHeight - 0.5; }, { passive: true });
function sectionKeys() {
  // tie keyframes to real section positions so long pages still line up
  const max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
  const at = (id) => Math.min(1, Math.max(0, $(id).offsetTop / max));
  KEYS[1].at = at('route') * 0.9; KEYS[2].at = at('alpanaSec'); KEYS[3].at = at('roof') * 0.97;
}
addEventListener('resize', sectionKeys); addEventListener('load', sectionKeys); sectionKeys();
function camTarget() {
  const max = Math.max(1, document.documentElement.scrollHeight - innerHeight), p = OG ? 0 : Math.min(1, scrollY / max);
  let a = KEYS[0], b = KEYS[KEYS.length - 1];
  for (let i = 0; i < KEYS.length - 1; i++) if (p >= KEYS[i].at && p <= KEYS[i + 1].at) { a = KEYS[i]; b = KEYS[i + 1]; break; }
  const t = MathUtils.smootherstep(p, a.at, b.at);
  const narrow = camera.aspect < 0.8 ? 1.25 : 1;
  wantPos.set(...a.pos).lerp(new Vector3(...b.pos), t).multiply(new Vector3(narrow, narrow, narrow));
  wantLook.set(...a.look).lerp(new Vector3(...b.look), t);
  if (!reduce && !mobile) { wantPos.x += mx * 3; wantPos.y -= my * 1.5; }
}

/* ---------------- opening: the route lights up ---------------- */
let clock0 = performance.now() / 1000;
const now = () => performance.now() / 1000 - clock0;
const INTRO = reduce || OG ? 0 : 3.6;
const T0 = reduce || OG ? -10 : 0.6;
// lamps along the route, in order
for (let k = 0; k <= 70; k++) {
  const u = k / 70, p = curve.getPointAt(u);
  const side = new Vector3().crossVectors(curve.getTangentAt(u), new Vector3(0, 1, 0)).normalize().multiplyScalar(k % 2 ? 0.55 : -0.55);
  addDiya(p.x + side.x, p.z + side.z, T0 + u * INTRO);
}
// clusters at each stop
STOPS.forEach((s, j) => { for (let k = 0; k < 10; k++) { const a = k / 10 * 6.28, r = 1.1 + (k % 2) * 0.5; addDiya(s.p.x + Math.cos(a) * r, s.p.z + Math.sin(a) * r, T0 + INTRO * [0, 0.55, 1][j] + 0.1 * k, 1.05); } });
// the rest of the city and the villages around it come on afterwards
{
  const N = mobile ? 150 : 260;
  for (let k = 0; k < N; k++) {
    let x, z;
    if (k < N * 0.45) { const c = STOPS[k % 3].p, a = Math.random() * 6.28, r = 2 + Math.random() ** 0.7 * 9; x = c.x + Math.cos(a) * r; z = c.z + Math.sin(a) * r; }
    else { x = (Math.random() - 0.5) * W * 0.75; z = (Math.random() - 0.5) * D * 0.6 - 4; }
    addDiya(x, z, T0 + INTRO + 0.3 + Math.random() * (reduce || OG ? 0 : 5), 0.9);
  }
}
firstUser = nD;
// lanterns already drifting when you arrive
for (let k = 0; k < 9; k++) fanush((Math.random() - 0.5) * 60, -10 - Math.random() * 30, -5, 6 + Math.random() * 16);
if (!reduce) setTimeout(() => document.body.classList.add('lit'), (T0 + 0.1) * 1000); else document.body.classList.add('lit');
document.body.classList.add('lit-ready');

/* ---------------- interaction ---------------- */
const ray = new Raycaster(), ndc = new Vector2();
let userLit = 0; try { userLit = +localStorage.getItem('diyasLit') || 0; } catch (e) {}
const countEl = $('count');
/* shared counters across everyone: totals from /api/diwali-counts, plus this visitor's not-yet-sent taps */
const API = '/api/diwali-counts/';
const fmt = new Intl.NumberFormat('en-IN');
let shared = null; const pending = { diyas: 0, fireworks: 0, rangolis: 0 };
const plural = (n, one, many) => `${fmt.format(n)} ${n === 1 ? one : many}`;
function showCount() {
  if (!shared) { countEl.textContent = userLit ? `You've lit ${plural(userLit, 'diya', 'diyas')}` : ''; return; }
  const t = (f) => shared[f] + pending[f];
  countEl.innerHTML = `<span>Everyone so far:</span> <span>${plural(t('diyas'), 'diya', 'diyas')} ·</span> <span>${plural(t('fireworks'), 'firework', 'fireworks')} ·</span> <span>${plural(t('rangolis'), 'rangoli', 'rangolis')}</span>`;
  countEl.title = userLit ? `You've lit ${plural(userLit, 'diya', 'diyas')}` : '';
}
showCount();
const takeTotals = (j) => { if (j && typeof j.diyas === 'number') { shared = j; showCount(); } };
async function pull() {
  if (OG || document.hidden) return;
  try { const r = await fetch(API, { cache: 'no-store' }); if (r.ok) takeTotals(await r.json()); } catch (e) {}
}
let flushT = 0, flushing = false;
async function flush() {
  flushT = 0;
  if (flushing || !(pending.diyas || pending.fireworks || pending.rangolis)) return;
  const sent = { ...pending }; flushing = true;
  try {
    const r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(sent), keepalive: true });
    if (r.ok) { for (const f in sent) pending[f] -= sent[f]; takeTotals(await r.json()); }
  } catch (e) {} finally { flushing = false; }
}
function tally(f) { pending[f]++; showCount(); if (!flushT) flushT = setTimeout(flush, 2500); }
if (!OG) {
  pull(); setInterval(pull, 20000);
  addEventListener('pagehide', () => {
    if (!(pending.diyas || pending.fireworks || pending.rangolis)) return;
    try { navigator.sendBeacon(API, new Blob([JSON.stringify(pending)], { type: 'application/json' })); } catch (e) {}
  });
}
const toastEl = $('toast'); let toastT;
function toast(t) { toastEl.textContent = t; toastEl.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('on'), 1800); }
function litOne() { userLit++; try { localStorage.setItem('diyasLit', userLit); } catch (e) {} tally('diyas'); }
function skyPoint(dir, origin) {
  const ty = 13 + Math.random() * 7;
  if (dir.y > 0.05) { const t = (ty - origin.y) / dir.y; if (t > 0 && t < 160) return origin.clone().addScaledVector(dir, t); }
  return origin.clone().addScaledVector(dir, 45).setY(ty);
}
canvas.addEventListener('click', (e) => {
  ndc.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hit = ray.intersectObject(ground, false)[0];
  if (hit && hit.distance < 90) { addDiya(hit.point.x, hit.point.z, now()); litOne(); kick(); }
  else { launch(skyPoint(ray.ray.direction, ray.ray.origin)); tally('fireworks'); kick(1.6); }
});
$('lightBtn').addEventListener('click', () => {
  // light one somewhere in view near the middle of the screen
  ray.setFromCamera(new Vector2((Math.random() - 0.5) * 0.8, -0.35 + Math.random() * 0.3), camera);
  const hit = ray.intersectObject(ground, false)[0];
  const p = hit ? hit.point : new Vector3((Math.random() - 0.5) * 20, 0, (Math.random() - 0.5) * 10);
  addDiya(p.x, p.z, now()); litOne(); kick();
});
$('fireBtn').addEventListener('click', () => {
  ray.setFromCamera(new Vector2((Math.random() - 0.5) * 1.2, 0.35 + Math.random() * 0.35), camera);
  launch(skyPoint(ray.ray.direction, ray.ray.origin)); tally('fireworks'); kick(1.6);
});
$('fanushBtn').addEventListener('click', () => {
  for (let k = 0; k < 3; k++) {
    ray.setFromCamera(new Vector2((k - 1) * 0.35 + (Math.random() - 0.5) * 0.15, -0.55), camera);
    const p = ray.ray.origin.clone().addScaledVector(ray.ray.direction, 22 + Math.random() * 8);
    fanush(p.x, p.z, now() + k * 0.35, p.y);
  }
  kick(6);
});
$('shareBtn').addEventListener('click', async () => {
  const url = location.origin + location.pathname;
  const data = { title: 'Happy Diwali', text: 'Light a diya on my map. Happy Diwali from Prasun, Cheeto and Teeto.', url };
  try { if (navigator.share) { await navigator.share(data); return; } await navigator.clipboard.writeText(url); toast('Link copied'); }
  catch (e) { if (e && e.name !== 'AbortError') toast('Copy the address from the bar to share it'); }
});

/* ---------------- parapet lamps on the rooftop ---------------- */
{
  const g = $('parapetLamps'); let html = '';
  for (let k = 0; k < 16; k++) {
    const x = 30 + k * 76 + (k > 6 && k < 9 ? 40 : 0);
    if (x > 500 && x < 720) continue;
    html += `<g transform="translate(${x} 200)"><ellipse cx="0" cy="-2" rx="9" ry="3.5" fill="#8a3519"/><ellipse class="pl" cx="0" cy="-9" rx="3" ry="6" fill="#FFB547" style="animation-delay:${(k * 0.37) % 2}s"/><circle cx="0" cy="-9" r="14" fill="#FFB547" opacity=".12"/></g>`;
  }
  g.innerHTML = html;
  if (!reduce) { const st = document.createElement('style'); st.textContent = '.pl{transform-box:fill-box;transform-origin:50% 100%;animation:pf 1.6s ease-in-out infinite}@keyframes pf{50%{transform:scale(.88,1.08)}}'; document.head.appendChild(st); }
}

/* ---------------- rangoli ---------------- */
const al = $('alpana'), ag = al.getContext('2d');
let alSeed = 7, alRun = 0;
function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function buildAlpana(seed) {
  const R = rng(seed), n = [8, 10, 12, 16][(R() * 4) | 0], groups = [];
  const rot = (pts, a) => pts.map(([x, y]) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)]);
  const sym = (motif, m = n, off = 0) => { const out = []; for (let k = 0; k < m; k++) out.push(rot(motif, (k / m) * Math.PI * 2 + off)); return out; };
  const circle = (r, steps = 120) => { const p = []; for (let k = 0; k <= steps; k++) { const a = (k / steps) * Math.PI * 2; p.push([Math.cos(a) * r, Math.sin(a) * r]); } return p; };
  const petal = (r0, r1, w) => { const p = [], L = r1 - r0; for (let k = 0; k <= 40; k++) { const t = k / 40; p.push([Math.sin(t * Math.PI) ** 0.8 * (1 - t * 0.55) * w * L, r0 + L * t]); } for (let k = 40; k >= 0; k--) { const t = k / 40; p.push([-(Math.sin(t * Math.PI) ** 0.8) * (1 - t * 0.55) * w * L, r0 + L * t]); } return p; };
  const dots = (r, m, s) => ({ dots: Array.from({ length: m }, (_, k) => { const a = (k / m) * Math.PI * 2; return [Math.cos(a) * r, Math.sin(a) * r, s]; }) });
  const curl = (r, s, dir) => { const p = []; for (let k = 0; k <= 50; k++) { const t = k / 50, a = t * Math.PI * 3.2 * dir, rr = s * (1 - t * 0.85); p.push([Math.cos(a) * rr * 0.9, r + Math.sin(a) * rr - s * 0.2]); } return p; };
  const leaf = (r0, r1, w) => { const p = []; for (let k = 0; k <= 30; k++) { const t = k / 30; p.push([Math.sin(t * Math.PI) * w, r0 + (r1 - r0) * t]); } for (let k = 30; k >= 0; k--) { const t = k / 30; p.push([-Math.sin(t * Math.PI) * w * 0.7, r0 + (r1 - r0) * t]); } return p; };
  // centre: a small lotus
  groups.push({ lines: [circle(0.05)] });
  groups.push({ lines: sym(petal(0.05, 0.19 + R() * 0.03, 0.5 + R() * 0.3)) });
  groups.push(dots(0.235, n * 2, 0.008));
  groups.push({ lines: [circle(0.27)] });
  // band two: leaves or a second petal ring, offset half a step
  if (R() < 0.5) groups.push({ lines: sym(leaf(0.28, 0.43, 0.035 + R() * 0.02), n * 2, Math.PI / (n * 2)) });
  else groups.push({ lines: sym(petal(0.28, 0.44, 0.38 + R() * 0.2), n, Math.PI / n) });
  groups.push({ lines: [circle(0.46)] });
  groups.push(dots(0.49, n * 3, 0.007));
  // band three: paired curls
  const cr = 0.6 + R() * 0.04, cs = 0.06 + R() * 0.02;
  groups.push({ lines: [...sym(rot(curl(cr, cs, 1), 0.06)), ...sym(rot(curl(cr, cs, -1), -0.06))] });
  groups.push({ lines: sym([[0, 0.52], [0, cr - cs * 0.6]]) });
  // outer scallops and a final ring of dots
  const sc = []; const m = n * 2; for (let k = 0; k <= m * 24; k++) { const a = (k / (m * 24)) * Math.PI * 2; const r = 0.76 + 0.035 * Math.abs(Math.sin(a * m / 2)); sc.push([Math.cos(a) * r, Math.sin(a) * r]); }
  groups.push({ lines: [sc] });
  groups.push(dots(0.86, m, 0.012));
  groups.push({ lines: sym(leaf(0.88, 0.97, 0.022), n) });
  return groups;
}
const RCOLS = ['#FFF1D6', '#FFB547', '#FF6F91', '#7FD1C3', '#F28C28', '#FFF1D6', '#C9A0FF', '#FFD84D'];
function lenOf(p) { let L = 0; for (let k = 1; k < p.length; k++) L += Math.hypot(p[k][0] - p[k - 1][0], p[k][1] - p[k - 1][1]); return L; }
function drawAlpana(seed, instant) {
  const run = ++alRun, dpr = Math.min(devicePixelRatio, 2), S = al.clientWidth * dpr;
  al.width = al.height = S;
  const groups = buildAlpana(seed), c = S / 2, sc = S * 0.48, colShift = seed % RCOLS.length;
  const bg = () => { ag.fillStyle = '#5B1626'; ag.fillRect(0, 0, S, S); };
  ag.lineCap = ag.lineJoin = 'round';
  const DUR = 520, start = performance.now();
  function paint(t) {
    if (run !== alRun) return;
    bg();
    ag.shadowBlur = 5 * dpr;
    const el = instant ? 1e9 : t - start;
    groups.forEach((g, gi) => {
      const p = Math.max(0, Math.min(1, (el - gi * DUR * 0.62) / DUR)); if (p <= 0) return;
      const col = RCOLS[(gi + colShift) % RCOLS.length]; ag.fillStyle = ag.strokeStyle = col; ag.shadowColor = col + '66';
      if (g.dots) { g.dots.forEach(([x, y, s]) => { ag.beginPath(); ag.arc(c + x * sc, c + y * sc, s * sc * Math.min(1, p * 1.4), 0, 6.283); ag.fill(); }); return; }
      ag.lineWidth = S * (gi === 0 ? 0.006 : 0.0052);
      g.lines.forEach((pts) => {
        const L = lenOf(pts), stop = L * MathUtils.smootherstep(p, 0, 1); let acc = 0;
        ag.beginPath(); ag.moveTo(c + pts[0][0] * sc, c + pts[0][1] * sc);
        for (let k = 1; k < pts.length; k++) {
          const seg = Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]);
          if (acc + seg > stop) { const f = (stop - acc) / seg; ag.lineTo(c + (pts[k - 1][0] + (pts[k][0] - pts[k - 1][0]) * f) * sc, c + (pts[k - 1][1] + (pts[k][1] - pts[k - 1][1]) * f) * sc); break; }
          acc += seg; ag.lineTo(c + pts[k][0] * sc, c + pts[k][1] * sc);
        }
        ag.stroke();
      });
    });
    if (!instant && el < groups.length * DUR * 0.62 + DUR) requestAnimationFrame(paint);
  }
  instant ? paint(0) : requestAnimationFrame(paint);
}
let alStarted = false;
new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting && !alStarted) { alStarted = true; drawAlpana(alSeed, reduce); } }), { threshold: 0.35 }).observe(al);
const nextAlpana = () => { alSeed = (Math.random() * 1e9) | 0; drawAlpana(alSeed, reduce); tally('rangolis'); };
$('alpanaBtn').addEventListener('click', nextAlpana);
al.addEventListener('click', nextAlpana);
addEventListener('resize', () => { if (alStarted) drawAlpana(alSeed, true); });

/* ---------------- loop ---------------- */
let last = performance.now() / 1000, nextAuto = 2.2, running = true, idleUntil = 0;
function kick(sec = 1) { idleUntil = Math.max(idleUntil, now() + sec); }
function inHeroOrRoof() { const y = scrollY + innerHeight * 0.5; const r = $('roof'); return scrollY < innerHeight * 0.7 || (y > r.offsetTop && y < r.offsetTop + r.offsetHeight + innerHeight); }
function frame() {
  if (!running) return;
  const tNow = performance.now() / 1000, dt = Math.min(0.05, tNow - last); last = tNow;
  const t = now();
  flameUniforms.uTime.value = reduce ? 100 : t; starMat.uniforms.uTime.value = reduce ? 0 : t;
  // the route draws itself during the opening
  const rp = INTRO ? Math.min(1, Math.max(0, (t - T0) / INTRO)) : 1;
  tube.setDrawRange(0, Math.floor(tubeIdx * MathUtils.smootherstep(rp, 0, 1) / 3) * 3);
  // ambient fireworks over the hero and the rooftop
  if (!reduce && !OG && t > nextAuto && inHeroOrRoof()) {
    nextAuto = t + 2.4 + Math.random() * 3;
    launch(new Vector3(camLook.x + (Math.random() - 0.5) * 40, 15 + Math.random() * 8, camLook.z - 16 - Math.random() * 20));
  }
  // rockets and sparks
  for (let k = rockets.length - 1; k >= 0; k--) {
    const r = rockets[k]; r.t += dt / r.dur; const e = 1 - (1 - Math.min(1, r.t)) ** 2;
    const x = MathUtils.lerp(r.p.x, r.to.x, e), y = MathUtils.lerp(r.p.y, r.to.y, e), z = MathUtils.lerp(r.p.z, r.to.z, e);
    spark(x, y, z, (Math.random() - 0.5) * 0.4, -0.6, (Math.random() - 0.5) * 0.4, cA.setHex(0xffd38a), 0.9, 2.6, 0.5);
    if (r.t >= 1) { burst(r.to, r.pal, r.kind); rockets.splice(k, 1); }
  }
  for (let i = 0; i < MAXF; i++) {
    if (fLife[i] <= 0) continue;
    const dr = Math.pow(fDrag[i], dt);
    fVel[i * 3] *= dr; fVel[i * 3 + 1] = fVel[i * 3 + 1] * dr - 3.2 * dt; fVel[i * 3 + 2] *= dr;
    fPos[i * 3] += fVel[i * 3] * dt; fPos[i * 3 + 1] += fVel[i * 3 + 1] * dt; fPos[i * 3 + 2] += fVel[i * 3 + 2] * dt;
    fLife[i] = Math.max(0, fLife[i] - fDecay[i] * dt);
  }
  fGeo.attributes.position.needsUpdate = fGeo.attributes.aLife.needsUpdate = fGeo.attributes.color.needsUpdate = fGeo.attributes.aSize.needsUpdate = true;
  // lanterns drift up and away
  for (let i = 0; i < MAXL; i++) {
    if (lBorn[i] < -50) continue;
    const v = lVel[i];
    if (lBorn[i] > t) continue;
    lPos[i * 3] += (v.sx + Math.sin(t * 0.7 + v.ph) * 0.25) * dt; lPos[i * 3 + 1] += v.up * dt * (reduce ? 0 : 1); lPos[i * 3 + 2] += v.sz * dt;
    if (lPos[i * 3 + 1] > 60) lBorn[i] = -100;
  }
  lGeo.attributes.position.needsUpdate = lGeo.attributes.aBorn.needsUpdate = true;
  // camera
  camTarget();
  const k = reduce || OG ? 1 : 1 - Math.pow(0.02, dt);
  camPos.lerp(wantPos, k); camLook.lerp(wantLook, k);
  camera.position.copy(camPos); camera.lookAt(camLook);
  composer.render(dt);
  requestAnimationFrame(frame);
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) running = false;
  else if (!running) { running = true; last = performance.now() / 1000; requestAnimationFrame(frame); }
});
camTarget(); camPos.copy(wantPos); camLook.copy(wantLook);
requestAnimationFrame(frame);
if (OG) {
  // a fixed set of bursts for the social card
  [[-10, 18, -14], [9, 21, -20], [22, 16, -8]].forEach(([x, y, z], j) => burst(new Vector3(x, y, z), PALETTES[j], 0.5));
  window.__ogReady = true;
}
