import * as THREE from 'three';

export function createAtmosphere(scene: THREE.Scene) {
  const colors = [
    { at: 0, top: '#afcbd8', horizon: '#f3dfbd', fog: '#d5d6ba', sun: '#ffe0aa', sky: '#e7e6d6', ground: '#737950', intensity: 2.65 },
    { at: .38, top: '#97c9cf', horizon: '#edf0d6', fog: '#ccd7bb', sun: '#ffe6ae', sky: '#ecf0d8', ground: '#66744a', intensity: 3 },
    { at: .72, top: '#afc7cc', horizon: '#f4dcad', fog: '#d5d0a6', sun: '#ffd092', sky: '#ebdfc3', ground: '#716445', intensity: 2.5 },
    { at: 1, top: '#757f9f', horizon: '#ecac80', fog: '#c6ab90', sun: '#ffaf72', sky: '#d5b9ad', ground: '#65574e', intensity: 1.65 },
  ].map(key => ({ ...key, top: new THREE.Color(key.top), horizon: new THREE.Color(key.horizon), fog: new THREE.Color(key.fog), sun: new THREE.Color(key.sun), sky: new THREE.Color(key.sky), ground: new THREE.Color(key.ground) }));
  const overcast = {
    top: new THREE.Color('#9baeb2'), horizon: new THREE.Color('#cbd4c4'),
    cloud: new THREE.Color('#d4dbce'), fog: new THREE.Color('#becbbe'),
    sky: new THREE.Color('#d9e3dc'), ground: new THREE.Color('#697655'), sun: new THREE.Color('#e0e5d9'),
  };
  const sunDirection = new THREE.Vector3(-.42, .63, -.5).normalize();
  scene.background = new THREE.Color('#d4e0cf');
  scene.fog = new THREE.Fog('#ccd7bb', 18, 73);
  const hemi = new THREE.HemisphereLight('#ecf0d8', '#66744a', 2.0); scene.add(hemi);
  const sun = new THREE.DirectionalLight('#ffe6ae', 3.0); sun.position.set(-8, 18, -10);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -15, right: 15, top: 15, bottom: -15, near: 1, far: 65 });
  sun.shadow.normalBias = .035; sun.shadow.bias = -.0001; scene.add(sun, sun.target);
  const ambient = new THREE.AmbientLight('#d9e5e1', .28); scene.add(ambient);
  const sky = new THREE.Mesh(new THREE.SphereGeometry(140, 40, 20), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: { topColor: { value: new THREE.Color('#97c9cf') }, horizonColor: { value: new THREE.Color('#edf0d6') }, sunDirection: { value: sunDirection }, cloudColor: { value: new THREE.Color('#f5f5dc') }, cloudiness: { value: 0 } },
    vertexShader: `varying vec3 vSky; void main(){vSky=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `varying vec3 vSky; uniform vec3 topColor,horizonColor,sunDirection,cloudColor; uniform float cloudiness;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}
      void main(){vec3 d=normalize(vSky);float h=max(d.y,0.);vec3 c=mix(horizonColor,topColor,pow(h,.52));
      vec2 p=d.xz/(max(d.y,.08)+.25)*2.; float n=noise(p)*.65+noise(p*2.1)*.23+noise(p*4.1)*.12;
      float cloud=smoothstep(mix(.55,.20,cloudiness),mix(.79,.68,cloudiness),n)*smoothstep(.015,.3,h);
      c=mix(c,cloudColor,cloud*mix(.52,.87,cloudiness));
      float s=max(dot(d,sunDirection),0.); c+=vec3(1.,.73,.39)*(pow(s,450.)*.7+pow(s,18.)*.16)*(1.-cloudiness*.96);
      gl_FragColor=vec4(c,1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
  })); scene.add(sky);
  return {
    update(_time: number, cameraPosition: THREE.Vector3, uv: boolean, day = .38, cloudiness = 0) {
      day = THREE.MathUtils.clamp(day, 0, 1);
      cloudiness = THREE.MathUtils.clamp(cloudiness, 0, 1);
      const index = Math.min(colors.length - 2, Math.max(0, colors.findIndex(key => key.at >= day) - 1));
      const a = colors[index], b = colors[index + 1], t = THREE.MathUtils.smoothstep(day, a.at, b.at);
      sky.material.uniforms.topColor.value.copy(a.top).lerp(b.top, t).lerp(overcast.top, cloudiness * .9);
      sky.material.uniforms.horizonColor.value.copy(a.horizon).lerp(b.horizon, t).lerp(overcast.horizon, cloudiness * .78);
      sky.material.uniforms.cloudColor.value.copy(a.sky).lerp(b.sky, t).lerp(overcast.cloud, cloudiness);
      sky.material.uniforms.cloudiness.value = cloudiness;
      (scene.fog as THREE.Fog).color.copy(a.fog).lerp(b.fog, t).lerp(overcast.fog, cloudiness * .8);
      (scene.fog as THREE.Fog).near = 18 - cloudiness * 5;
      (scene.fog as THREE.Fog).far = 73 - cloudiness * 16;
      (scene.background as THREE.Color).copy((scene.fog as THREE.Fog).color);
      hemi.color.copy(a.sky).lerp(b.sky, t).lerp(overcast.sky, cloudiness * .85);
      hemi.groundColor.copy(a.ground).lerp(b.ground, t).lerp(overcast.ground, cloudiness * .6);
      sun.color.copy(a.sun).lerp(b.sun, t).lerp(overcast.sun, cloudiness * .88);
      sunDirection.set(-.55 + day * 1.15, .25 + Math.sin(day * Math.PI) * .55, -.5).normalize();
      sun.position.copy(sunDirection).multiplyScalar(28); sun.position.x += cameraPosition.x; sun.position.z += cameraPosition.z;
      sun.target.position.set(cameraPosition.x, 0, cameraPosition.z);
      hemi.intensity = (uv ? 1.3 : 2) * (1 - day * .12) * (1 - cloudiness * .08);
      sun.intensity = THREE.MathUtils.lerp(a.intensity, b.intensity, t) * (uv ? .6 : 1) * (1 - cloudiness * .66);
      sun.shadow.intensity = 1 - cloudiness * .5;
      ambient.intensity = .28 + cloudiness * .06;
    },
    dispose() {
      scene.remove(sky, sun, sun.target, hemi, ambient);
      sky.geometry.dispose(); sky.material.dispose(); sun.shadow.dispose();
    },
  };
}
