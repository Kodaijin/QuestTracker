// GLSL for the WebGL ambient backgrounds. Rendered on a fullscreen quad: the
// vertex shader writes clip-space directly, ignoring the camera. `position` and
// `uv` are injected automatically by THREE.ShaderMaterial — do not redeclare.

export const VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

// Value-noise + fbm shared by the cloud shaders.
const NOISE = /* glsl */ `
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }
  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 5; i++) {
      v += a * noise(p);
      p *= 2.0;
      a *= 0.5;
    }
    return v;
  }
`;

const HEADER = /* glsl */ `
  uniform float uTime;
  uniform vec2 uResolution;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  varying vec2 vUv;
`;

/** Flowing aurora bands that pool toward the top of the screen. */
export const AURORA_FRAG = /* glsl */ `
  ${HEADER}
  ${NOISE}
  void main() {
    vec2 uv = vUv;
    float aspect = uResolution.x / max(uResolution.y, 1.0);
    vec2 p = vec2(uv.x * aspect, uv.y);
    float t = uTime * 0.05;

    float n = fbm(vec2(p.x * 2.0, p.y * 1.2 - t * 2.0) + fbm(p * 3.0 + t));
    float bands = smoothstep(0.2, 0.9, n);
    float vert = smoothstep(0.0, 1.0, uv.y);

    vec3 col = mix(uColorA, uColorB, n);
    float intensity = bands * mix(0.22, 0.6, vert);

    vec3 base = vec3(0.035, 0.035, 0.043);
    gl_FragColor = vec4(base + col * intensity, 1.0);
  }
`;

/** Billowing colored nebula clouds with a sprinkle of stars. */
export const NEBULA_FRAG = /* glsl */ `
  ${HEADER}
  ${NOISE}
  void main() {
    vec2 uv = vUv;
    float aspect = uResolution.x / max(uResolution.y, 1.0);
    vec2 p = vec2(uv.x * aspect, uv.y) * 1.5;
    float t = uTime * 0.03;

    float n1 = fbm(p + vec2(t, t * 0.5));
    float n2 = fbm(p * 1.7 - vec2(t * 0.7, t));
    float clouds = fbm(p + n1 * 1.5 + n2);

    vec3 c = mix(uColorA, uColorB, smoothstep(0.2, 0.8, n1));
    c = mix(c, vec3(0.05, 0.02, 0.1), smoothstep(0.3, 1.0, 1.0 - clouds));
    float density = smoothstep(0.25, 0.95, clouds);

    vec3 base = vec3(0.02, 0.02, 0.03);
    vec3 outc = base + c * density * 0.8;

    // Stars: slowly drift downward and twinkle so they don't sit frozen.
    vec2 sc = vec2(uv.x, uv.y + uTime * 0.01) * vec2(900.0, 520.0);
    vec2 cell = floor(sc);
    float h = hash(cell);
    float star = step(0.997, h);
    float twinkle = 0.5 + 0.5 * sin(uTime * 2.5 + h * 6.283);
    outc += star * twinkle * 0.7;

    gl_FragColor = vec4(outc, 1.0);
  }
`;

/** Parallax layers of slowly drifting, twinkling stars. */
export const STARFIELD_FRAG = /* glsl */ `
  ${HEADER}
  ${NOISE}
  float starLayer(vec2 uv, float density, float speed, float tw) {
    uv.y += uTime * speed;
    vec2 g = uv * density;
    vec2 id = floor(g);
    vec2 f = fract(g);
    float h = hash(id);
    vec2 pos = vec2(hash(id + 1.3), hash(id + 2.7));
    float d = length(f - pos);
    float bright = smoothstep(0.06, 0.0, d) * step(0.6, h);
    float twinkle = 0.45 + 0.55 * sin(uTime * tw + h * 30.0);
    return bright * twinkle;
  }
  void main() {
    vec2 uv = vUv;
    float aspect = uResolution.x / max(uResolution.y, 1.0);
    vec2 p = vec2(uv.x * aspect, uv.y);

    // Nearer (denser) layers scroll faster for a parallax feel.
    float s = 0.0;
    s += starLayer(p, 12.0, 0.03, 3.0) * 0.5;
    s += starLayer(p, 24.0, 0.05, 4.0) * 0.8;
    s += starLayer(p, 48.0, 0.08, 5.0);

    vec3 tint = mix(uColorA, uColorB, uv.y);
    vec3 base = vec3(0.02, 0.025, 0.04);
    gl_FragColor = vec4(base + s * tint, 1.0);
  }
`;

