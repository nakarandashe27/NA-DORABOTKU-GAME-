import { buildAtlas, type Atlas } from './atlas';
import { BG, type CellBuffer } from './cells';
import type { Renderer } from './types';

// Одна клетка = один инстанс квада; квад строится из gl_VertexID. Данные клетки — два uint:
// a_fg = glyph (8 бит) << 24 | rgb символа; a_bg = rgb фона. Глиф читается texelFetch — пиксель в пиксель с атласом.
const VS = `#version 300 es
layout(location = 0) in uint a_fg;
layout(location = 1) in uint a_bg;
uniform vec2 u_res;
uniform vec2 u_cell;
uniform vec2 u_off;
uniform int u_cols;
uniform int u_perRow;
out vec2 v_local;
flat out ivec2 v_origin;
flat out vec3 v_fg;
flat out vec3 v_bg;
vec3 unpack(uint c) {
  return vec3(float((c >> 16) & 0xFFu), float((c >> 8) & 0xFFu), float(c & 0xFFu)) / 255.0;
}
void main() {
  vec2 corner = vec2(float(gl_VertexID & 1), float(gl_VertexID >> 1));
  ivec2 cell = ivec2(gl_InstanceID % u_cols, gl_InstanceID / u_cols);
  vec2 px = (vec2(cell) + corner) * u_cell - u_off;
  gl_Position = vec4(px / u_res * 2.0 - 1.0, 0.0, 1.0);
  gl_Position.y = -gl_Position.y;
  int glyph = int(a_fg >> 24);
  v_origin = ivec2(glyph % u_perRow, glyph / u_perRow) * ivec2(u_cell);
  v_local = corner * u_cell;
  v_fg = unpack(a_fg);
  v_bg = unpack(a_bg);
}`;

const FS = `#version 300 es
precision highp float;
uniform sampler2D u_atlas;
uniform vec2 u_cell;
in vec2 v_local;
flat in ivec2 v_origin;
flat in vec3 v_fg;
flat in vec3 v_bg;
out vec4 color;
void main() {
  ivec2 p = v_origin + ivec2(min(floor(v_local), u_cell - 1.0));
  float a = texelFetch(u_atlas, p, 0).a;
  color = vec4(mix(v_bg, v_fg, a), 1.0);
}`;

function compile(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const s = gl.createShader(type);
  if (!s) throw new Error('createShader вернул null');
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader');
  return s;
}

interface GlState {
  prog: WebGLProgram;
  vao: WebGLVertexArrayObject;
  cells: WebGLBuffer;
  tex: WebGLTexture;
  u: Record<string, WebGLUniformLocation | null>;
}

/**
 * Основной бэкенд. null — WebGL2 недоступен (тогда app берёт Canvas2D).
 * onLost: контекст потерян и не восстановился за restoreTimeoutMs — app пересоздаёт холст и переходит на Canvas2D.
 */
export function createWebGL2Renderer(
  canvas: HTMLCanvasElement,
  onLost: () => void = () => {},
  restoreTimeoutMs = 3000,
): Renderer | null {
  const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, premultipliedAlpha: false });
  if (!gl) return null;

  let st: GlState | null = null;
  let atlas: Atlas | null = null;
  let packed = new Uint32Array(0);
  let last: { buf: CellBuffer; offX: number; offY: number } | null = null;
  let lostTimer: ReturnType<typeof setTimeout> | undefined;

  const init = (): GlState => {
    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) ?? 'link');
    const vao = gl.createVertexArray();
    const cells = gl.createBuffer();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, cells);
    for (const loc of [0, 1]) {
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribIPointer(loc, 1, gl.UNSIGNED_INT, 8, loc * 4);
      gl.vertexAttribDivisor(loc, 1);
    }
    const tex = gl.createTexture();
    const u = Object.fromEntries(
      ['u_res', 'u_cell', 'u_off', 'u_cols', 'u_perRow', 'u_atlas'].map((n) => [n, gl.getUniformLocation(prog, n)]),
    );
    gl.useProgram(prog);
    gl.uniform1i(u['u_atlas'] ?? null, 0);
    return { prog, vao, cells, tex, u };
  };

  const uploadAtlas = () => {
    if (!st || !atlas) return;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, st.tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas.canvas);
    gl.uniform2f(st.u['u_cell'] ?? null, atlas.cellW, atlas.cellH);
    gl.uniform1i(st.u['u_perRow'] ?? null, atlas.perRow);
  };

  const renderer: Renderer = {
    kind: 'webgl2',
    resize(pxW, pxH, cellW, cellH) {
      canvas.width = pxW;
      canvas.height = pxH;
      if (!atlas || atlas.cellW !== cellW || atlas.cellH !== cellH) {
        atlas = buildAtlas(cellW, cellH);
        uploadAtlas();
      }
    },
    draw(buf, offX = 0, offY = 0) {
      last = { buf, offX, offY };
      if (!st || !atlas || gl.isContextLost()) return;
      const n = buf.cols * buf.rows;
      if (packed.length !== n * 2) packed = new Uint32Array(n * 2);
      for (let i = 0; i < n; i++) {
        packed[i * 2] = (((buf.glyph[i] ?? 0) << 24) | ((buf.fg[i] ?? 0) & 0xffffff)) >>> 0;
        packed[i * 2 + 1] = buf.bg[i] ?? BG;
      }
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(((BG >> 16) & 255) / 255, ((BG >> 8) & 255) / 255, (BG & 255) / 255, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(st.prog);
      gl.bindVertexArray(st.vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, st.cells);
      gl.bufferData(gl.ARRAY_BUFFER, packed, gl.DYNAMIC_DRAW);
      gl.uniform2f(st.u['u_res'] ?? null, canvas.width, canvas.height);
      gl.uniform2f(st.u['u_off'] ?? null, offX, offY);
      gl.uniform1i(st.u['u_cols'] ?? null, buf.cols);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, n);
    },
  };

  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault(); // без этого браузер не пришлёт restored
    st = null;
    lostTimer = setTimeout(onLost, restoreTimeoutMs);
  });
  canvas.addEventListener('webglcontextrestored', () => {
    clearTimeout(lostTimer);
    st = init();
    uploadAtlas();
    if (last) renderer.draw(last.buf, last.offX, last.offY);
  });

  try {
    st = init();
  } catch (err) {
    // Шейдер не собрался на этом устройстве — лучше Canvas2D, чем чёрный экран.
    console.error('WebGL2 init failed, fallback to Canvas2D', err);
    return null;
  }
  return renderer;
}
