// TODO: 
//  [X] make option key rotate the room, and remove Orbit
//  [X] make section line properly dashed
//  [X] figure out how to make the plane semitransparent with a semi-transparent dotted texture
//  [X] prevent mishaps when cursor leaves the window entirely. (how will this interact with dragging?)
//  [X] put in jsmodeler and draw section line around that.
//  [ ] support dragging of objects: http://stackoverflow.com/questions/22521982/js-check-if-point-inside-a-polygon
//  [ ] allow you to grab edges and faces and drag them: update the model
//  [ ] fix cursor offset bugs: try new algo where i just move based on mouse movesn
//  [ ] when plane moved and room rotated, use projection vector to calculate how much to move plane, see
//      https://en.wikipedia.org/wiki/Vector_projection
//      http://stackoverflow.com/questions/27409074/three-js-converting-3d-position-to-2d-screen-position-r69
//  [ ] make cursor look more like the old cursor
//  
//  [ ] restore the rotate tool
//  [ ] restore booleans
//  [ ] restore snapping of faces to other faces
//  [ ] restore the tool chests
//  [ ] investigate sprite labels: https://stemkoski.github.io/Three.js/Labeled-Geometry.html
//  [ ] look at CSG plugin https://github.com/chandlerprall/ThreeCSG/

// http://jsfiddle.net/hbt9c/317/

// basic threejs tutorial: https://manu.ninja/webgl-3d-model-viewer-using-three-js

var parent;
var plane;
var crosshair;
var primitive;
var JSMprimitive;
var controls;
var vertices;
var faces;
var highlight;
var movingCutplane = false;
var startCursorPauseTime;
var wasMovingPlane = false;
var wasRotatingRoom = false;
var cursorAdjust =  { x: 0, y: 0 };
var cursorPreMove = { x: 0, y: 0 };
var rotatingRoom = true;
var roomRotateX = Math.PI/8;
var roomRotateY = Math.PI/4;
var cutSections;

var cursor = { current: {x:0, y:0}, last: {x:0,y:0} };
var RAD_TO_DEG = 180 / Math.PI;
var DEG_TO_RAD = Math.PI / 180;

var lineMaterial = new THREE.LineBasicMaterial({
  color: 0xffffff
});

var sectionMaterialDashed = new THREE.LineDashedMaterial({
  color: 0xffff00,
  dashSize: .02,
  gapSize: .02,
  linewidth: 1,
  depthTest: false, // so that we can always see the section line
  depthWrite: false,
  depthFunc: THREE.AlwaysDepth
});

// -------------------------------------------------------------------------------------------------------------
// Setup
// -------------------------------------------------------------------------------------------------------------


document.onmousemove = function(e){
  cursor.last.x = cursor.current.x; 
  cursor.last.y = cursor.current.y;
  cursor.current.x = e.pageX;
  cursor.current.y = e.pageY;
  //  debugText(['Cursor ', 'X:', e.pageX, 'Y:', e.pageY,  window.innerWidth, window.innerHeight]);
}

function handleMouseOut(e) {
  console.log('leaving window');
  window.cmdKeyPressed = false;
  window.optionKeyPressed = false;
  movingCutplane = false;
  rotatingRoom = false;
}

function handleMouseEnter(e) {
  console.log('welcome back');
}

document.body.addEventListener("mouseout", handleMouseOut, false);
document.body.addEventListener("mouseenter", handleMouseEnter, false);


function handleKeyDown(event) {
  console.log('key pressed:', event.keyCode);
  switch (event.keyCode) {
    case 18:
      window.optionKeyPressed = true;
      break;
    case 17:
    case 91:
    case 93:
    case 224:
      window.cmdKeyPressed = true;
      break;
    case 75:
      break;
    case 76:
      break;
  }
}