/** Warm glowing fireflies drifting upward over a dark forest gradient. */
export const FIREFLIES_FRAG = /* glsl */ `
  ${HEADER}
  ${NOISE}
  float fireflyLayer(vec2 uv, float density, float speed, float seed) {
    uv.y -= uTime * speed;                                   // rise
    uv.x += sin(uTime * 0.5 + uv.y * 3.0 + seed) * 0.02;     // gentle sway
    vec2 g = uv * density;
    vec2 id = floor(g);
    vec2 f = fract(g);
    float h = hash(id + seed);
    vec2 pos = vec2(hash(id + seed + 1.7), hash(id + seed + 3.3));
    float d = length(f - pos);
    float glow = smoothstep(0.14, 0.0, d) * step(0.72, h);
    float pulse = 0.35 + 0.65 * sin(uTime * 2.0 + h * 25.0);
    return glow * pulse;
  }
  void main() {
    vec2 uv = vUv;
    float aspect = uResolution.x / max(uResolution.y, 1.0);
    vec2 p = vec2(uv.x * aspect, uv.y);

    vec3 base = mix(vec3(0.02, 0.03, 0.025), vec3(0.03, 0.05, 0.04), uv.y);
    float f = 0.0;
    f += fireflyLayer(p, 6.0, 0.03, 0.0) * 0.7;
    f += fireflyLayer(p, 10.0, 0.05, 5.0);

    vec3 col = mix(uColorA, uColorB, sin(uTime + p.x) * 0.5 + 0.5);
    gl_FragColor = vec4(base + col * f, 1.0);
  }
`;

/** Deep underwater scene: caustic ripples, light rays, and rising bubbles. */
export const OCEAN_FRAG = /* glsl */ `
  ${HEADER}
  ${NOISE}
  void main() {
    vec2 uv = vUv;
    float aspect = uResolution.x / max(uResolution.y, 1.0);
    vec2 p = vec2(uv.x * aspect, uv.y);
    float t = uTime * 0.1;

    vec3 deep = uColorB * 0.15;
    vec3 shallow = uColorA * 0.4;
    vec3 base = mix(deep, shallow, uv.y);

    float c = fbm(p * 4.0 + vec2(t, t * 0.6)) + fbm(p * 7.0 - vec2(t * 0.8, t));
    float caustic = pow(smoothstep(0.7, 1.3, c), 2.0);
    base += uColorA * caustic * 0.5;

    float ray = smoothstep(0.3, 1.0, uv.y) * (0.5 + 0.5 * sin(p.x * 8.0 + t));
    base += shallow * ray * 0.05;

    float bub = 0.0;
    for (int i = 0; i < 3; i++) {
      float fi = float(i);
      vec2 bp = vec2(uv.x * aspect, uv.y + uTime * (0.05 + fi * 0.02));
      vec2 g = bp * (20.0 + fi * 8.0);
      vec2 id = floor(g);
      vec2 fr = fract(g);
      float h = hash(id + fi * 4.0);
      vec2 pos = vec2(hash(id + 1.1 + fi), hash(id + 2.2 + fi));
      bub += smoothstep(0.08, 0.0, length(fr - pos)) * step(0.93, h);
    }
    base += vec3(0.6, 0.8, 0.9) * bub * 0.4;

    gl_FragColor = vec4(base, 1.0);
  }
`;

/** Volcanic dark base with glowing cracks and upward-streaming embers. */
export const EMBER_FRAG = /* glsl */ `
  ${HEADER}
  ${NOISE}
  void main() {
    vec2 uv = vUv;
    float aspect = uResolution.x / max(uResolution.y, 1.0);
    vec2 p = vec2(uv.x * aspect, uv.y);
    float t = uTime * 0.15;

    float n = fbm(p * 3.0 + vec2(0.0, -t));
    float crack = pow(1.0 - abs(n - 0.5) * 2.0, 4.0);
    vec3 base = vec3(0.03, 0.015, 0.01);
    vec3 glow = mix(uColorB, uColorA, crack);
    base += glow * crack * 0.6 * (0.6 + 0.4 * sin(uTime * 1.5 + p.x * 5.0));

    float em = 0.0;
    for (int i = 0; i < 3; i++) {
      float fi = float(i);
      vec2 ep = vec2(uv.x * aspect + sin(uTime * 0.7 + fi) * 0.05, uv.y + uTime * (0.08 + fi * 0.04));
      vec2 g = ep * (18.0 + fi * 10.0);
      vec2 id = floor(g);
      vec2 fr = fract(g);
      float h = hash(id + fi * 3.0);
      vec2 pos = vec2(hash(id + 1.3 + fi), hash(id + 2.9 + fi));
      float e = smoothstep(0.09, 0.0, length(fr - pos)) * step(0.9, h);
      em += e * (0.5 + 0.5 * sin(uTime * 3.0 + h * 20.0));
    }
    base += uColorA * em * 0.8;

    gl_FragColor = vec4(base, 1.0);
  }
`;

