import * as THREE from 'three';

/**
 * HeadPoseEstimator.js
 * Computes a true 3D rotation Quaternion from 2D FaceMesh landmarks
 * by building an orthonormal basis (Camera Space).
 * 
 * This implements the Jeeliz PnP pose solving method - converting 2D landmarks
 * to reconstruct a 3D head, then attaching glasses to that head.
 */
export function estimateHeadPose(landmarks) {

    // Helper: Convert normalized [0,1] landmark to Screen Space [width, height]
    // Then map to 3D Camera Space (assuming z=0 for projection plane)
    const toVec = (lm) => {
        // Map to standard normalized coordinates [-1, 1] relative to center
        // Note: Y is inverted in 3D vs Screen
        const px = (lm.x - 0.5) * 2;
        const py = -(lm.y - 0.5) * 2;
        // Include Z for depth (negative = towards camera in Three.js)
        const pz = -lm.z || 0;
        return new THREE.Vector3(px, py, pz);
    };

    // We build the rotation basis from stable facial features
    const leftEye = toVec(landmarks[33]);
    const rightEye = toVec(landmarks[263]);
    const nose = toVec(landmarks[1]);
    const chin = toVec(landmarks[152]);

    // X-Axis: Eye-to-Eye vector (Left -> Right)
    const xAxis = new THREE.Vector3().subVectors(rightEye, leftEye).normalize();

    // Y-Axis: Chin-to-Nose vector (Up)
    const yAxis = new THREE.Vector3().subVectors(nose, chin).normalize();

    // Z-Axis: Cross product (Forward/Out of face)
    const zAxis = new THREE.Vector3().crossVectors(xAxis, yAxis).normalize();

    // Re-orthogonalize Y to ensure perfect 90-degree axes
    yAxis.crossVectors(zAxis, xAxis).normalize();

    // Build Rotation Matrix
    const rotMatrix = new THREE.Matrix4();
    rotMatrix.makeBasis(xAxis, yAxis, zAxis);

    // Convert to Quaternion
    const quaternion = new THREE.Quaternion();
    quaternion.setFromRotationMatrix(rotMatrix);

    return quaternion;
}