function handleKeyUp(event) {
  switch (event.keyCode) {
    case 18:
      window.optionKeyPressed = false;
      break;
    case 17:
    case 91:
    case 93:
    case 224:
      window.cmdKeyPressed = false;
      break;
    case 75:
      break;
    case 76:
      break;
  }
}

window.addEventListener('keydown', handleKeyDown, false);
window.addEventListener('keyup', handleKeyUp, false);

// -------------------------------------------------------------------------------------------------------------

// http://stackoverflow.com/questions/849211/shortest-distance-between-a-point-and-a-line-segment
// sqrt call is slow
// Also cf: http://www.alecjacobson.com/weblog/?p=1486

function sqr(x) { return x * x }
function dist2(v, w) { return sqr(v.x - w.x) + sqr(v.y - w.y) }
function distToSegmentSquared(p, v, w) {
  var l2 = dist2(v, w);
  if (l2 == 0) { 
    return { nearestPoint: v, distance: dist2(p, v) };
  }
  var t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  var nearestPoint = { x: v.x + t * (w.x - v.x),
                       y: v.y + t * (w.y - v.y) };
  var nearestRecord = {
    nearestPoint: nearestPoint,
    distance: dist2(p, nearestPoint)
  };
  //console.log('nearestRecord, dist:', nearestRecord.distance, 'X:', nearestRecord.nearestPoint.x, 'Y:', nearestRecord.nearestPoint.y);
  return ( nearestRecord );
}

function distToSegment(p, v, w) { 
  var dss = distToSegmentSquared(p,v,w);
  return Math.sqrt(dss.distance); 
}


function setupHelp() {
  var text2 = document.createElement('div');
  text2.style.position = 'absolute';
  //text2.style.zIndex = 1;    // if you still don't see the label, try uncommenting this
  text2.className = "instructions";
  text2.innerHTML = "Hold down Option key to move Cutplane.<br>Hold down command key to rotate room.<br>Mouse near faces to modify shapes."
  document.body.appendChild(text2);

  /* Status */
  text3 = document.createElement('div');
  text3.style.position = 'absolute';
  //text2.style.zIndex = 1;    // if you still don't see the label, try uncommenting this
  text3.className = "status";
  text3.innerHTML = "status";
  document.body.appendChild(text3);
  
}

function debugText(displayArray) {
  text3.innerHTML = displayArray.join('<br>');
}

function setupLights() {
  var dirLight = new THREE.DirectionalLight(0xffffff, 1);
  dirLight.position.set(100, 100, 50);
  scene.add(dirLight);
  var light = new THREE.AmbientLight( 0xfffff ); // soft white light
  scene.add( light );
}

function setupCutplane() {
  var loader = new THREE.TextureLoader;
  loader.crossOrigin = '';

  //var material = new THREE.MeshLambertMaterial({color: 0x5555ff, transparent: true, opacity: 0.95, side: THREE.DoubleSide });
  var texture = new THREE.TextureLoader().load( "images/texture4x4.png" );
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set( 512,512);

  var material = new THREE.MeshLambertMaterial({map: texture, transparent:true });
  var shape = new THREE.Shape();
  shape.moveTo(-1,-1,0);
  shape.lineTo(1,-1,0);
  shape.lineTo(1,1,0);
  shape.lineTo(-1,1,0);
  shape.lineTo(-1,-1,0);

  plane = new THREE.Object3D();

  var geometry = new THREE.ShapeGeometry( shape );
  planeTexture = new THREE.Mesh( geometry, material ) ;
  plane.add(planeTexture);
  /* hack */

  var planeBorder = new THREE.Line( geometry, lineMaterial);
  planeBorder.position.z = plane.position.z;
  plane.add(planeBorder);

  plane.position.z = -0.22;
  parent.add(plane);
}

