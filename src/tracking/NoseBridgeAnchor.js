import * as THREE from 'three';

/**
 * NoseBridgeAnchor.js
 * Computes a stable 3D anchor point on the surface of the nose bridge
 * rather than relying on a single landmark point.
 * 
 * This implements the Jeeliz method - attaching glasses to the nose bridge
 * surface plane rather than just the nose tip. This prevents the frame from
 * sinking into the face or floating above when tilting.
 */
export function computeAnchor(landmarks) {

  const toVec = (i) => {
      // Map to standard normalized coordinates [-1, 1] relative to center
      // Note: Y is inverted in 3D vs Screen
      const lm = landmarks[i];
      const px = (lm.x - 0.5) * 2;
      const py = -(lm.y - 0.5) * 2;
      // Include Z for depth (negative = towards camera in Three.js)
      const pz = -lm.z || 0;
      return new THREE.Vector3(px, py, pz); 
  };

  // Nose Bridge Triangle (defines the surface plane)
  // 168: Top of nose
  // 193: Left side of bridge
  // 417: Right side of bridge
  const top = toVec(168);
  const left = toVec(193);
  const right = toVec(417);

  // Center of the bridge surface
  const center = new THREE.Vector3()
      .add(top)
      .add(left)
      .add(right)
      .multiplyScalar(1/3);

  // Calculate Surface Normal
  // This vector points "out" of the nose skin
  const v1 = new THREE.Vector3().subVectors(left, top);
  const v2 = new THREE.Vector3().subVectors(right, top);
  const normal = new THREE.Vector3().crossVectors(v1, v2).normalize();

  // Offset the anchor slightly "out" from the skin to prevent clipping
  // This is the key to Jeeliz-style "object worn on head" feel
  center.addScaledVector(normal, 0.055);

  return { position: center, normal: normal };
}
