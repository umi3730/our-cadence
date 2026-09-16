'use client';

import { useEffect, useRef, useState } from 'react';
import { simplex3D } from '@/vendor/simplex-noise-3d';

const vertexSource = `
attribute vec2 a_position;
void main() { gl_Position = vec4(a_position, 0.0, 1.0); }
`;

const fragmentSource = `
precision highp float;
uniform vec2 u_resolution;
uniform float u_time;
${simplex3D}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec2 p = (uv - 0.5) * vec2(u_resolution.x / u_resolution.y, 1.0);
  float t = u_time * 0.12;

  // Continuous 3D simplex noise: time is the third coordinate.
  // Low-frequency domain warping keeps the mist broad and softly irregular.
  vec2 warp = vec2(
    snoise(vec3(p * 1.15 + 2.3, t * 0.65)),
    snoise(vec3(p * 1.15 - 4.1, t * 0.65 + 8.0))
  );
  vec2 flowing = p * 1.8 + warp * 0.42 + vec2(t * 0.22, -t * 0.12);
  float cloud = snoise(vec3(flowing, t));
  float detail = snoise(vec3(flowing * 1.9 + 6.2, t * 0.8));
  float mist = smoothstep(-0.65, 0.75, cloud * 0.8 + detail * 0.2);

  vec3 cream = vec3(251.0, 249.0, 243.0) / 255.0;
  vec3 champagne = vec3(234.0, 216.0, 171.0) / 255.0;
  vec3 apricot = vec3(242.0, 229.0, 207.0) / 255.0;
  float tint = smoothstep(-0.5, 0.6, detail);
  vec3 fog = mix(apricot, champagne, tint);

  // Keep the heading and description quieter than the edges.
  float edge = smoothstep(0.12, 0.62, length((uv - vec2(0.5, 0.52)) * vec2(1.15, 0.9)));
  float strength = (0.16 + edge * 0.72) * (0.2 + mist * 0.8);
  gl_FragColor = vec4(mix(cream, fog, strength), 1.0);
}
`;

export function SimplexBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [contextVersion, setContextVersion] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext('webgl', { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' });
    if (!gl) return; // The CSS background remains available without WebGL.

    const shaders: WebGLShader[] = [];
    let program: WebGLProgram | null = null;
    let buffer: WebGLBuffer | null = null;
    const dispose = () => {
      shaders.forEach(shader => gl.deleteShader(shader));
      if (buffer) gl.deleteBuffer(buffer);
      if (program) gl.deleteProgram(program);
    };
    const compile = (type: number, source: string) => {
      const shader = gl.createShader(type);
      if (!shader) throw new Error('Unable to allocate background shader');
      shaders.push(shader);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) || 'Background shader compilation failed');
      return shader;
    };

    try {
      program = gl.createProgram();
      if (!program) throw new Error('Unable to allocate background program');
      gl.attachShader(program, compile(gl.VERTEX_SHADER, vertexSource));
      gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragmentSource));
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) || 'Background shader linking failed');
      gl.useProgram(program);
      buffer = gl.createBuffer();
      if (!buffer) throw new Error('Unable to allocate background buffer');
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const position = gl.getAttribLocation(program, 'a_position');
      gl.enableVertexAttribArray(position);
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    } catch (error) {
      console.warn('Simplex background is using its static fallback.', error);
      dispose();
      return;
    }

    const resolution = gl.getUniformLocation(program, 'u_resolution');
    const time = gl.getUniformLocation(program, 'u_time');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    let lastFrame = 0;
    let elapsed = 18;
    let lost = false;

    const draw = () => {
      gl.uniform2f(resolution, canvas.width, canvas.height);
      gl.uniform1f(time, elapsed);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      canvas.dataset.ready = 'true';
    };
    const resize = () => {
      if (lost) return;
      // Soft mist needs no retina-sized rendering; bound the GPU workload.
      const scale = Math.min(0.75, 1280 / window.innerWidth, 900 / window.innerHeight);
      canvas.width = Math.max(1, Math.round(window.innerWidth * scale));
      canvas.height = Math.max(1, Math.round(window.innerHeight * scale));
      gl.viewport(0, 0, canvas.width, canvas.height);
      draw();
    };
    const tick = (now: number) => {
      if (now - lastFrame >= 1000 / 30) {
        if (lastFrame) elapsed += Math.min((now - lastFrame) / 1000, 0.25);
        lastFrame = now;
        draw();
      }
      frame = requestAnimationFrame(tick);
    };
    const updateMotion = () => {
      cancelAnimationFrame(frame);
      lastFrame = 0;
      if (lost || document.hidden) return;
      draw();
      if (!reducedMotion.matches) frame = requestAnimationFrame(tick);
    };
    const contextLost = (event: Event) => {
      event.preventDefault();
      lost = true;
      cancelAnimationFrame(frame);
      delete canvas.dataset.ready;
    };
    const contextRestored = () => setContextVersion(version => version + 1);

    resize();
    updateMotion();
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', updateMotion);
    reducedMotion.addEventListener('change', updateMotion);
    canvas.addEventListener('webglcontextlost', contextLost);
    canvas.addEventListener('webglcontextrestored', contextRestored);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', updateMotion);
      reducedMotion.removeEventListener('change', updateMotion);
      canvas.removeEventListener('webglcontextlost', contextLost);
      canvas.removeEventListener('webglcontextrestored', contextRestored);
      delete canvas.dataset.ready;
      dispose();
    };
  }, [contextVersion]);

  return <div className="simplex-background" aria-hidden="true"><canvas ref={canvasRef} /></div>;
}