function setupCrosshair() {
  var material = new THREE.LineBasicMaterial({
    color: 0xff0000,
    depthTest: true,
    depthWrite: true,
    depthFunc: THREE.AlwaysDepth
  });
  var crosshairLines = new THREE.Geometry();
  var crosshairSize = 0.1, crosshairZoffset = 0.01;
  crosshairLines.vertices.push(
    new THREE.Vector3 ( 0,    -crosshairSize, crosshairZoffset),
    new THREE.Vector3 ( 0,    0,              crosshairZoffset),
    new THREE.Vector3 ( -crosshairSize, 0,    crosshairZoffset),
    new THREE.Vector3 ( 0,    0,              crosshairZoffset),
    new THREE.Vector3 ( 0,     crosshairSize, crosshairZoffset),
    new THREE.Vector3 ( 0,    0,              crosshairZoffset),
    new THREE.Vector3 ( crosshairSize, 0,    crosshairZoffset)
  );
  crosshair = new THREE.Line( crosshairLines, material );
  crosshair.position.x = 0; 
  crosshair.position.y = 0;
  plane.add(crosshair);
  
}

function setupRoom() {

  var walls = new THREE.Geometry();
  walls.vertices.push(
    new THREE.Vector3( -1, -1, -1 ),
    new THREE.Vector3( 1, -1, -1 ),
    new THREE.Vector3( 1, 1, -1 ),
    new THREE.Vector3( -1, 1, -1 ),
    new THREE.Vector3( -1, -1, -1 ),

    new THREE.Vector3( -1, -1, 1 ),
    new THREE.Vector3( 1, -1, 1 ),
    new THREE.Vector3( 1, 1, 1 ),
    new THREE.Vector3( -1, 1, 1 ),
    new THREE.Vector3( -1, -1, 1 )
  );

  var line = new THREE.Line( walls, lineMaterial );
  parent.add( line );

  walls = new THREE.Geometry();
  walls.vertices.push(
    new THREE.Vector3( -1, 1, 1 ),
    new THREE.Vector3( -1, 1, -1 )
  );

  line = new THREE.Line( walls, lineMaterial );
  parent.add( line );

  walls = new THREE.Geometry();
  walls.vertices.push(
    new THREE.Vector3( 1, 1, 1 ),
    new THREE.Vector3( 1, 1, -1 )
  );

  line = new THREE.Line( walls, lineMaterial );
  parent.add( line );

  walls = new THREE.Geometry();
  walls.vertices.push(
    new THREE.Vector3( 1, -1, 1 ),
    new THREE.Vector3( 1, -1, -1 )
  );

  line = new THREE.Line( walls, lineMaterial );
  parent.add( line );

}

function setupPrimitive() {
  var cubeSize = 0.25;
  vertices = [
    new THREE.Vector3(-cubeSize, -cubeSize, -cubeSize ), // four vertices of back face
    new THREE.Vector3( cubeSize, -cubeSize, -cubeSize ),
    new THREE.Vector3( cubeSize,  cubeSize, -cubeSize ),
    new THREE.Vector3(-cubeSize,  cubeSize, -cubeSize ),

    new THREE.Vector3(-cubeSize, -cubeSize,  cubeSize ), // four vertices of front face
    new THREE.Vector3( cubeSize, -cubeSize,  cubeSize ),
    new THREE.Vector3( cubeSize,  cubeSize,  cubeSize ),
    new THREE.Vector3(-cubeSize,  cubeSize,  cubeSize )
  ];
  faces = [
    [ 0, 1, 2, 3 ], // back face
    [ 4, 5, 6, 7 ], // front face
    [ 2, 3, 7, 6 ], // top face
    [ 0, 1, 5, 4 ], // bottom face
    [ 3, 0, 4, 7 ], // left side face
    [ 2, 6, 5, 1 ]  // right side face
  ];
  var side, face, geometry, poly;
  // render all edges
  for (var i = 0; i < faces.length; ++i) {
    side = new THREE.Geometry();
    face = faces[i];
    for (var j = 0; j < face.length; ++j) {
      side.vertices.push(
        new THREE.Vector3(vertices[face[j]].x,vertices[face[j]].y,vertices[face[j]].z)
      );
    }
    side.vertices.push(
      new THREE.Vector3(vertices[face[0]].x,vertices[face[0]].y,vertices[face[0]].z)
    );
    poly = new THREE.Line(side, lineMaterial);
    parent.add(poly);


// Hack testing/ demo part

/*
    var lineGeometry = new THREE.Geometry();
    var vertArray = lineGeometry.vertices;
    vertArray.push( new THREE.Vector3(-100, -100, 0), new THREE.Vector3(100, 100, 0) );
    lineGeometry.computeLineDistances();
    var lineMaterial = new THREE.LineDashedMaterial( { color: 0x00cc00, dashSize: .03, gapSize: .03, linewidth: 1 } );
    var line = new THREE.Line( lineGeometry, lineMaterial );
    scene.add(line);


    var cubeSize = 0.15;
    var geometry = new THREE.BoxGeometry( cubeSize, cubeSize, cubeSize );
    var material = new THREE.MeshPhongMaterial( { 
      color: 0x0000ff, 
      side: THREE.DoubleSide, 
      opacity: 1.0 
    } );
    primitive = new THREE.Mesh( geometry, material );
    //primitive.position.x = 1.7;
    parent.add(primitive);

*/
  }

}