/** A slowly rotating spiral galaxy with a bright core and drifting stars. */
export const GALAXY_FRAG = /* glsl */ `
  ${HEADER}
  ${NOISE}
  void main() {
    vec2 uv = vUv;
    float aspect = uResolution.x / max(uResolution.y, 1.0);
    vec2 p = (uv - 0.5) * vec2(aspect, 1.0) * 2.0;
    float r = length(p);
    float a = atan(p.y, p.x);
    float t = uTime * 0.1;

    float spiral = sin(2.0 * (a + t) + r * 6.0 - t * 2.0);
    float arm = smoothstep(0.0, 1.0, spiral) * smoothstep(1.6, 0.1, r);
    float core = smoothstep(0.5, 0.0, r);

    vec3 base = vec3(0.02, 0.02, 0.04);
    base += mix(uColorB, uColorA, arm) * arm * 0.5;
    base += mix(uColorA, vec3(1.0), 0.5) * core * 0.8;

    vec2 rot = vec2(cos(t), sin(t));
    vec2 sp = vec2(p.x * rot.x - p.y * rot.y, p.x * rot.y + p.y * rot.x);
    float star = step(0.99, hash(floor(sp * 40.0)));
    base += star * smoothstep(1.8, 0.2, r) * 0.6;

    gl_FragColor = vec4(base, 1.0);
  }
`;

/** Falling, swaying cherry-blossom petals over a soft gradient. */
export const SAKURA_FRAG = /* glsl */ `
  ${HEADER}
  ${NOISE}
  float petalLayer(vec2 uv, float density, float speed, float seed) {
    uv.y += uTime * speed;                                   // fall
    uv.x += sin(uTime * 1.2 + uv.y * 4.0 + seed) * 0.03;     // sway
    vec2 g = uv * density;
    vec2 id = floor(g);
    vec2 f = fract(g) - vec2(hash(id + seed + 1.0), hash(id + seed + 2.0));
    float h = hash(id + seed);
    float d = length(f * vec2(1.0, 1.8));
    return smoothstep(0.16, 0.0, d) * step(0.78, h);
  }
  void main() {
    vec2 uv = vUv;
    float aspect = uResolution.x / max(uResolution.y, 1.0);
    vec2 p = vec2(uv.x * aspect, uv.y);

    vec3 base = mix(vec3(0.06, 0.03, 0.05), vec3(0.10, 0.05, 0.08), uv.y);
    float pet = 0.0;
    pet += petalLayer(p, 7.0, 0.04, 0.0) * 0.8;
    pet += petalLayer(p, 11.0, 0.06, 4.0);

    vec3 col = mix(uColorA, uColorB, uv.y);
    gl_FragColor = vec4(base + col * pet, 1.0);
  }
`;

/** Retro synthwave: a scrolling perspective grid under a banded neon sun. */
export const SYNTHWAVE_FRAG = /* glsl */ `
  ${HEADER}
  ${NOISE}
  void main() {
    vec2 uv = vUv;
    float aspect = uResolution.x / max(uResolution.y, 1.0);

    vec3 base = mix(vec3(0.05, 0.02, 0.08), vec3(0.10, 0.03, 0.12), uv.y);

    vec2 sunc = vec2(0.5, 0.62);
    float sd = length((uv - sunc) * vec2(aspect, 1.0));
    float sun = smoothstep(0.26, 0.24, sd);
    float bands = step(0.0, sin((uv.y - 0.45) * 60.0));
    vec3 sunCol = mix(uColorA, uColorB, smoothstep(0.4, 0.8, uv.y));
    base = mix(base, sunCol, sun * max(bands, step(uv.y, 0.5)));

    if (uv.y < 0.5) {
      float persp = 0.5 / (0.5 - uv.y + 0.02);
      float gx = abs(fract((uv.x - 0.5) * persp * 8.0) - 0.5);
      float gy = abs(fract((0.5 - uv.y) * persp + uTime * 0.6) - 0.5);
      float line = smoothstep(0.04, 0.0, gx) + smoothstep(0.04, 0.0, gy);
      vec3 grid = mix(uColorB, uColorA, 0.5);
      base += grid * line * smoothstep(0.0, 0.5, 0.5 - uv.y) * 0.8;
    }

    gl_FragColor = vec4(base, 1.0);
  }
`;

