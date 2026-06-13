/* ============================================================
   Stitch Aurora WebGL Shader Background
   Diambil dari design Stitch — Midnight Aurora theme
   ============================================================ */
function AuroraShader() {
  const canvasRef = React.useRef(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    function syncSize() {
      const w = canvas.clientWidth || 1280;
      const h = canvas.clientHeight || 720;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w; canvas.height = h;
      }
    }
    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(syncSize);
      ro.observe(canvas);
    }
    syncSize();

    const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    if (!gl) return;

    const vs = `attribute vec2 a_position;
varying vec2 v_texCoord;
void main() {
  v_texCoord = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;

    const fs = `precision highp float;
varying vec2 v_texCoord;
uniform float u_time;
uniform vec2 u_resolution;
uniform vec2 u_mouse;

const vec3 color1 = vec3(0.02, 0.08, 0.14);
const vec3 color2 = vec3(0.0,  0.86, 0.95);
const vec3 color3 = vec3(0.38, 0.15, 0.58);
const vec3 color4 = vec3(0.05, 0.22, 0.42);

float noise(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}
float smoothNoise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = noise(i); float b = noise(i + vec2(1.0, 0.0));
  float c = noise(i + vec2(0.0, 1.0)); float d = noise(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float fbm(vec2 p) {
  float v = 0.0; float a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * smoothNoise(p); p *= 2.0; a *= 0.5; }
  return v;
}
void main() {
  vec2 uv = v_texCoord;
  vec2 p = uv * 2.0 - 1.0;
  p.x *= u_resolution.x / u_resolution.y;
  float t = u_time * 0.15;
  float n1 = fbm(p * 0.5 + t);
  float n2 = fbm(p * 0.8 - t * 0.8);
  float aurora = pow(0.8 - abs(p.y - 0.2 + n1 * 0.5), 4.0);
  aurora += pow(0.7 - abs(p.y + 0.3 + n2 * 0.4), 3.0);
  vec3 finalColor = color1;
  finalColor = mix(finalColor, color2, aurora * n1 * 0.7);
  finalColor = mix(finalColor, color3, aurora * 0.5 * n2 * 0.6);
  finalColor = mix(finalColor, color4, n1 * 0.25);
  float grain = noise(uv * 1000.0 + u_time) * 0.025;
  finalColor += grain;
  gl_FragColor = vec4(finalColor, 1.0);
}`;

    function cs(type, src) {
      const s = gl.createShader(type);
      gl.shaderSource(s, src); gl.compileShader(s); return s;
    }
    const prog = gl.createProgram();
    gl.attachShader(prog, cs(gl.VERTEX_SHADER, vs));
    gl.attachShader(prog, cs(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(prog); gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
    const pos = gl.getAttribLocation(prog, "a_position");
    gl.enableVertexAttribArray(pos);
    gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);

    const uTime  = gl.getUniformLocation(prog, "u_time");
    const uRes   = gl.getUniformLocation(prog, "u_resolution");
    const uMouse = gl.getUniformLocation(prog, "u_mouse");

    let mouse = { x: canvas.width / 2, y: canvas.height / 2 };
    const onMove = (e) => {
      const r = canvas.getBoundingClientRect();
      mouse.x = ((e.clientX - r.left) / r.width) * canvas.width;
      mouse.y = (1 - (e.clientY - r.top) / r.height) * canvas.height;
    };
    window.addEventListener("mousemove", onMove);

    let raf;
    function render(t) {
      syncSize();
      gl.viewport(0, 0, canvas.width, canvas.height);
      if (uTime)  gl.uniform1f(uTime, t * 0.001);
      if (uRes)   gl.uniform2f(uRes, canvas.width, canvas.height);
      if (uMouse) gl.uniform2f(uMouse, mouse.x, mouse.y);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      raf = requestAnimationFrame(render);
    }
    raf = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", onMove);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
      style={{ display: "block", zIndex: 0 }}
    />
  );
}
window.AuroraShader = AuroraShader;