function setupJSModel() {
  var cubeSize = 0.45;
  var pieRadius = 0.45;
  //jsmPrimitive = new JSM.GenerateCuboid (cubeSize, cubeSize, cubeSize);
  // radius, height, angle, segmentation, withTopAndBottom, isCurved
  //jsmPrimitive = new JSM.GeneratePie (pieRadius, 0.5, 270 * DEG_TO_RAD, 200, true,false);
  jsmPrimitive = JSM.GenerateTorus (pieRadius, 0.25, 50, 50, true);

  var materialSet = new JSM.MaterialSet ();
  materialSet.AddMaterial (new JSM.Material ({
    ambient : 0xffffff,
    diffuse : 0x3333ff
  }));
  for (var i = 0; i < jsmPrimitive.polygons.length; ++i) {
    jsmPrimitive.GetPolygon(i).SetMaterialIndex(0);
  }

  //var rotation = JSM.RotationZTransformation (90.0 * JSM.DegRad);
  var rotation = JSM.RotationXTransformation (-15.0 * JSM.DegRad);
  var rotation = JSM.RotationXTransformation (-90.0 * JSM.DegRad);

  var transformation = new JSM.Transformation ();
  transformation.Append (rotation);
  jsmPrimitive.Transform (transformation);

  var meshes = JSM.ConvertBodyToThreeMeshes (jsmPrimitive, materialSet);
  parent.add(meshes[0]);
}

function setupHighlight() {
  var radius = 0.04;
  var geometry = new THREE.CircleGeometry(radius,20);
  var material = new THREE.MeshBasicMaterial( { 
    color: 0xff0000,
    depthTest: false, // so that we can always see the section line
    depthWrite: false,
    depthFunc: THREE.AlwaysDepth,
    side: THREE.DoubleSide, 
    opacity: 1.0 } );
  highlight = new THREE.Mesh( geometry, material );
  parent.add(highlight);
}

function setupLineSegment() {
  var material = new THREE.LineBasicMaterial({
    color: 0xffffff
  });
  var P0 = new THREE.Vector3(0,0,0);
  var P1 = new THREE.Vector3(1,0.25,1);
  var segment = new THREE.Geometry();
  segment.vertices.push(P0,P1);
  var line = new THREE.Line(segment, material);
  parent.add(line);
}

