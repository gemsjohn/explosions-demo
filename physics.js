import * as RAPIER from 'rapier';
import * as THREE from 'three';

let world;
let characterBody;
let rapierLoaded = false;
let ramps = [];
let walls = [];
let platforms = [];

export async function initPhysics() {
    if (!rapierLoaded) {
        await RAPIER.init();
        rapierLoaded = true;
    }

    world = new RAPIER.World({ x: 0.0, y: -19.62, z: 0.0 }); // Doubled gravity for faster falling
    ramps = [];

    createWall({ x: 0, y: 2.5, z: 50 }, { x: 50, y: 5, z: 0.5 }, 0.3, 'wall');
    createWall({ x: 0, y: 2.5, z: -50 }, { x: 50, y: 5, z: 0.5 }, 0.3, 'wall');
    createWall({ x: 50, y: 2.5, z: 0 }, { x: 0.5, y: 5, z: 50 }, 0.3, 'wall');
    createWall({ x: -50, y: 2.5, z: 0 }, { x: 0.5, y: 5, z: 50 }, 0.3, 'wall');

    createPlatform({ x: 0, y: 0, z: 0 }, { x: 50, y: 1, z: 50 }, 0.3, 'platform');

    const spawnPoints = [
        { x: 0, y: 10, z: 0 },
    ];
    const randomIndex = Math.floor(Math.random() * spawnPoints.length);
    const selectedPos = spawnPoints[randomIndex];

    const dx = -selectedPos.x;
    const dz = -selectedPos.z;
    const angle = Math.atan2(dx, dz) + Math.PI;
    const halfAngle = angle / 2;
    const rotation = {
        w: Math.cos(halfAngle),
        x: 0,
        y: Math.sin(halfAngle),
        z: 0
    };

    let characterBodyDesc = RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(selectedPos.x, selectedPos.y, selectedPos.z)
        .setRotation(rotation)
        .setAdditionalMass(1.0)
        .setLinearDamping(0.5) // Reduced from 5.0 to 0.5 for less resistance
        .setAngularDamping(0.2);
    characterBody = world.createRigidBody(characterBodyDesc);
    characterBody.userData = { type: 'character' };

    let characterColliderDesc = RAPIER.ColliderDesc.cuboid(0.5, 1, 0.5)
        .setFriction(0.5)
        .setRestitution(0.0); // No bouncing
    world.createCollider(characterColliderDesc, characterBody);
    world.step();
}

function createWall(position, size, restitution = 0.3, type) {
    let wallDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(position.x, position.y, position.z);
    let wallBody = world.createRigidBody(wallDesc);
    wallBody.userData = { type: 'wall' };
    let wallColliderDesc = RAPIER.ColliderDesc.cuboid(size.x, size.y, size.z)
        .setRestitution(restitution);
    const collider = world.createCollider(wallColliderDesc, wallBody);

    walls.push({
        position: { x: position.x, y: position.y, z: position.z },
        sizes: { x: size.x * 2, y: size.y * 2, z: size.z * 2 },
    });
    return collider;
}

function createPlatform(position, size, restitution = 0.3, type) {
    let platformDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(position.x, position.y, position.z);
    let platformBody = world.createRigidBody(platformDesc);
    platformBody.userData = { type };
    const platformColliderDesc = RAPIER.ColliderDesc.cuboid(size.x, size.y, size.z)
        .setFriction(0.5)
        .setRestitution(restitution);
    const collider = world.createCollider(platformColliderDesc, platformBody);

    platforms.push({
        position: { x: position.x, y: position.y, z: position.z },
        sizes: { x: size.x * 2, y: size.y * 2, z: size.z * 2 },
    });
    return collider;
}

let lastInputs = { w: false, a: false, s: false, d: false };
export function updatePhysics(delta, keys, eventQueue) {
    if (!rapierLoaded || !characterBody) return { position: { x: 0, y: 4, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 }, displaySpeed: 0 };
    lastInputs = { ...keys };

    const maxSpeed = 15; // Reduced to 15 for better control at higher responsiveness
    const turnSpeed = 2; // Increased from 1 to 2 for faster turning
    const acceleration = 50; // Adjusted to 50 for snappier movement
    const friction = 10; // Increased to 10 for quicker stopping

    const currentVel = characterBody.linvel();
    const quat = characterBody.rotation();
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(new THREE.Quaternion(quat.x, quat.y, quat.z, quat.w));
    let speed = forward.dot(new THREE.Vector3(currentVel.x, 0, currentVel.z));

    if (keys.w) {
        speed += acceleration * delta;
        if (speed > maxSpeed) speed = maxSpeed;
    } else if (keys.s) {
        speed -= acceleration * delta;
        if (speed < -maxSpeed) speed = -maxSpeed;
    } else {
        if (speed > 0) {
            speed -= friction * delta;
            if (speed < 0) speed = 0;
        } else if (speed < 0) {
            speed += friction * delta;
            if (speed > 0) speed = 0;
        }
    }

    const velocityVector = forward.multiplyScalar(speed);
    characterBody.setLinvel({ x: velocityVector.x, y: currentVel.y, z: velocityVector.z }, true);

    let angularVelocity = { x: 0, y: 0, z: 0 };
    if (keys.a) angularVelocity.y = turnSpeed * (keys.w || keys.s ? 1.5 : 0.5);
    else if (keys.d) angularVelocity.y = -turnSpeed * (keys.w || keys.s ? 1.5 : 0.5);
    characterBody.setAngvel(angularVelocity, true);

    // Remove additional fall impulse since gravity is stronger now
    world.step(eventQueue, { numSubsteps: 8 });
    const position = characterBody.translation();
    const rotation = characterBody.rotation();
    const displaySpeed = Math.sqrt(currentVel.x * currentVel.x + currentVel.z * currentVel.z);

    return {
        position,
        rotation,
        displaySpeed,
        velocity: { x: currentVel.x, y: currentVel.y, z: currentVel.z },
        ramps,
        walls,
        platforms
    };
}

export { world, characterBody };