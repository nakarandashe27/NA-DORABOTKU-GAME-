import { buildAtlas, type Atlas } from './atlas';
import { PALETTE, type CellBuffer } from './cells';
import type { Renderer } from './types';

// Одна клетка = один инстанс квада; квад строится из gl_VertexID, данные клетки упакованы в uint:
// glyph (16 бит) | fg (8 бит) << 16 | bg (8 бит) << 24. Глиф читается texelFetch — пиксель в пиксель с атласом.
const VS = `#version 300 es
layout(location = 0) in uint a_cell;
uniform vec2 u_res;
uniform vec2 u_cell;
uniform vec2 u_off;
uniform int u_cols;
uniform int u_perRow;
out vec2 v_local;
flat out ivec2 v_origin;
flat out uint v_fg;
flat out uint v_bg;
void main() {
  vec2 corner = vec2(float(gl_VertexID & 1), float(gl_VertexID >> 1));
  ivec2 cell = ivec2(gl_InstanceID % u_cols, gl_InstanceID / u_cols);
  vec2 px = (vec2(cell) + corner) * u_cell - u_off;
  gl_Position = vec4(px / u_res * 2.0 - 1.0, 0.0, 1.0);
  gl_Position.y = -gl_Position.y;
  int glyph = int(a_cell & 0xFFFFu);
  v_origin = ivec2(glyph % u_perRow, glyph / u_perRow) * ivec2(u_cell);
  v_local = corner * u_cell;
  v_fg = (a_cell >> 16) & 0xFFu;
  v_bg = (a_cell >> 24) & 0xFFu;
}`;

const FS = `#version 300 es
precision highp float;
uniform sampler2D u_atlas;
uniform vec4 u_palette[16];
uniform vec2 u_cell;
in vec2 v_local;
flat in ivec2 v_origin;
flat in uint v_fg;
flat in uint v_bg;
out vec4 color;
void main() {
  ivec2 p = v_origin + ivec2(min(floor(v_local), u_cell - 1.0));
  float a = texelFetch(u_atlas, p, 0).a;
  color = mix(u_palette[v_bg], u_palette[v_fg], a);
}`;

function paletteRgba(): Float32Array {
  const out = new Float32Array(16 * 4);
  PALETTE.forEach((hex, i) => {
    const n = parseInt(hex.slice(1), 16);
    out.set([((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, 1], i * 4);
  });
  return out;
}

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
    gl.enableVertexAttribArray(0);
    gl.vertexAttribIPointer(0, 1, gl.UNSIGNED_INT, 0, 0);
    gl.vertexAttribDivisor(0, 1);
    const tex = gl.createTexture();
    const u = Object.fromEntries(
      ['u_res', 'u_cell', 'u_off', 'u_cols', 'u_perRow', 'u_atlas', 'u_palette'].map((n) => [n, gl.getUniformLocation(prog, n)]),
    );
    gl.useProgram(prog);
    gl.uniform4fv(u['u_palette'] ?? null, paletteRgba());
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
      if (packed.length !== n) packed = new Uint32Array(n);
      for (let i = 0; i < n; i++) {
        packed[i] = ((buf.glyph[i] ?? 0) | ((buf.fg[i] ?? 0) << 16) | ((buf.bg[i] ?? 0) << 24)) >>> 0;
      }
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(...(Array.from(paletteRgba().subarray(0, 4)) as [number, number, number, number]));
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