function intersectLineWithPlane(P0, P1, planeZ) {
  var n =  new THREE.Vector3(0,0,1); // normal vector to cutplane
  var u = new THREE.Vector3();
  u.copy(P1);
  u = u.sub(P0);
  //console.log('u:', u);
  var nDotU = n.dot(u);
  //console.log('nDotU:', nDotU);
  var V0 = new THREE.Vector3(0,0,plane.position.z); // point on the plane
  var V0MinusP0 = new THREE.Vector3();
  V0MinusP0.copy(V0);
  V0MinusP0.sub(P0);
  var nDotV0MinusP0 = n.dot(V0MinusP0);
  //console.log('nDotV0MinusP0:', nDotV0MinusP0);
  var s1 = (nDotV0MinusP0  / nDotU);
  //console.log('s1:' , s1);
  if ((s1 >= 0.0) && (s1 <= 1.0)) {
    var intersectPoint = new THREE.Vector3();
    intersectPoint.copy(P0);
    var offset = u.multiplyScalar(s1);
    intersectPoint.add(offset);
    return({intersected: true,
            intersectPoint: intersectPoint
    });
  } else {
    return({intersected: false});
  }
}


// http://geomalgorithms.com/a05-_intersect-1.html
function drawSectionLine() {
  var P0, P1;
  var cutSection = new THREE.Geometry();
  var sectionExists = false;
  var faceLen;
  var sectionPoints = [];
  for (var i = 0; i < faces.length; ++i) {
    face = faces[i];
    faceLen = face.length;
    for (var j = 0; j < faceLen - 1; ++j) {
      P0 = new THREE.Vector3(vertices[face[j]].x,vertices[face[j]].y,vertices[face[j]].z);
      P1 = new THREE.Vector3(vertices[face[j + 1]].x,vertices[face[j + 1]].y,vertices[face[j + 1]].z);
      var intersection = intersectLineWithPlane(P0, P1, plane.position.z);
      if (intersection.intersected) {
        sectionExists = true;
        cutSection.vertices.push(
          new THREE.Vector3(intersection.intersectPoint.x,intersection.intersectPoint.y,intersection.intersectPoint.z + 0.01)
        );
        sectionPoints.push(intersection.intersectPoint);
      }
    }
    P0 = new THREE.Vector3(vertices[face[faceLen - 1]].x,vertices[face[faceLen - 1 ]].y,vertices[face[faceLen - 1]].z);
    P1 = new THREE.Vector3(vertices[face[0]].x,vertices[face[0]].y,vertices[face[0]].z);
    var intersection = intersectLineWithPlane(P0, P1, plane.position.z);
    if (intersection.intersected) {
      sectionExists = true;
      cutSection.vertices.push(
        new THREE.Vector3(intersection.intersectPoint.x,intersection.intersectPoint.y,intersection.intersectPoint.z + 0.01)
      );
      sectionPoints.push(intersection.intersectPoint);
    }
    parent.remove(sectionPoly);
    if (sectionExists) {
      //console.log('we will draw a section line');
      cutSection.computeLineDistances(); // Required for dashed lines cf http://stackoverflow.com/questions/35781346/three-linedashedmaterial-dashes-dont-work
      sectionPoly = new THREE.Line(cutSection, sectionMaterialDashed);
      parent.add(sectionPoly);

      var nearestMin = 1e10, highlightCenter = { x: -1e10, y:-1e10 };
      for (var k = 0; k < sectionPoints.length - 1; ++k) {
        var nearest = distToSegmentSquared(crosshair.position,sectionPoints[k], sectionPoints[k+1]);
        if ((nearest.distance < nearestMin) && (nearest.distance < 0.005)) {
          nearestMin = nearest.distance;
          highlightCenter.x = nearest.nearestPoint.x;
          highlightCenter.y = nearest.nearestPoint.y;
        }          
      }
      highlight.position.x = highlightCenter.x;
      highlight.position.y = highlightCenter.y;
      highlight.position.z = plane.position.z + 0.01;
    }
  }
}

