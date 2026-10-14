import * as THREE from 'three';

/**
 * What the bee can really see. A few times a second the scene is drawn again into a
 * small, cheap depth image from the bee's own view, with all the real materials (grass
 * blades swaying in the wind, flower heads, leaves, the bee's own legs). A creature
 * counts as visible where nothing nearer stands in front of it in that image: through
 * a gap in the grass it can be seen; behind a blade, a leaf or a flower head it can't.
 * This replaces guessing with rules (a grass "layer", heads as discs) wherever WebGL
 * can do it; the old rules stay as a fallback.
 */
export function createSightDepth(renderer: THREE.WebGLRenderer, height = 144) {
  let width = Math.round(height * 16 / 9);
  const target = new THREE.WebGLRenderTarget(width, height, { depthBuffer: true });
  target.depthTexture = new THREE.DepthTexture(width, height);
  target.depthTexture.type = THREE.UnsignedIntType;
  // A second pass turns the depth buffer into view distance, in a float image we can read back.
  const out = new THREE.WebGLRenderTarget(width, height, { type: THREE.FloatType, format: THREE.RGBAFormat, depthBuffer: false });
  const material = new THREE.ShaderMaterial({
    uniforms: { tDepth: { value: target.depthTexture }, near: { value: .1 }, far: { value: 100 } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }',
    fragmentShader: `#include <packing>
      varying vec2 vUv; uniform sampler2D tDepth; uniform float near; uniform float far;
      void main() { float d = texture2D(tDepth, vUv).x; gl_FragColor = vec4(-perspectiveDepthToViewZ(d, near, far), 0., 0., 1.); }`,
    depthTest: false, depthWrite: false,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  quad.frustumCulled = false;
  const quadScene = new THREE.Scene(); quadScene.add(quad);
  const quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  let pixels = new Float32Array(width * height * 4);
  // The view the image was taken from, so a point is projected exactly as it was drawn.
  const view = new THREE.Matrix4(), viewProjection = new THREE.Matrix4();
  // Reading back a float image needs this WebGL extension; without it the old rules decide.
  let fovTan = 1, ready = false, failed = !renderer.extensions.has('EXT_color_buffer_float');
  const point = new THREE.Vector3(), inView = new THREE.Vector3();

  return {
    /** Draws the depth image from this camera (skip while nothing needs looking for). */
    capture(scene: THREE.Scene, camera: THREE.PerspectiveCamera): void {
      if (failed) return;
      const w = Math.max(16, Math.round(height * camera.aspect));
      if (w !== width) {
        width = w; target.setSize(width, height); out.setSize(width, height);
        pixels = new Float32Array(width * height * 4);
      }
      const previous = renderer.getRenderTarget(), shadows = renderer.shadowMap.autoUpdate;
      try {
        // The shadows were just drawn for the real frame: don't draw them again.
        renderer.shadowMap.autoUpdate = false;
        renderer.setRenderTarget(target); renderer.render(scene, camera);
        material.uniforms.near.value = camera.near; material.uniforms.far.value = camera.far;
        renderer.setRenderTarget(out); renderer.render(quadScene, quadCamera);
        renderer.readRenderTargetPixels(out, 0, 0, width, height, pixels);
        view.copy(camera.matrixWorldInverse);
        viewProjection.multiplyMatrices(camera.projectionMatrix, view);
        fovTan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
        ready = true;
      } catch {
        failed = true; ready = false;
      } finally {
        renderer.shadowMap.autoUpdate = shadows;
        renderer.setRenderTarget(previous);
      }
    },
    /** The share (0–1) of a creature's spot on screen with nothing nearer in front of it,
     * or -1 when there is no depth image to ask (then the old rules decide). */
    visible(at: THREE.Vector3, size: number): number {
      if (!ready) return -1;
      point.copy(at).applyMatrix4(viewProjection);
      if (point.z < -1 || point.z > 1 || Math.abs(point.x) > 1 || Math.abs(point.y) > 1) return 0;
      const depth = -inView.copy(at).applyMatrix4(view).z;
      if (depth <= 0) return 0;
      const cx = Math.floor((point.x * .5 + .5) * width), cy = Math.floor((point.y * .5 + .5) * height);
      // How many pixels across it is in this small image: look over that spot (at most 3 out).
      const across = size / depth * (height / 2) / fovTan;
      const r = Math.max(0, Math.min(3, Math.round(across / 2)));
      // Its own front surface sits a little nearer than its middle.
      const slack = size * .8 + .03;
      let clear = 0, total = 0;
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        const x = cx + dx, y = cy + dy;
        if (x < 0 || y < 0 || x >= width || y >= height) continue;
        total++;
        if (pixels[(y * width + x) * 4] >= depth - slack) clear++;
      }
      return total ? clear / total : 0;
    },
    get ready() { return ready; },
    dispose() { target.depthTexture?.dispose(); target.dispose(); out.dispose(); material.dispose(); quad.geometry.dispose(); },
  };
}
