// Aurora WebGL background — uses ogl from npm (not CDN)
import { Renderer, Program, Mesh, Color, Triangle } from "ogl";

const VERT = /* glsl */`#version 300 es
in vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}`;

const FRAG = /* glsl */`#version 300 es
precision highp float;

uniform float uTime;
uniform float uAmplitude;
uniform vec3  uColorStops[3];
uniform vec2  uResolution;
uniform float uBlend;

out vec4 fragColor;

vec3 permute(vec3 x) {
  return mod(((x * 34.0) + 1.0) * x, 289.0);
}

float snoise(vec2 v) {
  const vec4 C = vec4(
    0.211324865405187,  0.366025403784439,
   -0.577350269189626,  0.024390243902439
  );
  vec2 i  = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1  = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy  -= i1;
  i = mod(i, 289.0);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
  m = m*m; m = m*m;
  vec3 x  = 2.0 * fract(p * C.www) - 1.0;
  vec3 h  = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
  vec3 g;
  g.x  = a0.x  * x0.x   + h.x  * x0.y;
  g.yz = a0.yz * x12.xz  + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

struct ColorStop { vec3 color; float position; };

#define COLOR_RAMP(colors, factor, finalColor) {                              \
  int index = 0;                                                              \
  for (int i = 0; i < 2; i++) {                                               \
    ColorStop cc = colors[i];                                                 \
    bool inBetween = cc.position <= factor;                                   \
    index = int(mix(float(index), float(i), float(inBetween)));               \
  }                                                                           \
  ColorStop cur  = colors[index];                                             \
  ColorStop nxt  = colors[index + 1];                                        \
  float range    = nxt.position - cur.position;                              \
  float lf       = (factor - cur.position) / range;                         \
  finalColor     = mix(cur.color, nxt.color, lf);                            \
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;

  ColorStop colors[3];
  colors[0] = ColorStop(uColorStops[0], 0.0);
  colors[1] = ColorStop(uColorStops[1], 0.5);
  colors[2] = ColorStop(uColorStops[2], 1.0);

  vec3 rampColor;
  COLOR_RAMP(colors, uv.x, rampColor);

  float height = snoise(vec2(uv.x * 2.0 + uTime * 0.1, uTime * 0.25)) * 0.5 * uAmplitude;
  height = exp(height);
  height = (uv.y * 2.0 - height + 0.2);
  float intensity  = 0.6 * height;
  float midPoint   = 0.20;
  float auroraAlpha = smoothstep(midPoint - uBlend * 0.5, midPoint + uBlend * 0.5, intensity);
  vec3 auroraColor  = intensity * rampColor;
  fragColor = vec4(auroraColor * auroraAlpha, auroraAlpha);
}`;

export function mountAurora(container, props = {}) {
  const colorStops = props.colorStops || ["#0FB5A6", "#2F6FE0", "#7CF0C8"];
  const amplitude  = props.amplitude  ?? 0.9;
  const blend      = props.blend      ?? 0.5;
  const speed      = props.speed      ?? 0.45;

  const renderer = new Renderer({
    alpha: true,
    premultipliedAlpha: true,
    antialias: true,
    preserveDrawingBuffer: true,
  });
  const gl = renderer.gl;
  gl.clearColor(0, 0, 0, 0);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  Object.assign(gl.canvas.style, {
    background: "transparent",
    display: "block",
  });

  const toRGB = (hex) => { const c = new Color(hex); return [c.r, c.g, c.b]; };

  const program = new Program(gl, {
    vertex: VERT,
    fragment: FRAG,
    uniforms: {
      uTime:       { value: 0 },
      uAmplitude:  { value: amplitude },
      uColorStops: { value: colorStops.map(toRGB) },
      uResolution: { value: [container.offsetWidth || 800, container.offsetHeight || 400] },
      uBlend:      { value: blend },
    },
  });

  const geometry = new Triangle(gl);
  if (geometry.attributes.uv) delete geometry.attributes.uv;
  const mesh = new Mesh(gl, { geometry, program });

  container.appendChild(gl.canvas);

  function resize() {
    const w = container.offsetWidth  || window.innerWidth;
    const h = container.offsetHeight || 400;
    renderer.setSize(w, h);
    program.uniforms.uResolution.value = [w, h];
  }
  window.addEventListener("resize", resize);
  resize();

  let rafId;
  function update(t) {
    rafId = requestAnimationFrame(update);
    program.uniforms.uTime.value = t * 0.01 * speed * 0.1;
    renderer.render({ scene: mesh });
  }
  rafId = requestAnimationFrame(update);

  // Return cleanup function
  return function cleanup() {
    cancelAnimationFrame(rafId);
    window.removeEventListener("resize", resize);
    if (gl.canvas.parentNode === container) container.removeChild(gl.canvas);
    gl.getExtension("WEBGL_lose_context")?.loseContext();
  };
}