function drawSectionLineJSM() {
  var P0, P1;
  var sectionExists = false;
  var faceLen;
  var vertices = jsmPrimitive.vertices;
  var sectionEdges = {};
  var sectionEdgesCount = 0;
  var iKey1, iKey2, finalIKey, intersection, intersections;
  for (var i = 0; i < jsmPrimitive.polygons.length; ++i) {
    face = jsmPrimitive.polygons[i].vertices;
    faceLen = face.length;
    intersections = [];
    /* for each face, find one or more places where the plane cuts across the face. add these to the sectionEdges */
    for (var j = 0; j < faceLen; ++j) {
      //console.log('i:',i,'j:',j);
      P0 = new THREE.Vector3(vertices[face[j]].position.x,vertices[face[j]].position.y,vertices[face[j]].position.z);
      P1 = new THREE.Vector3(vertices[face[(j + 1) % faceLen]].position.x,vertices[face[(j + 1) % faceLen]].position.y,vertices[face[(j + 1) % faceLen]].position.z);
      intersection = intersectLineWithPlane(P0, P1, plane.position.z);
      if (intersection.intersected) {
        intersections.push(intersection);
        //console.log('found intersection: ', intersection.intersectPoint);
      }
      if (intersections.length == 2) {
        sectionExists = true;
        iKey1 = intersections[0].intersectPoint.x.toFixed(8) + '_' + intersections[0].intersectPoint.y.toFixed(8);
        iKey2 = intersections[1].intersectPoint.x.toFixed(8) + '_' + intersections[1].intersectPoint.y.toFixed(8);
        finalIKey = iKey2;
        if (!sectionEdges.hasOwnProperty(iKey1)) {
          sectionEdges[iKey1] = [];
        }
        sectionEdges[iKey1].push(iKey2);
        if (!sectionEdges.hasOwnProperty(iKey2)) {
          sectionEdges[iKey2] = [];
        }
        sectionEdges[iKey2].push(iKey1);
        intersections = [];
        sectionEdgesCount++;
      }
    }
  }

  /* Delete all previous cutSection polygons */
  if (cutSections) {
    parent.remove(cutSections);
  }
  cutSections = new THREE.Object3D();
  parent.add(cutSections);

  if (sectionExists) {

    /* Now start at final iKey on the sectionEdges array, and walk it to build up section lines */
    var sectionPoints = [];
    var walked = { };
    var numWalked = 0;
    var currentIKey = finalIKey, nextIKey;
    var startLoopIKey = finalIKey;
    var cutSection = new THREE.Geometry();
    var sectionCoord;
    var endedCurrentLoop;
    var nearestMin = 1e10, highlightCenter = { x: -1e10, y:-1e10 };

    while (numWalked < sectionEdgesCount) {
      coords = currentIKey.split('_');
      sectionCoord = new THREE.Vector3(coords[0], coords[1], plane.position.z + 0.01);
      cutSection.vertices.push(sectionCoord);
      sectionPoints.push({x: coords[0],y:coords[1]});
      numWalked++;
      walked[currentIKey] = true;
      
      nextIKey = undefined;
      if (sectionEdges[currentIKey][0] && (!walked.hasOwnProperty(sectionEdges[currentIKey][0]))) {
        nextIKey = sectionEdges[currentIKey][0];
      } else if (sectionEdges[currentIKey][1] && (!walked.hasOwnProperty(sectionEdges[currentIKey][1]))) {
        nextIKey = sectionEdges[currentIKey][1];
      }
      /* If we got through one loop, we will not be able to advance. Scan through the section edges to find an unwalked starting point. */
      endedCurrentLoop = false;
      if (nextIKey == undefined) {
        endedCurrentLoop = true;
        /* Find a candidate to start a new loop, if we can. */
        for (var seKey in sectionEdges) {
          if (sectionEdges.hasOwnProperty(seKey)) {
            if (!walked.hasOwnProperty(seKey)) {
              nextIKey = seKey;
              break;
            }
          }
        }
      }
      /* To close the loop, add back the finalIKey. */
      if (endedCurrentLoop) {
        coords = startLoopIKey.split('_');
        sectionCoord = new THREE.Vector3(coords[0], coords[1], plane.position.z + 0.01);
        cutSection.vertices.push(sectionCoord);
        sectionPoints.push({x: coords[0],y:coords[1]});

        cutSection.computeLineDistances(); // Required for dashed lines cf http://stackoverflow.com/questions/35781346/three-linedashedmaterial-dashes-dont-work
        sectionPoly = new THREE.Line(cutSection, sectionMaterialDashed);
        cutSections.add(sectionPoly);


        for (var k = 0; k < sectionPoints.length - 1; ++k) {
          var nearest = distToSegmentSquared(crosshair.position,sectionPoints[k], sectionPoints[k+1]);
          if ((nearest.distance < nearestMin) && (nearest.distance < 0.005)) {
            nearestMin = nearest.distance;
            highlightCenter.x = nearest.nearestPoint.x;
            highlightCenter.y = nearest.nearestPoint.y;
          }          
        }
        //debugger;

        cutSection = new THREE.Geometry();
        if (nextIKey) {
          startLoopIKey = nextIKey;
        }
      }

      /* Advance from here on current loop or newly started loop */
      currentIKey = nextIKey;
    }

    /* Render highlight if near a sections loop */
    highlight.position.x = highlightCenter.x;
    highlight.position.y = highlightCenter.y;
    highlight.position.z = plane.position.z + 0.01;
  }
}

