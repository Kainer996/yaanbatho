// Shared manga treatment for the Academy, villages and towns. Presentation only.
// One colour/depth render and one five-tap ink pass; no duplicated scene geometry.
(function(root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BurbzManga = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';
  var passes = new WeakMap();
  var styled = new WeakSet();
  var CEL = [
    'vec3 mangaDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;',
    'float mangaBase = max(dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722)), 0.025);',
    'float mangaLight = dot(mangaDiffuse, vec3(0.2126, 0.7152, 0.0722)) / mangaBase;',
    // Narrow smooth transitions stop the shadow bands sparkling as the sun moves.
    'float mangaBand = 0.22 + 0.30 * smoothstep(0.30, 0.34, mangaLight)',
    '  + 0.36 * smoothstep(0.66, 0.70, mangaLight)',
    '  + 0.42 * smoothstep(1.16, 1.20, mangaLight);',
    // Preserve actual night darkness and warm emissive windows, even at zero light.
    'mangaBand *= min(1.0, mangaLight / 0.22);',
    'vec3 mangaTint = mix(vec3(0.89, 0.91, 1.08), vec3(1.04, 1.01, 0.94), smoothstep(0.2, 1.0, mangaLight));',
    'outgoingLight += mangaDiffuse * (mangaTint * mangaBand / max(mangaLight, 0.001) - 1.0);'
  ].join('\n');

  function styleMaterial(material) {
    if (!material || styled.has(material) || material.transparent ||
        !(material.isMeshLambertMaterial || material.isMeshStandardMaterial || material.isMeshPhongMaterial)) return false;
    styled.add(material);
    var previous = material.onBeforeCompile;
    var previousKey = material.customProgramCacheKey();
    material.onBeforeCompile = function(shader, renderer) {
      previous.call(this, shader, renderer);
      shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', CEL + '\n#include <opaque_fragment>');
    };
    material.customProgramCacheKey = function() { return previousKey + '|burbz-manga-v356'; };
    material.userData.burbzManga = true;
    material.needsUpdate = true;
    return true;
  }

  function styleScene(scene) {
    var count = 0;
    scene.traverse(function(object) {
      var materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach(function(material) { if (styleMaterial(material)) count++; });
    });
    scene.userData.mangaStyle = { version: 356, materials: count };
    return count;
  }

  function createPass(T, renderer) {
    var hasDepth = renderer.capabilities.isWebGL2 || renderer.extensions.has('WEBGL_depth_texture');
    var pass = { scene: null, target: null, width: 0, height: 0, size: new T.Vector2() };
    // Old WebGL devices still receive cel shading without a depth attachment.
    if (!hasDepth) return pass;
    pass.target = new T.WebGLRenderTarget(1, 1, {
      minFilter: T.LinearFilter, magFilter: T.LinearFilter, depthBuffer: true, stencilBuffer: false
    });
    pass.target.depthTexture = new T.DepthTexture(1, 1, T.UnsignedIntType);
    pass.material = new T.ShaderMaterial({
      depthTest: false, depthWrite: false,
      uniforms: {
        colour: { value: pass.target.texture }, depth: { value: pass.target.depthTexture },
        texel: { value: new T.Vector2(1, 1) }, nearClip: { value: 0.1 }, farClip: { value: 140 }
      },
      vertexShader: 'varying vec2 inkUv; void main() { inkUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: [
        'uniform sampler2D colour; uniform sampler2D depth;',
        'uniform vec2 texel; uniform float nearClip; uniform float farClip; varying vec2 inkUv;',
        '#include <common>', '#include <packing>',
        'float distanceAt(vec2 uv) { return -perspectiveDepthToViewZ(texture2D(depth, uv).x, nearClip, farClip); }',
        'float luminanceAt(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }',
        'void main() {',
        '  vec2 dx = vec2(texel.x, 0.0), dy = vec2(0.0, texel.y);',
        '  vec4 c = texture2D(colour, inkUv);',
        '  vec3 l = texture2D(colour, inkUv - dx).rgb, r = texture2D(colour, inkUv + dx).rgb;',
        '  vec3 u = texture2D(colour, inkUv + dy).rgb, d = texture2D(colour, inkUv - dy).rgb;',
        '  float z = distanceAt(inkUv);',
        // A second difference rejects smooth sloping ground, unlike a depth gradient.
        '  float bend = max(abs(distanceAt(inkUv-dx) + distanceAt(inkUv+dx) - 2.0*z),',
        '                   abs(distanceAt(inkUv-dy) + distanceAt(inkUv+dy) - 2.0*z)) / max(z, 1.0);',
        '  float silhouette = smoothstep(0.015, 0.075, bend);',
        '  float centre = luminanceAt(c.rgb);',
        '  float crease = max(abs(luminanceAt(l+r) - 2.0*centre), abs(luminanceAt(u+d) - 2.0*centre));',
        '  float detail = smoothstep(0.18, 0.48, crease) * 0.38;',
        // Leave the sky and transparent glows alone; coloured ink retains readable night detail.
        '  float ink = max(silhouette, detail) * step(z, farClip * 0.98);',
        '  vec3 paper = mix(c.rgb, (l+r+u+d+c.rgb*4.0)/8.0, silhouette*0.20);',
        '  gl_FragColor = vec4(mix(paper, paper*0.16 + vec3(0.007, 0.006, 0.014), ink*0.88), c.a);',
        '  #include <tonemapping_fragment>',
        '  #include <colorspace_fragment>',
        '}'
      ].join('\n')
    });
    pass.geometry = new T.PlaneGeometry(2, 2);
    pass.quadScene = new T.Scene();
    pass.quadScene.add(new T.Mesh(pass.geometry, pass.material));
    pass.camera = new T.Camera();
    return pass;
  }

  function render(T, renderer, scene, camera) {
    var pass = passes.get(renderer);
    if (!pass) { pass = createPass(T, renderer); passes.set(renderer, pass); }
    if (pass.scene !== scene) { styleScene(scene); pass.scene = scene; }
    if (!pass.target || renderer.getRenderTarget() || !camera.isPerspectiveCamera) {
      renderer.render(scene, camera);
      return;
    }
    renderer.getDrawingBufferSize(pass.size);
    var width = Math.max(1, pass.size.x), height = Math.max(1, pass.size.y);
    if (width !== pass.width || height !== pass.height) {
      pass.target.setSize(width, height);
      pass.width = width; pass.height = height;
    }
    // About one CSS pixel of ink, including at fractional adaptive phone DPR.
    pass.material.uniforms.texel.value.set(renderer.getPixelRatio()/width, renderer.getPixelRatio()/height);
    pass.material.uniforms.nearClip.value = camera.near;
    pass.material.uniforms.farClip.value = camera.far;
    var autoReset = renderer.info.autoReset;
    if (autoReset) renderer.info.reset();
    renderer.info.autoReset = false;
    try {
      renderer.setRenderTarget(pass.target);
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);
      renderer.render(pass.quadScene, pass.camera);
    } finally {
      renderer.setRenderTarget(null);
      renderer.info.autoReset = autoReset;
    }
  }

  function dispose(renderer) {
    var pass = renderer && passes.get(renderer);
    if (!pass) return;
    if (pass.target) { pass.target.depthTexture.dispose(); pass.target.dispose(); pass.material.dispose(); pass.geometry.dispose(); }
    passes.delete(renderer);
  }

  return { render: render, dispose: dispose, styleScene: styleScene, styleMaterial: styleMaterial };
});
