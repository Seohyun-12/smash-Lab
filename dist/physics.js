// Ballistic debris and temporary particle lifetimes. Arrays are updated in place.
export function stepDebris(debris, dt) {
 for(let i=debris.length-1;i>=0;i--){const o=debris[i],d=o.userData;d.age+=dt;d.velocity.y-=18*dt;o.position.addScaledVector(d.velocity,dt);o.rotation.x+=d.spin.x*dt;o.rotation.z+=d.spin.z*dt;const ground=Math.min(o.scale.x,o.scale.y,o.scale.z)*.5;if(o.position.y<ground){o.position.y=ground;d.velocity.y=Math.abs(d.velocity.y)*.2;d.velocity.x*=.85;d.velocity.z*=.85;d.spin.multiplyScalar(.8);}if(d.age>5)o.scale.multiplyScalar(Math.max(0,1-dt*2));if(d.age>7){o.removeFromParent();debris.splice(i,1);}}

}

export function stepParticles(particles, dt) {
 for(let i=particles.length-1;i>=0;i--){const p=particles[i],d=p.userData;d.age+=dt;if(d.age>1.8){p.removeFromParent();if(d.line){p.geometry.dispose();p.material.dispose();}particles.splice(i,1);continue;}d.velocity.y-=10*dt;p.position.addScaledVector(d.velocity,dt);if(!d.line)p.scale.setScalar(1-d.age/1.8);}
}