/** Drifting stars joined by faint, slowly shifting constellation lines. */
export const CONSTELLATION_FRAG = /* glsl */ `
  ${HEADER}
  ${NOISE}
  vec2 starPos(vec2 id) {
    float drift = uTime * 0.02;
    return id + vec2(
      0.5 + 0.35 * sin(hash(id) * 6.283 + drift),
      0.5 + 0.35 * cos(hash(id + 1.7) * 6.283 + drift)
    );
  }
  float segDist(vec2 p, vec2 a, vec2 b) {
    vec2 pa = p - a;
    vec2 ba = b - a;
    float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    return length(pa - ba * h);
  }
  void main() {
    vec2 uv = vUv;
    float aspect = uResolution.x / max(uResolution.y, 1.0);
    vec2 p = vec2(uv.x * aspect, uv.y) * 6.0;
    vec2 id = floor(p);

    vec3 base = vec3(0.02, 0.025, 0.045);
    float starGlow = 0.0;
    float lineGlow = 0.0;
    for (int y = -1; y <= 1; y++) {
      for (int x = -1; x <= 1; x++) {
        vec2 nid = id + vec2(float(x), float(y));
        vec2 sp = starPos(nid);
        float on = step(0.45, hash(nid + 9.1));
        starGlow += smoothstep(0.12, 0.0, length(p - sp)) * on;
        vec2 sr = starPos(nid + vec2(1.0, 0.0));
        float onr = step(0.45, hash(nid + vec2(1.0, 0.0) + 9.1));
        lineGlow += smoothstep(0.025, 0.0, segDist(p, sp, sr)) * on * onr;
      }
    }
    vec3 starCol = mix(uColorA, vec3(1.0), 0.4);
    base += starCol * starGlow;
    base += mix(uColorA, uColorB, 0.5) * lineGlow * 0.25;

    gl_FragColor = vec4(base, 1.0);
  }
`;

/** Streaking rain with the occasional full-screen lightning flash. */
export const RAIN_FRAG = /* glsl */ `
  ${HEADER}
  ${NOISE}
  float rainLayer(vec2 uv, float density, float speed, float seed) {
    uv.x *= density;
    float col = floor(uv.x);
    uv.y = uv.y * density + uTime * speed + hash(vec2(col, seed)) * 10.0;
    float row = fract(uv.y);
    float fx = abs(fract(uv.x) - 0.5);
    return smoothstep(0.06, 0.0, fx) * smoothstep(0.5, 0.0, row) * step(0.5, hash(vec2(col, seed + 1.0)));
  }
  void main() {
    vec2 uv = vUv;
    float aspect = uResolution.x / max(uResolution.y, 1.0);
    vec2 p = vec2(uv.x * aspect, uv.y);

    vec3 base = mix(vec3(0.03, 0.035, 0.05), vec3(0.05, 0.06, 0.08), uv.y);
    float r = 0.0;
    r += rainLayer(p, 40.0, 3.0, 0.0) * 0.6;
    r += rainLayer(p, 70.0, 4.5, 7.0);
    base += mix(uColorA, uColorB, 0.5) * r * 0.5;

    float cycle = floor(uTime / 6.0);
    float local = fract(uTime / 6.0) * 6.0;
    float flashTime = hash(vec2(cycle, 3.3)) * 4.0 + 1.0;
    float flash = smoothstep(0.0, 0.05, local - flashTime) * smoothstep(0.5, 0.0, local - flashTime);
    flash *= step(0.5, hash(vec2(cycle, 5.5)));
    base += vec3(0.6, 0.65, 0.8) * flash;

    gl_FragColor = vec4(base, 1.0);
  }
`;
