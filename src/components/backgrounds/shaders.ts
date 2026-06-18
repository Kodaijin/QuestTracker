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

    float star = step(0.998, hash(floor(uv * vec2(900.0, 520.0))));
    outc += star * 0.6;

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
    float twinkle = 0.6 + 0.4 * sin(uTime * tw + h * 30.0);
    return bright * twinkle;
  }
  void main() {
    vec2 uv = vUv;
    float aspect = uResolution.x / max(uResolution.y, 1.0);
    vec2 p = vec2(uv.x * aspect, uv.y);

    float s = 0.0;
    s += starLayer(p, 12.0, 0.005, 3.0) * 0.5;
    s += starLayer(p, 24.0, 0.012, 4.0) * 0.8;
    s += starLayer(p, 48.0, 0.02, 5.0);

    vec3 tint = mix(uColorA, uColorB, uv.y);
    vec3 base = vec3(0.02, 0.025, 0.04);
    gl_FragColor = vec4(base + s * tint, 1.0);
  }
`;
