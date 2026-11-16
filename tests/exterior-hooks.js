// Injected into the game module by exterior-browser.mjs; never shipped with dist/.
window.__exteriorTest = {
  ready: () => scene.userData.environmentStatus === 'photographic',
  preset(mode) { setCameraMode(mode); focusBuilding('all'); },
  inspect(id,side) {
    focusBuilding(id);
    cameraMode='inspection';
    const building=buildings.find(b=>b.id===id);
    const xs=building.outline.map(p=>p[0]),zs=building.outline.map(p=>p[1]);
    const width=Math.max(...xs)-Math.min(...xs),depth=Math.max(...zs)-Math.min(...zs);
    const base=(side.endsWith('x')?width:depth)/2+15.7;
    const wanted={'+z':0,'-z':Math.PI,'+x':Math.PI/2,'-x':-Math.PI/2}[side];
    let selected=null;
    scene.updateMatrixWorld(true);
    for(const factor of [1,.8,.65]){
      for(const angle of [0,-15,15,-30,30,-45,45]){
        const heading=wanted+angle*Math.PI/180;
        const horizontal=base*factor;
        const candidate=new THREE.Vector3(center.x+Math.sin(heading)*horizontal,1.4,center.z+Math.cos(heading)*horizontal);
        const direction=center.clone().sub(candidate).normalize();
        const hits=new THREE.Raycaster(candidate,direction).intersectObjects(scene.children,true);
        if(hits[0]?.object.userData.buildingId===id){selected={heading,horizontal,candidate};break;}
      }
      if(selected)break;
    }
    selected??={heading:wanted,horizontal:base};
    yaw=selected.heading;
    distance=Math.hypot(selected.horizontal,center.y-1.4);
    pitch=Math.asin((1.4-center.y)/distance);
    camera.fov=72;
    camera.updateProjectionMatrix();
    return {id,side,headingDegrees:yaw*180/Math.PI,eyeHeight:1.4,note:'nearest unoccluded view; reference points may be adjusted within 45 degrees'};
  },
};