function updateRoomView() {
  if (wasRotatingRoom != rotatingRoom) {
    if (wasRotatingRoom) {
      console.log('Stopped rotating room, calculating adjustment.');
      cursorAdjust.x = cursorAdjust.x + (cursorPreMove.x - cursor.current.x);
      cursorAdjust.y = cursorAdjust.y + (cursorPreMove.y - cursor.current.y);
    } else {
      console.log('started rotating room, saving cursor position');
      cursorPreMove.x = cursor.current.x;
      cursorPreMove.y = cursor.current.y;
    }
    wasRotatingRoom = rotatingRoom;

  }
  if (rotatingRoom) {
    var cursorXdiff = (cursor.current.x - cursor.last.x);
    var cursorYdiff = (cursor.current.y - cursor.last.y);
    roomRotateX = Math.min(90 * DEG_TO_RAD, Math.max(0, roomRotateX + cursorYdiff * DEG_TO_RAD));
    roomRotateY = Math.min(90 * DEG_TO_RAD, Math.max(-90 * DEG_TO_RAD, roomRotateY + cursorXdiff * DEG_TO_RAD));
    //console.log('roomRotateX:', roomRotateX, 'roomRotateY:', roomRotateY);
  }
  parent.rotation.x = roomRotateX;
  parent.rotation.y = roomRotateY;

}

// http://stackoverflow.com/questions/3437786/get-the-size-of-the-screen-current-web-page-and-browser-window
function updateCrosshair() {
  /* New algo: when user pauses for a few seconds, make this the new center of offsets and map from there, up to about 1/4 of window.innerWidth */
  if ((wasMovingPlane != movingCutplane) || (wasRotatingRoom != rotatingRoom)) {
    if (wasMovingPlane || wasRotatingRoom) {
      console.log('Stopped moving plane or rotating, calculating adjustment.');
      cursorAdjust.x = cursorAdjust.x + (cursorPreMove.x - cursor.current.x);
      cursorAdjust.y = cursorAdjust.y + (cursorPreMove.y - cursor.current.y);
    } else {
      console.log('started moving plane or rotating, saving cursor position');
      cursorPreMove.x = cursor.current.x;
      cursorPreMove.y = cursor.current.y;
    }
    wasMovingPlane = movingCutplane;
    wasRotatingRoom = rotatingRoom;
  }
  if (!movingCutplane && !rotatingRoom) {
    crosshair.position.x = Math.max(-1, Math.min(1, ( 2.0 * ((cursor.current.x + cursorAdjust.x) / (window.innerWidth  / 1.75)))  - 2.0));
    crosshair.position.y = Math.max(-1, Math.min(1, (-2.0 * ((cursor.current.y + cursorAdjust.y) / (window.innerHeight / 1.75))) + 2.0));
  }

  debugText(['Crosshair set', 
             'cursorX:', cursor.current.x,
             'cursorY:', cursor.current.y,
             'X:',       crosshair.position.x, 
             'Y:',       crosshair.position.y,
             'rotX:',    roomRotateX,
             'rotY:',    roomRotateY,
             'cursorAdjust.X:', cursorAdjust.x,
             'cursorAdjust.Y:', cursorAdjust.y
  ]);

  // canonical, basic mapping    
  // crosshair.position.x = ( 2.0 * (cursor.current.x / window.innerWidth))  - 1.0;
  // crosshair.position.y = (-2.0 * (cursor.current.y / window.innerHeight)) + 1.0;

}

