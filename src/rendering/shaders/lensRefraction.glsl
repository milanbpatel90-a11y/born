/**
 * lensRefraction.glsl
 * 
 * Optional shader for realistic lens refraction effects
 */

// Vertex shader
const vertexShader = `
varying vec3 vWorldPosition;
varying vec3 vViewPosition;
varying vec3 vNormal;

void main() {
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  vViewPosition = -mvPosition.xyz;
  vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
  vNormal = normalize(normalMatrix * normal);
  
  gl_Position = projectionMatrix * mvPosition;
}
`;

// Fragment shader
const fragmentShader = `
uniform float refractionRatio;
uniform float fresnelBias;
uniform float fresnelScale;
uniform float fresnelPower;
uniform vec3 tint;

varying vec3 vWorldPosition;
varying vec3 vViewPosition;
varying vec3 vNormal;

void main() {
  vec3 normal = normalize(vNormal);
  vec3 viewDirection = normalize(vViewPosition);
  
  // Fresnel effect
  float fresnel = fresnelBias + fresnelScale * pow(1.0 + dot(viewDirection, normal), fresnelPower);
  
  // Refraction
  vec3 refracted = refract(viewDirection, normal, refractionRatio);
  
  // Combine with tint
  vec3 finalColor = mix(tint, vec3(1.0), fresnel);
  
  gl_FragColor = vec4(finalColor, 0.3 + fresnel * 0.4);
}
`;

export { vertexShader, fragmentShader };