/* Version that moves by deltas. This doesn't work at all because you cant "pick up the mouse" with a trackpad. */
function updateCrosshair2() {
  // Offset crosshair based on mouse move.
  
  if (!movingCutplane && !rotatingRoom) {
    var offsetX = ((cursor.current.x - cursor.last.x) / window.innerWidth) * 2.0;
    var offsetY = ((cursor.current.y - cursor.last.y) / window.innerHeight) * -2.0;
    crosshair.position.x = Math.max(-1, Math.min(1.0, crosshair.position.x + offsetX));
    crosshair.position.y = Math.max(-1, Math.min(1.0, crosshair.position.y + offsetY));
  }

  debugText(['Crosshair set', 
             'cursorX:', cursor.current.x,
             'cursorY:', cursor.current.y,
             'X:', crosshair.position.x, 
             'Y:', crosshair.position.y,
             'rotX:', roomRotateX,
             'rotY:', roomRotateY
  ]);

}

function updateCutplane() {
  if (movingCutplane) {
    var cursorXdiff = (cursor.current.x - cursor.last.x) * .01;
    if (parent.rotation.y * RAD_TO_DEG < 0) {
      cursorXdiff = -1 * cursorXdiff;
    }
    //console.log('cursorXdiff is:', cursorXdiff, cursor.current.x,cursor.last.x );
    if( Math.abs(cursorXdiff) > 0 ){
      plane.position.z = Math.max(-1, Math.min(plane.position.z + cursorXdiff, 1.0));
    }
  }
}

function updateCursorTracking() {
  cursor.last.x = cursor.current.x;
  cursor.last.y = cursor.current.y;
}

function render() {
  requestAnimationFrame( render );
  renderer.render( scene, camera );
  movingCutplane = window.optionKeyPressed;
  rotatingRoom = window.cmdKeyPressed;

  updateRoomView();
  updateCrosshair();
  updateCutplane();
  updateCursorTracking();
  drawSectionLineJSM();
}

var scene = new THREE.Scene();
//var camera = new THREE.PerspectiveCamera( 15, window.innerWidth / window.innerHeight, 1, 100 ); // with orbitControls
var camera = new THREE.PerspectiveCamera( 30, window.innerWidth / window.innerHeight, 1, 100 );

//controls = new THREE.OrbitControls( camera );
//controls.minDistance = 10;
//controls.maxDistance = 50;

var renderer = new THREE.WebGLRenderer();
renderer.setSize( window.innerWidth, window.innerHeight );
document.body.appendChild( renderer.domElement );

// parent
parent = new THREE.Object3D();
scene.add( parent );


setupJSModel();
setupHelp();
setupCutplane();
setupRoom();
setupCrosshair();
setupHighlight();
//setupPrimitive();
//setupLineSegment();

camera.position.set( 0,0, 5);
//controls.update();
setupLights();

render();
