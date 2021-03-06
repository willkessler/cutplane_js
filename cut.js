// TODO: 
//  [X] make option key rotate the room, and remove Orbit
//  [X] make section line properly dashed
//  [X] figure out how to make the plane semitransparent with a semi-transparent dotted texture
//  [X] prevent mishaps when cursor leaves the window entirely. (how will this interact with dragging?)
//  [X] put in jsmodeler and draw section line around that.
//  [X] handle leaving the window more gracefully, if rotating or draggin especially
//  [X] Fix cursor offset bugs: try new algo where i just move based on mouse movesn
//  [X] make cursor look more like the old cursor
//  [X] Use cutSections to determine what is near the cursor instead of sectionPoints
//  [X] look at CSG plugin https://github.com/chandlerprall/ThreeCSG/
//  [X] Support dragging of objects: http://stackoverflow.com/questions/22521982/js-check-if-point-inside-a-polygon
//  [X]  Fix fillInOneEdgeMap so that edges are only stored once
//  [N]  Compute section line from edge maps.  WONT_DO
//  [X]  When you hover over section line, highlight faces that are adjacent or console log them so we can see if we get them all. 
//  [X] Support multiple objects
//  [X] Tie cutSections back to model somehow, or use jsm's viewer instead
//  [X] When plane moved and room rotated, use projection vector to calculate how much to move plane, see
//      https://en.wikipedia.org/wiki/Vector_projection
//      http://stackoverflow.com/questions/27409074/three-js-converting-3d-position-to-2d-screen-position-r69
//  [X] create coplanar groups on the geometry level; point faces back to the group they belong in so we can move all of them at once
//  [X]  Fix tolerance inconsistencies in csg models.
//  [X]  Fix picking and dragging code to be more flexible
//  [X] Proper support of dragging of multiple objects
//  [X] Support grabbing faces and dragging them and update the model . Faces only move along their normal
//  [X] Investigate sprite labels: https://stemkoski.github.io/Three.js/Labeled-Geometry.html
//  [X] Check if the CSG lib is in ES6. Yes, it is, but it doesn't make much difference to the resulting coplanar face mess.
//  [X] Stay on the face normal when you drag the face

//  [ ] If looking at room from behind, reverse the cursor controls
//  [ ] Reinstate shadow on the ground (use lights?)
//  [ ] R to snap the rotate tool. investigate how to rotate an object. We have to put each object in an Object3D of its own so we can use RotateOnAxis;


//  [ ] Can we do an algo where we pick the highest vertex and then walk edges picking the edge that has the greatest angle as the next edge each time? look at crossprod to get angle btwn vectors and 
//      pay attention to the direction of the vector to make sure you're taking the inside angle every time. Alternatively, use raycasting approach.
//  [ ] Support grabbing edges and dragging them and update the model . Robust point in poly: cf https://github.com/mikolalysenko/robust-point-in-polygon
//  [ ] Separately compute faces that are in the plane and highlight them differently
//  [ ] Fix section line bug where sometimes it will jump over the surface
//  [ ] restore the rotate tool but make it smarter about snapping faces into the plane
//  [ ] load/save models to cloud
//  [ ] restore booleans manipulations within the UI cf http://learningthreejs.com/blog/2011/12/10/constructive-solid-geometry-with-csg-js/
//  [ ] use mousewheel to zoom in and out
//  [ ] cmd-z to undo drags
//  [ ] fix the coplanar faces issues on the CSG boolean results
//  [ ] restore snapping of faces to other faces. maybe use physics libraries to let objects press up against each other and stop
//  [ ] restore the tool chests

// http://jsfiddle.net/hbt9c/317/

// basic threejs tutorial: https://manu.ninja/webgl-3d-model-viewer-using-three-js

var FACELEN = 3; // triangles by default in meshes
var RAD_TO_DEG = 180 / Math.PI;
var DEG_TO_RAD = Math.PI / 180;
var FACE_IN_PLANE_TOLERANCE = 0.0001;
var POINT_ON_POINT_TOLERANCE = 0.087;
var POINT_ON_LINE_TOLERANCE = 0.001;
var TO_FIXED_DECIMAL_PLACES = 4;
var COPLANAR_ANGLE_TOLERANCE = .1; // degrees, not radians

var parent;
var csgPrimitives;
var plane;
var crosshair;
var primitive;
var jsmPrimitive;
var jsmPrimitiveMesh;
var cutplaneVectorScreenSpace;
var cutplaneVector2dStr;

var csgPrimitiveMesh;

var controls;
var vertices;
var faces;
var pickSquare;
var selectMeshMaterialUnselected;
var selectMeshMaterialSelected;

var selectableItem = { type: 'none' };
var pickedItems = [];


var pickedList = [];
var dragging = false;
var movingCutplane = false;
var startCursorPauseTime;
var wasMovingPlane = false;
var wasRotatingRoom = false;
var useWireFrame = false, previousUseWireFrame = false;
var cursorAdjust =  { x: 0, y: 0 };
var cursorPreMove = { x: 0, y: 0 };
var rotatingRoom = true;
var roomRotateX = Math.PI/8;
var roomRotateY = Math.PI/4;
var cutSections;
var firstRender = true;

var debugTextArray = [];
var allLabels = [];

var cursor = { current: {x:0, y:0}, last: {x:0,y:0} };

var lineMaterial = new THREE.LineBasicMaterial({
  color: 0xffffff
});

var lineMaterialGreen = new THREE.LineBasicMaterial({
  color: 0x00ff00
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

var csgPrimitiveMaterialFlat = new THREE.MeshStandardMaterial ( {
  shading: THREE.FlatShading,
  color:0xffffff,
  side: THREE.DoubleSide,
  vertexColors: THREE.FaceColors // you need this if you want to change face colors later
} );

// http://stackoverflow.com/questions/20153705/three-js-wireframe-material-all-polygons-vs-just-edges
var csgPrimitiveMaterialWire = new THREE.MeshBasicMaterial ( {
  color:0xffffff,
  wireframe: true
} );

// -------------------------------------------------------------------------------------------------------------
// Setup
// -------------------------------------------------------------------------------------------------------------


document.onmousedown = function(e) {
  updatePickedItems(true, e.shiftKey);
}

document.onmouseup = function(e) {
  updatePickedItems(false, false);
}

document.onmousemove = function(e){
  cursor.last.x = cursor.current.x; 
  cursor.last.y = cursor.current.y;
  cursor.current.x = e.pageX;
  cursor.current.y = e.pageY;
  //  debugText(['Cursor ', 'X:', e.pageX, 'Y:', e.pageY,  window.innerWidth, window.innerHeight]);
}

/* Prevent returning to this tab and thinking these keys are still down */
window.onblur = function(e) {
  window.optionKeyPressed = false;
  window.cmdKeyPressed = false;
}

function handleMouseOut(e) {
  console.log('leaving window');
  window.cmdKeyPressed = false;
  window.optionKeyPressed = false;
  movingCutplane = false;
  rotatingRoom = false;
}

function handleMouseEnter(e) {
  console.log('welcome back, resetting cursorAdjust');
  cursorAdjust.x = 0; 
  cursorAdjust.y = 0;
}

document.body.addEventListener("mouseout", handleMouseOut, false);
document.body.addEventListener("mouseenter", handleMouseEnter, false);


function handleKeyDown(event) {
  console.log('Key pressed:', event.keyCode);
  switch (event.keyCode) {
    case 18:
      window.optionKeyPressed = true;
      break;
    case 17:
      break; // control key
    case 65: // "A" key, not used
      improveTriangulation();
      break;
    case 87:
      window.wKeyPressed = true;
      break;
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
      break; // control key
    case 87:
      window.wKeyPressed = false;
      break;
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
function dist3(v, w) { return sqr(v.x - w.x) + sqr(v.y - w.y) + sqr(v.z - w.z) }
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

function distToSegmentSquared3d(p,v,w) {
  var l3 = dist3(v, w);
  if (l3 == 0) { 
    return { nearestPoint: v, distance: dist3(p, v) };
  }
  var t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y) + (p.z - v.z) * (w.z - v.z)) / l3;
  t = Math.max(0, Math.min(1, t));
  var nearestPoint = { x: v.x + t * (w.x - v.x),
                       y: v.y + t * (w.y - v.y),
                       z: v.z + t * (w.z - v.z)};
  var nearestRecord = {
    nearestPoint: nearestPoint,
    distance: dist3(p, nearestPoint),
    t: t
  };
  //console.log('nearestRecord, dist:', nearestRecord.distance, 'X:', nearestRecord.nearestPoint.x, 'Y:', nearestRecord.nearestPoint.y);
  return ( nearestRecord );
}

function distToSegment3d(p, v, w) { 
  var dss = distToSegmentSquared(p,v,w);
  return Math.sqrt(dss.distance); 
}

/* from: https://github.com/substack/point-in-polygon/blob/master/index.js */
function pointInPoly (point, poly) {
  // ray-casting algorithm based on
  // http://www.ecse.rpi.edu/Homepages/wrf/Research/Short_Notes/pnpoly.html
  // This is designed to use polygons where first vertex does not repeat at the end of the polygon which is what you get with a 
  // closed polygon from THREE.js vertices array.
  // So we pass a shorter polygon length in.
  //debugger;
  var polyLength = poly.length;
  var inside = false;
  var i = 0;
  var j = polyLength - 1;
  while (i < polyLength) {
    var xi = poly[i].x;
    var yi = poly[i].y;
    var xj = poly[j].x;
    var yj = poly[j].y;
    
    var intersect = ((yi > point.y) != (yj > point.y))
                 && (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
    j = i;
    i++;
  }
  
  return inside;
};

// This function is also apparently built in to THREEjs, cf https://threejs.org/docs/?q=plane#Reference/Math/Plane intersectsLine(). 
// However, we need the intersection point and the t value.
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
    if (s1 < FACE_IN_PLANE_TOLERANCE) {
      //console.log('point 0', P0.x, P0.y, P0.z, ' on plane with P1=', P1.x, P1.y, P1.z);
    } else if  (1.0 - s1 < FACE_IN_PLANE_TOLERANCE) {
      //console.log('point 1', P1.x, P1.y, P1.z, ' on plane with P0=', P0.x, P0.y, P0.z);
    }
    //console.log('Intersection found at', intersectPoint, ' between P0:', P0.x, P0.y, P0.z, ' and P1:', P1.x, P1.y, P1.z);
    return({intersected: true,
            intersectPoint: intersectPoint
    });
  } else {
    //console.log('No intersection found, P0:', P0.x, P0.y, P0.z, ' and P1:', P1.x, P1.y, P1.z);
    return({intersected: false});
  }
}

function pointsAreEqual(P0, P1) {
  return (dist3(P0, P1) < POINT_ON_POINT_TOLERANCE * POINT_ON_POINT_TOLERANCE);
//  return (dist3(P0, P1) < .005);
}

/* From: http://stackoverflow.com/questions/27409074/converting-3d-position-to-2d-screen-position-r69, answer 3 */
function project3DVectorIntoScreenSpace(x, y, z, camera, width, height) {
  var p = new THREE.Vector3(x, y, z);
  var vector = p.project(camera);

  vector.x = (vector.x + 1) / 2 * width;
  vector.y = -(vector.y - 1) / 2 * height;

  return vector;
}

// https://www.gamedev.net/topic/556821-check-if-vectors-are-parallel-and-pointing-in-the-same-direction-with-tolerance/, second response useful
function projectOntoVector(v1, v2) {
  var dotProd = v1.dot(v2);
  var v2LenSquared = sqr(v2.length());
  var scalar = dotProd * v2LenSquared;
  var projection = v2.clone();
  projection.multiplyScalar(scalar);
  return(projection);
}


function splitAdjoiningFace(face, faceIndex, geometry) {
  var faceArray, adjoinP1, adjoinP2;
  var splitPoint;
  var faceArray = [ face.a, face.b, face.c ];
  var vertices = geometry.vertices;
  var adjoinFace;

  adjoinLoop:
  for (var adjoinFaceIndex in geometry.faces) {
    adjoinFace = geometry.faces[adjoinFaceIndex];
    if ((faceIndex != adjoinFaceIndex) && checkCoplanarity(face, adjoinFace)) {
      /*
      if (!(faceIndex == 20 && adjoinFaceIndex == 17)) {
        console.log('faceIndex:', faceIndex, 'adjoinFaceIndex:', adjoinFaceIndex);
        return;
      }
      */
      adjoinFaceArray = [ adjoinFace.a, adjoinFace.b, adjoinFace.c ];
      for (var i = 0; i < FACELEN; ++i) {
        adjoinP1 = adjoinFaceArray[i];
        adjoinP2 = adjoinFaceArray[(i + 1) % FACELEN];
        for (var j = 0; j < FACELEN; ++j) {
          if ((faceArray[j] != adjoinP1) && (faceArray[j] != adjoinP2)) {
            splitPoint = distToSegmentSquared3d(vertices[faceArray[j]], vertices[adjoinP1], vertices[adjoinP2]);
            if (splitPoint.distance < POINT_ON_LINE_TOLERANCE) {
              console.log('j=', j, 'Source face:', faceIndex, 'We found split point on adjoining face index:', adjoinFaceIndex, adjoinFace);

              /* Dont use newPoint. Use faceArray[j] as the index.
               * Also, make a stack of faces to split so we don't split more than once if we don't have to. */

              /*
              var newPoint = new THREE.Vector3(splitPoint.nearestPoint.x, splitPoint.nearestPoint.y, splitPoint.nearestPoint.z);
              geometry.vertices.push(newPoint);
              var newPointIndex = geometry.vertices.length - 1;

            if (faceIndex == 12 && adjoinFaceIndex == 17) {
                debugger;
              }
              if (adjoinFaceIndex == 17) {
                console.log('Splitting.');
              }

              */
              // 4,8 causes issues
              /*
              if (adjoinFaceIndex == 30) {
                console.log('face indexes:', faceArray[0], faceArray[1], faceArray[2]);
                console.log('adjoinFace indexed:', adjoinFaceArray[0], adjoinFaceArray[1], adjoinFaceArray[2]);
                console.log('face:', vertices[faceArray[0]], vertices[faceArray[1]], vertices[faceArray[2]]);
                console.log('adjoinFace:', vertices[adjoinFaceArray[0]], vertices[adjoinFaceArray[1]], vertices[adjoinFaceArray[2]]);
                debugger;
              }
              */

              adjoinFace.a = adjoinFaceArray[i];
              adjoinFace.b = faceArray[j];
              adjoinFace.c = adjoinFaceArray[(i+2) % FACELEN];

              var newFace = adjoinFace.clone();
              newFace.a = faceArray[j];
              newFace.b = adjoinFaceArray[(i+1) % FACELEN];
              newFace.c = adjoinFaceArray[(i+2) % FACELEN];
              geometry.faces.push(newFace);

/*
              if ((adjoinFace.a == adjoinFace.b) || (adjoinFace.a == adjoinFace.c) || (adjoinFace.b == adjoinFace.c)) {
                debugger;
              }
              if ((newFace.a == newFace.b) || (newFace.a == newFace.c) || (newFace.b == newFace.c)) {
                debugger;
              }
*/
              
              var newVertexUv = _.clone(geometry.faceVertexUvs[0][adjoinFaceIndex]);
              geometry.faceVertexUvs[0].push(newVertexUv);

              continue adjoinLoop;
            }
          }
        }
      }
    }
  }    
}

/* From http://stackoverflow.com/questions/23514274/three-js-2d-text-sprite-labels */

function roundRect(context, x, y, w, h, r) { 
  context.beginPath(); 
  context.moveTo(x + r, y); 
  context.lineTo(x + w - r, y); 
  context.quadraticCurveTo(x + w, y, x + w, y + r); 
  context.lineTo(x + w, y + h - r); 
  context.quadraticCurveTo(x + w, y + h, x + w - r, y + h); 
  context.lineTo(x + r, y + h); 
  context.quadraticCurveTo(x, y + h, x, y + h - r);
  context.lineTo(x, y + r);
  context.quadraticCurveTo(x, y, x + r, y);
  context.closePath(); 
  context.fill(); 
  context.stroke(); 
} 

function makeTextSprite( message, parameters )
{
  if ( parameters === undefined ) parameters = {};
  var fontface = parameters.hasOwnProperty("fontface") ? parameters["fontface"] : "Arial";
  var fontsize = parameters.hasOwnProperty("fontsize") ? parameters["fontsize"] : 18;
  var borderThickness = parameters.hasOwnProperty("borderThickness") ? parameters["borderThickness"] : 4;
  var borderColor = parameters.hasOwnProperty("borderColor") ?parameters["borderColor"] : { r:0, g:0, b:0, a:1.0 };
  var backgroundColor = parameters.hasOwnProperty("backgroundColor") ?parameters["backgroundColor"] : { r:255, g:255, b:255, a:1.0 };
  var textColor = parameters.hasOwnProperty("textColor") ?parameters["textColor"] : { r:0, g:0, b:0, a:1.0 };

  var canvas = document.createElement('canvas');
  var context = canvas.getContext('2d');
  context.font = "Bold " + fontsize + "px " + fontface;
  var metrics = context.measureText( message );
  var textWidth = metrics.width;

  context.fillStyle   = "rgba(" + backgroundColor.r + "," + backgroundColor.g + "," + backgroundColor.b + "," + backgroundColor.a + ")";
  context.strokeStyle = "rgba(" + borderColor.r + "," + borderColor.g + "," + borderColor.b + "," + borderColor.a + ")";

  context.lineWidth = borderThickness;
  roundRect(context, borderThickness/2, borderThickness/2, (textWidth + borderThickness) * 1.1, fontsize * 1.4 + borderThickness, 8);

  context.fillStyle = "rgba("+textColor.r+", "+textColor.g+", "+textColor.b+", 1.0)";
  context.fillText( message, borderThickness, fontsize + borderThickness);

  var texture = new THREE.Texture(canvas) 
  texture.needsUpdate = true;

  var spriteMaterial = new THREE.SpriteMaterial( { map: texture } );
  var sprite = new THREE.Sprite( spriteMaterial );
  sprite.scale.set(1,1,1);
  return sprite;  
}

/* Old not working, From stemkoski https://github.com/stemkoski/stemkoski.github.com/blob/master/Three.js/Sprite-Text-Labels.html */

// --------------------------------------------------------------------------------
// Setup functions
// --------------------------------------------------------------------------------


function setupHelp() {
  var text2 = document.createElement('div');
  text2.style.position = 'absolute';
  text2.className = 'instructions';
  //text2.style.zIndex = 1;    // if you still don't see the label, try uncommenting this
  text2.className = "instructions";
  text2.innerHTML = '<ul class="hints">' +
                    '<li><div class="key">Option-mouse</div><div class="hintText">Move cutplane</div></li>' +
                    '<li><div class="key">Cmd-mouse</div><div class="hintText">Rotate view</div></li>' +
                    '<li><div class="key">Shift-Click</div><div class="hintText">Select multiple items</div></li>' +
                    '<li><div class="key">Mouse-wheel</div><div class="hintText">Zoom</div></li>' +
                    '<li><div class="key">Cmd-Z</div><div class="hintText">Undo last change</div></li>' +
                    '<li><div class="key">Shift-Cmd-Z</div><div class="hintText">Redo last change</div></li>' +
                    '<li><div class="key">W</div><div class="hintText">Toggle wireframe display</div></li>' +
                    '<li><div class="key">A</div><div class="hintText">Apply face splitter algo</div></li>' +
                    '</ul>';
  document.body.appendChild(text2);

  /* Status */
  text3 = document.createElement('div');
  text3.style.position = 'absolute';
  text3.className = 'status';
  //text2.style.zIndex = 1;    // if you still don't see the label, try uncommenting this
  text3.className = "status";
  text3.innerHTML = "status";
  document.body.appendChild(text3);
  
}

function renderDebugText(displayArray) {
  text3.innerHTML = debugTextArray.join('');
  debugTextArray = []; /* clear for next loop */
}

function addToDebugText(debugText) {
  debugTextArray.push(debugText.join('<br>'));
}


function setupLights() {
  var dirLight = new THREE.DirectionalLight();
  dirLight.position.set(0, 1, 1);
  scene.add(dirLight);
  var light = new THREE.AmbientLight( 0xaaaaaa ); // soft white light. do NOT set to 0xffffff or all shading will seem to vanish
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

  var material = new THREE.MeshLambertMaterial({map: texture, transparent:true, side: THREE.DoubleSide });
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

  //plane.position.z = -0.22;
  plane.position.z = 0.33;
  parent.add(plane);
}

function setupCrosshair() {
  var crosshairSize = 0.05, crosshairOffset = 0.02;
  var crosshairMaterial = new THREE.LineBasicMaterial({
    color: 0xffff00,
    side: THREE.DoubleSide,
    depthTest: false,
    depthWrite: false,
    depthFunc: THREE.AlwaysDepth
  });

  crosshair = new THREE.Object3D();

  var crosshairCube = new THREE.BoxGeometry( crosshairSize, 0.01, 0.01 );
  var crosshairSlab = new THREE.Mesh( crosshairCube, crosshairMaterial );
  crosshairSlab.position.x = -crosshairSize / 2 - crosshairOffset;
  crosshair.add(crosshairSlab);

  crosshairSlab = new THREE.Mesh( crosshairCube, crosshairMaterial );
  crosshairSlab.position.x = crosshairSize / 2 + crosshairOffset;
  crosshair.add(crosshairSlab);

  crosshairCube = new THREE.BoxGeometry( 0.01, crosshairSize, 0.01 );
  crosshairSlab = new THREE.Mesh( crosshairCube, crosshairMaterial );
  crosshairSlab.position.y = -crosshairSize / 2 - crosshairOffset;
  crosshair.add(crosshairSlab);

  crosshairSlab = new THREE.Mesh( crosshairCube, crosshairMaterial );
  crosshairSlab.position.y = crosshairSize / 2 + crosshairOffset;
  crosshair.add(crosshairSlab);

  var material2 = new THREE.MeshBasicMaterial({
    color: 0xffff00,
    depthTest: false,
    depthWrite: false,
    depthFunc: THREE.AlwaysDepth
  });


  crosshair.position.x = 0; 
  crosshair.position.y = 0;
  crosshair.position.z = 0.01;
  
  
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
  }

  var cubeSize = 0.15;
  var geometry = new THREE.BoxGeometry( cubeSize, cubeSize, cubeSize );
  var material = new THREE.MeshPhongMaterial( { 
    color: 0x0000ff, 
    side: THREE.DoubleSide, 
    opacity: 1.0 
  } );
  primitive = new THREE.Mesh( geometry, material );
  //primitive.position.x = 1.7;
  //parent.add(primitive);

  primitive_bsp = new ThreeBSP( box );
  console.log('primitive_bsp:', primitive_bsp);

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

  jsmPrimitiveMesh = JSM.ConvertBodyToThreeMeshes (jsmPrimitive, materialSet);
  parent.add(jsmPrimitiveMesh[0]);

  var highlightMaterial = new THREE.MeshBasicMaterial( { color: 0x00ff00, side: THREE.BackSide } );
  highlightMesh = JSM.ConvertBodyToThreeMeshes (jsmPrimitive, materialSet);
  var outlineMaterial2 = new THREE.MeshBasicMaterial( { color: 0x00ff00, side: THREE.BackSide } );
  highlightMesh[0].material = outlineMaterial2;
  highlightMesh[0].position = jsmPrimitive.position;
  highlightMesh[0].scale.multiplyScalar(1.03);
  highlightMesh[0].position.x = 100000;
  parent.add( highlightMesh[0] );
}

function setupSelectMesh(csgPrimitiveMesh) {
  var selectMesh = csgPrimitiveMesh.clone();
  csgPrimitiveMesh.selectMesh = selectMesh;
  selectMeshMaterialUnselected = new THREE.MeshBasicMaterial( { color: 0xffff00, side: THREE.BackSide } );
  selectMeshMaterialSelected = new THREE.MeshBasicMaterial( { color: 0xff0000, side: THREE.BackSide } );
  selectMesh.material = selectMeshMaterialUnselected;
  selectMesh.scale.multiplyScalar(1.04);
  selectMesh.position.x = 100000;
  parent.add(selectMesh);
}


/*
function doAllCorrections() {
  var csgPrimitiveMesh = csgPrimitives.children[0];
  console.log('Num faces before:', csgPrimitiveMesh.geometry.faces.length, 'Num verts before:', csgPrimitiveMesh.geometry.vertices.length);
  updateEdgeMaps(csgPrimitiveMesh);
  console.log('Num faces mid:', csgPrimitiveMesh.geometry.faces.length, 'Num verts mid:', csgPrimitiveMesh.geometry.vertices.length);
  improveTriangulation();
  console.log('Num faces after fillin:', csgPrimitiveMesh.geometry.faces.length, 'Num verts after fillin:', csgPrimitiveMesh.geometry.vertices.length);
  correctDuplicateVertices(csgPrimitiveMesh.geometry);
  console.log('Num faces after correctDupe:', csgPrimitiveMesh.geometry.faces.length, 'Num verts after correctDupe:', csgPrimitiveMesh.geometry.vertices.length);
  updateEdgeMaps(csgPrimitiveMesh);
  console.log('Num faces after all:', csgPrimitiveMesh.geometry.faces.length, 'Num verts after all:', csgPrimitiveMesh.geometry.vertices.length);
}
*/

// working example: http://jsfiddle.net/L0rdzbej/151/
function setupCSGModels() {
  var height = 1;
  var width = 1;
  var length = 1;

  csgPrimitives = new THREE.Object3D();
  parent.add(csgPrimitives);

  var box = new THREE.Mesh( new THREE.BoxGeometry( width, height, length ) );

  // CSG GEOMETRY
  cube_bsp = new ThreeBSP( box );

  var cutgeo = new THREE.SphereGeometry( 0.5,32,32 );
  //var cutgeo = new THREE.CubeGeometry( width / 2, height / 2, length / 2);

  // move geometry to where the cut should be
  var matrix = new THREE.Matrix4();
  matrix.setPosition( new THREE.Vector3(0.25, 0.25, 0.25) );
  //matrix.setPosition( new THREE.Vector3(0.25, 0, 1.88) ); // this version , sphere does not intersect with cube
  cutgeo.applyMatrix( matrix );

  var sub =  new THREE.Mesh( cutgeo );
  var substract_bsp  = new ThreeBSP( sub );
  var subtract_bsp  = cube_bsp.subtract( substract_bsp );

/*
  matrix.setPosition( new THREE.Vector3(-0.25, -0.15, -0.15) );
  cutgeo.applyMatrix( matrix );

  sub =  new THREE.Mesh( cutgeo );
  substract_bsp  = new ThreeBSP( sub );
  var subtract_bsp2  = subtract_bsp.subtract( substract_bsp );
*/
  
  csgPrimitiveMesh = subtract_bsp.toMesh(); 
  csgPrimitiveMesh.geometry.computeVertexNormals();

  // csgPrimitiveMesh.material = csgPrimitiveMaterialWire;
  csgPrimitiveMesh.material = csgPrimitiveMaterialFlat;

  setupSelectMesh(csgPrimitiveMesh);
  //csgPrimitives.add( csgPrimitiveMesh );

  correctDuplicateVertices(csgPrimitiveMesh.geometry);

  var box2 = new THREE.Mesh( new THREE.BoxGeometry( width/2, height/2, length ) );
  box2.geometry.translate(-0.75,-0.25,-0.75);
  box2.material = csgPrimitiveMaterialFlat;
  //csgPrimitives.add(box2);  

  setupSelectMesh(box2);


  /* Hack */
  // cf http://stackoverflow.com/questions/15384078/updating-a-geometry-inside-a-mesh-does-nothing
//  csgPrimitives.children[1].geometry.vertices[0].x = 1.75; 
//  csgPrimitives.children[1].geometry.verticesNeedUpdate = true;

}


function setupPickSquare() {
  var radius = 0.04;
  var geometry = new THREE.CircleGeometry(radius,20);
  var material = new THREE.MeshBasicMaterial( { 
    color: 0xff0000,
    depthTest: false, // so that we can always see the section line
    depthWrite: false,
    depthFunc: THREE.AlwaysDepth,
    side: THREE.DoubleSide, 
    opacity: 1.0 } );
  pickSquare = new THREE.Mesh( geometry, material );
  parent.add(pickSquare);
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

function setupLabels() {
  var fontColor = {
    r: 255,
    g: 255,
    b: 0,
    a: 1.0
  };
  for (var csgPrimitive of csgPrimitives.children) {
    var vertices = csgPrimitive.geometry.vertices;
    var faces = csgPrimitive.geometry.faces;
    for (var faceIndex in faces) {
      var face = faces[faceIndex];
      var spritey = makeTextSprite( faceIndex, 
                                { fontsize: 48,
                                  fontface: 'Georgia',
                                  textColor: {r:255, g:255, b:0, a:1.0}, 
                                  borderColor: {r:255, g:255, b:255, a:1.0}, 
                                  backgroundColor: {r:0, g:0, b:0, a:0.8} } );
      spritey.position.set(-1000,-1000,-1000);
      allLabels.push(spritey);
      parent.add( spritey );
    }
  }
}

function setupHackFiller(cubeSize) {
  var margin = 0.03;
  var hackCube = new THREE.BoxGeometry( cubeSize - margin, cubeSize - margin, cubeSize - margin);
  var hackMaterial = new THREE.MeshBasicMaterial( { 
    color: 0x111111,
    side: THREE.DoubleSide, 
    opacity: 1.0 
  } );

  var hackFiller = new THREE.Mesh( hackCube, hackMaterial );

  parent.add(hackFiller);
}


function setupSimpleTest() {
  // Hack testing/ demo part
  
  var cubeSize = 0.5;

  var geometry = new THREE.Geometry();

  geometry.vertices.push(
    new THREE.Vector3( -cubeSize,  cubeSize, 0 ),
    new THREE.Vector3( -cubeSize, -cubeSize, 0 ),
    new THREE.Vector3(  cubeSize, -cubeSize, 0 ),
    new THREE.Vector3(  cubeSize,  cubeSize, 0 ),
    new THREE.Vector3( -cubeSize,  cubeSize, -cubeSize ),
    new THREE.Vector3( -cubeSize, -cubeSize, -cubeSize ),
    new THREE.Vector3(  cubeSize, -cubeSize, -cubeSize ),
    new THREE.Vector3(  cubeSize,  cubeSize, -cubeSize )
  );

  geometry.faces.push( new THREE.Face3( 0, 1, 2 ) );
  geometry.faces.push( new THREE.Face3( 0, 3, 2 ) );
  geometry.faces.push( new THREE.Face3( 4, 5, 6 ) );
  geometry.faces.push( new THREE.Face3( 4, 6, 7 ) );
  geometry.computeVertexNormals();

  var obj = new THREE.Mesh( geometry);
  obj.material = csgPrimitiveMaterialFlat;
  setupSelectMesh(obj);
  csgPrimitives.add(obj);
}

function setupCSGTest() {

  var cubeSize = 1;
  var box = new THREE.Mesh( new THREE.BoxGeometry( cubeSize, cubeSize, cubeSize ) );
  // CSG GEOMETRY
  cube_bsp = new ThreeBSP( box );
  //var cutgeo = new THREE.SphereGeometry( cubeSize,16,8 );
  var cutgeo = new THREE.CubeGeometry( cubeSize,cubeSize,cubeSize );

  var cutDim = cubeSize * .8;

  // move geometry to where the cut should be
//  var matrix = new THREE.Matrix4();
//  matrix.setPosition( new THREE.Vector3( -cutDim, cutDim, cutDim ));
  
//  matrix.setPosition( new THREE.Vector3(0.25, 0, 1.88) ); // this version , sphere does not intersect with cube
//  cutgeo.applyMatrix( matrix );
//  cutgeo.rotateX(45 * DEG_TO_RAD);
  cutgeo.rotateY(45 * DEG_TO_RAD);
  cutgeo.translate(0,0, cutDim);

  var sub =  new THREE.Mesh( cutgeo );
  var substract_bsp  = new ThreeBSP( sub );
  var subtract_bsp  = cube_bsp.subtract( substract_bsp );
  final_subtract_bsp = subtract_bsp;

  var csgPrimitiveMesh = subtract_bsp.toMesh(); 
  csgPrimitiveMesh.geometry.computeVertexNormals();
  csgPrimitiveMesh.geometry.rotateY(90* DEG_TO_RAD);

  csgPrimitiveMesh.material = csgPrimitiveMaterialFlat;

  setupSelectMesh(csgPrimitiveMesh);
  correctDuplicateVertices(csgPrimitiveMesh.geometry);

  var scaleUp = 1;
  csgPrimitiveMesh.geometry.scale(scaleUp, scaleUp, scaleUp);
  csgPrimitives.add( csgPrimitiveMesh );
  //setupHackFiller(cubeSize);

}


/* Find perimeter of a coplanar face group so we can simplify it into a single poly for tesselation */
function makeTess() {
  var x = 0, y = 0;

  var myShape = new THREE.Shape();
  var chunk = 0.5;
  myShape.moveTo( x, y);
  
  myShape.lineTo( x + chunk, y);
  myShape.lineTo( x + chunk * 2, y + chunk);
  myShape.lineTo( x + chunk * 2, y + chunk * 2);
  myShape.lineTo( x + chunk, y + chunk * 3);
  myShape.lineTo( x, y + chunk * 3);
  myShape.lineTo( x - chunk, y + chunk * 2);
  myShape.lineTo( x - chunk * 2, y + chunk);
  myShape.lineTo( x - chunk, y);
  myShape.lineTo( x - chunk, y);
  myShape.lineTo( x, y + chunk);

  var geometry = new THREE.ShapeGeometry( myShape );
  var mesh = new THREE.Mesh( geometry, csgPrimitiveMaterialWire ) ;
  geometry.rotateX(90 * DEG_TO_RAD);
  geometry.translate(0.5, 0.5, -0.5);
  assignVertexFaceHashes(geometry);
  csgPrimitives.add(mesh);
  
}

function cleanNegZero(negZero) {
  return((negZero == -0) ? 0 : negZero);
}

function setupNewCSGTest() {
  //var a = CSG.cube();
  var a = CSG.cube({ radius:0.5 });
  var b = CSG.cube ({ radius:[1,0.3,0.3], center:[0.25, 0.65, 0] });
  var c = a.subtract(b);
  cGeo = c.toMesh();
  var mesh = new THREE.Mesh( cGeo, csgPrimitiveMaterialFlat);  
  parent.add(mesh);
  var polygons = c.toPolygons();
  for (var i in polygons) {
    var poly = polygons[i];
    //var cleanNormal = { x: cleanNegZero(polygons[i].plane.normal.x), y: cleanNegZero(polygons[i].plane.normal.y), z: cleanNegZero(polygons[i].plane.normal.z) };
    //console.log(i, '[', cleanNormal.x, cleanNormal.y, cleanNormal.z, '],w:', polygons[i].plane.w);
    for (var vertex of poly.vertices) {
      vertex.pos.x += 0.5;
      vertex.pos.y += 0.5;
    }
  }
  fooPolys = polygons;
  cGeo = c.toMesh();
  var mesh = new THREE.Mesh( cGeo, csgPrimitiveMaterialFlat);  
  parent.add(mesh);
  console.log(cGeo);
  
}



// --------------------------------------------------------------------------------
// Main interaction functions
// --------------------------------------------------------------------------------


// Shiftkey: http://stackoverflow.com/questions/3781142/jquery-or-javascript-how-determine-if-shift-key-being-pressed-while-clicking-an

function updatePickedItems(mouseDown, shiftKeyDown) {
  if (mouseDown) {
    if (!shiftKeyDown) {
      pickedItems = [];
    }
    switch (selectableItem.type) {
      case 'mesh':
        selectableItem.selectMesh.material = selectMeshMaterialSelected;
        pickedItems.push(selectableItem);
        dragging = true;
        break;
      case 'coplanarGroup':
        pickedItems.push(selectableItem);
        dragging = true;
        break;
      case 'none':
      default:
        dragging = false;
        pickedItems = [];
    }
  } else {
    dragging = false;
    if (selectableItem.type == 'mesh') {
      selectableItem.selectMesh.material = selectMeshMaterialUnselected;
    }
  }    
}

// http://geomalgorithms.com/a05-_intersect-1.html
/* This routine tries to create a simple section line on convex objects defined in setupPrimitive() above */
function drawSectionLineRawModel() {
  var P0, P1;
  var cutSection = new THREE.Geometry();
  var sectionExists = false;
  var face;
  var sectionPoints = [];
  for (var i = 0; i < faces.length; ++i) {
    face = faces[i];
    for (var j = 0; j < FACELEN - 1; ++j) {
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
    P0 = new THREE.Vector3(vertices[face[FACELEN - 1]].x,vertices[face[FACELEN - 1 ]].y,vertices[face[FACELEN - 1]].z);
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

/* This section line routine works on JSModeler objects */
function drawSectionLineJSM() {
  var P0, P1;
  var sectionExists = false;
  var face;
  var vertices = jsmPrimitive.vertices;
  var sectionEdges = {};
  var sectionEdgesCount = 0;
  var iKey1, iKey2, finalIKey, intersection, intersections;

  if (!(movingCutplane || firstRender) ) {
    return; // don't update the sections if not moving the cutplane
  }

  for (var i = 0; i < jsmPrimitive.polygons.length; ++i) {
    face = jsmPrimitive.polygons[i].vertices;
    intersections = [];
    /* for each face, find one or more places where the plane cuts across the face. add these to the sectionEdges */
    for (var j = 0; j < FACELEN; ++j) {
      //console.log('i:',i,'j:',j);
      P0 = new THREE.Vector3(vertices[face[j]].position.x,vertices[face[j]].position.y,vertices[face[j]].position.z);
      P1 = new THREE.Vector3(vertices[face[(j + 1) % FACELEN]].position.x,vertices[face[(j + 1) % FACELEN]].position.y,vertices[face[(j + 1) % FACELEN]].position.z);
      intersection = intersectLineWithPlane(P0, P1, plane.position.z);
      if (intersection.intersected) {
        intersections.push(intersection);
        //console.log('found intersection: ', intersection.intersectPoint);
      }
      if (intersections.length == 2) {
        sectionExists = true;
        iKey1 = intersections[0].intersectPoint.x.toFixed(TO_FIXED_DECIMAL_PLACES) + '_' + intersections[0].intersectPoint.y.toFixed(TO_FIXED_DECIMAL_PLACES);
        iKey2 = intersections[1].intersectPoint.x.toFixed(TO_FIXED_DECIMAL_PLACES) + '_' + intersections[1].intersectPoint.y.toFixed(TO_FIXED_DECIMAL_PLACES);
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
    var coordsRaw;
    var coords;

    while (numWalked < sectionEdgesCount) {
      coordsRaw = currentIKey.split('_');
      coords = [ parseFloat(coordsRaw[0]), parseFloat(coordsRaw[1]) ];
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
        coordsRaw = startLoopIKey.split('_');
        coords = [ parseFloat(coordsRaw[0]), parseFloat(coordsRaw[1]) ];
        sectionCoord = new THREE.Vector3(parseFloat(coords[0]), parseFloat(coords[1]), plane.position.z + 0.01);
        cutSection.vertices.push(sectionCoord);
        sectionPoints.push({x: coords[0],y:coords[1]});

        cutSection.computeLineDistances(); // Required for dashed lines cf http://stackoverflow.com/questions/35781346/three-linedashedmaterial-dashes-dont-work
        var sectionPoly = new THREE.Line(cutSection, sectionMaterialDashed);
        cutSections.add(sectionPoly);

        cutSection = new THREE.Geometry();
        if (nextIKey) {
          startLoopIKey = nextIKey;
        }
      }

      /* Advance from here on current loop or newly started loop */
      currentIKey = nextIKey;
    }

  }
}


function createDuplicateVertexMap(vertices) {
  var vertexMap = {};
  vertexMap[0] = 0; // first vertex is nearest to itself
  var nearest;
  var numVerts = vertLen = vertices.length;
  for (var vv = 1; vv < numVerts; ++vv) {
    nearest = _.find(_.keys(vertexMap), function(key) { return (pointsAreEqual(vertices[key], vertices[vv])); });
    if (nearest) {
      vertexMap[vv] = parseInt(nearest);
    } else {
      vertexMap[vv] = vv;
    }
  }
  return(vertexMap);
}

// This is not working, we need to actually compare distances between vertices to combine them

function findDuplicateVertices(vertices) {
  var vertexMapRaw = [];
  for (var v1 in vertices) {
    vertexMapRaw.push({
      index:v1, 
      value: vertices[v1].x.toFixed(5) + '_' + 
             vertices[v1].y.toFixed(5) + '_' + 
             vertices[v1].z.toFixed(5)
    });
  }
  var vertexMapSorted = _.sortBy(vertexMapRaw, 'value');
  var vertexMapDeduped = _.uniq(vertexMapSorted, true, function (p) { return (p.value) });

  var duplicatePointers = {};
  _.each(vertexMapRaw, function(item) {
    var key = _.find(vertexMapDeduped, function(vmd) {return vmd.value == item.value });
    duplicatePointers[item.index] = parseInt(key.index);
  });

  return(duplicatePointers);
}
    
function correctDuplicateVertices(geometry) {
  var vertexMap = createDuplicateVertexMap(geometry.vertices);
  for (var face of geometry.faces) {
    face.a = vertexMap[face.a];
    face.b = vertexMap[face.b];
    face.c = vertexMap[face.c];
  }
}



function fillInOneEdgeMap(v1,v2,face,edgeMap) {
  var edgeKey = v1 + '_' + v2;
  var reverseEdgeKey = v2 + '_' + v1;
/*
  console.log('edgeKey:', edgeKey, 'reverseEdgeKey:', reverseEdgeKey, 'face:[', face.a, face.b,face.c, face.a, '] [',
              csgPrimitives.children[0].geometry.vertices[v1],
              csgPrimitives.children[0].geometry.vertices[v2],
              ']'
  );
*/

/*
  var fixAmt = 1;
  if ((csgPrimitives.children[0].geometry.vertices[v1].x.toFixed(fixAmt) == csgPrimitives.children[0].geometry.vertices[15].x.toFixed(fixAmt)) &&
      (csgPrimitives.children[0].geometry.vertices[v1].y.toFixed(fixAmt) == csgPrimitives.children[0].geometry.vertices[15].y.toFixed(fixAmt)) &&
      (csgPrimitives.children[0].geometry.vertices[v1].z.toFixed(fixAmt) == csgPrimitives.children[0].geometry.vertices[15].z.toFixed(fixAmt))) {
    console.log('v1 == v[15], v1=', v1);
  }
  if ((csgPrimitives.children[0].geometry.vertices[v2].x.toFixed(fixAmt) == csgPrimitives.children[0].geometry.vertices[15].x.toFixed(fixAmt)) &&
      (csgPrimitives.children[0].geometry.vertices[v2].y.toFixed(fixAmt) == csgPrimitives.children[0].geometry.vertices[15].y.toFixed(fixAmt)) &&
      (csgPrimitives.children[0].geometry.vertices[v2].z.toFixed(fixAmt) == csgPrimitives.children[0].geometry.vertices[15].z.toFixed(fixAmt))) {
    console.log('v2 == v[15], v2=', v2);
  }
  if ((csgPrimitives.children[0].geometry.vertices[v1].x.toFixed(fixAmt) == csgPrimitives.children[0].geometry.vertices[16].x.toFixed(fixAmt)) &&
      (csgPrimitives.children[0].geometry.vertices[v1].y.toFixed(fixAmt) == csgPrimitives.children[0].geometry.vertices[16].y.toFixed(fixAmt)) &&
      (csgPrimitives.children[0].geometry.vertices[v1].z.toFixed(fixAmt) == csgPrimitives.children[0].geometry.vertices[16].z.toFixed(fixAmt))) {
    console.log('v1 == v[16], v1=', v1);
  }
  if ((csgPrimitives.children[0].geometry.vertices[v2].x.toFixed(fixAmt) == csgPrimitives.children[0].geometry.vertices[16].x.toFixed(fixAmt)) &&
      (csgPrimitives.children[0].geometry.vertices[v2].y.toFixed(fixAmt) == csgPrimitives.children[0].geometry.vertices[16].y.toFixed(fixAmt)) &&
      (csgPrimitives.children[0].geometry.vertices[v2].z.toFixed(fixAmt) == csgPrimitives.children[0].geometry.vertices[16].z.toFixed(fixAmt))) {
    console.log('v2 == v[16], v2=', v2);
  }
*/

  if (edgeMap.hasOwnProperty(edgeKey)) {
    edgeMap[edgeKey].push(face);
  } else if (edgeMap.hasOwnProperty(reverseEdgeKey)) {
    edgeMap[reverseEdgeKey].push(face);
  } else {
    edgeMap[edgeKey] = [];
    edgeMap[edgeKey].push(face);
  }

}

function updateEdgeMaps(csgPrimitive) {
  var geometry = csgPrimitive.geometry;
  var edgeMap = {};

  for (var face of geometry.faces) {
    fillInOneEdgeMap(face.a,face.b,face,edgeMap);
    fillInOneEdgeMap(face.b,face.c,face,edgeMap);
    fillInOneEdgeMap(face.c,face.a,face,edgeMap);
    face.examTime = 0;
/*
    if (face.a == 31 && face.b == 7 && face.c == 1) {
      face.color.setHex(0xff0000);
    }
*/
  }    

  csgPrimitive.edgeMap = edgeMap;
  redFace = 0;

/*
  setInterval(function() { 
    console.log('Redding face:', redFace);
    csgPrimitives.children[0].geometry.faces[redFace].color.setHex(0xff0000); 
    csgPrimitives.children[0].geometry.colorsNeedUpdate = true;
    redFace++;
  }, 1000);
*/

}

function improveTriangulation() {
  for (var csgPrimitive of csgPrimitives.children) {
    var geometry = csgPrimitive.geometry;
    var numFaces = geometry.faces.length;
    for (var soloFaceIndex = 0; soloFaceIndex < numFaces; ++soloFaceIndex) {
      splitAdjoiningFace(geometry.faces[soloFaceIndex], soloFaceIndex, geometry);
    }
    geometry.uvsNeedUpdate = true;
    geometry.elementsNeedUpdate = true;        
  }
}

// TODO: 
// [x] on each vertex create inFaces hash
// [x] only use faces on the adjacent vertices rather than looping through all faces to find adjacents


function assignVertexFaceHashes(geometry) {
  var vertices = geometry.vertices;
  var faces = geometry.faces, face;
  var theVertex;
  for (var faceIndex in faces) {
    face = geometry.faces[faceIndex];
    face.vertCopies = {};
    face.vertCopies.a = vertices[face.a].clone();
    face.vertCopies.b = vertices[face.b].clone();
    face.vertCopies.c = vertices[face.c].clone();

    for (var vertIndex of [face.a, face.b, face.c]) {
      theVertex = vertices[vertIndex];
      if (!theVertex.hasOwnProperty('inFaces')) {
        theVertex.inFaces = {};
      }
      theVertex.inFaces[faceIndex] = true;
    }
  }
}


function findCoplanarAdjacentFaces(startFaceIndex, geometry) {
  var adjoiningFaceIndexes;
  var coplanarAdjacentFaces = {};
  var coplanarAdjacentVertices = {};
  var coplanarsNormal = undefined;
  var examQueue = [];
  var examined = {};
  var examFace, examFaceIndex;
  var adjoiningFace, adjoiningFaceIndex;
  var faces = geometry.faces;
  var vertices = geometry.vertices;
  var startFace = faces[startFaceIndex];
  var perimeter = [];
  examQueue.push(startFaceIndex);
  // include the start face as a coplanar face
  coplanarAdjacentVertices[startFace.a] = true;
  coplanarAdjacentVertices[startFace.b] = true;
  coplanarAdjacentVertices[startFace.c] = true;
  coplanarAdjacentFaces[startFaceIndex] = true; 
  // Map vertices back to all faces they belong to
  assignVertexFaceHashes(geometry);

  while (examQueue.length > 0) {
    examFaceIndex = examQueue.pop();
    examFace = faces[examFaceIndex];
    // console.log('examQueue:', examQueue.length);
    adjoiningFaceIndexes = [];
    for (var vertIndex of [examFace.a, examFace.b, examFace.c]) {
      adjoiningFaceIndexes = _.union(adjoiningFaceIndexes, _.map(_.keys(vertices[vertIndex].inFaces), function(c) { return parseInt(c); }));
    }
    //console.log('adjoiningFaceIndexes:', adjoiningFaceIndexes);
    for (adjoiningFaceIndex of adjoiningFaceIndexes) {
      //console.log('Examining adjoining face index:', adjoiningFaceIndex);
      if (!examined.hasOwnProperty(adjoiningFaceIndex)) {
        if ((adjoiningFaceIndex != examFaceIndex) && (!coplanarAdjacentFaces.hasOwnProperty(adjoiningFaceIndex))) {
          //console.log('adjoiningFaceIndex:', adjoiningFaceIndex);
          adjoiningFace = faces[adjoiningFaceIndex];
          if (checkCoplanarity(examFace, adjoiningFace)) {
            var overlap1 = [adjoiningFace.a, adjoiningFace.b, adjoiningFace.c];
            var overlap2 = [examFace.a, examFace.b, examFace.c];
            var vertsInCommon = _.intersection(overlap1, overlap2);
            // Check for vertices in common. If any vertices are in comment, these coplanar faces touch at least one vertex.
            if (vertsInCommon.length > 0) {
              console.log('Pushing adjoining face due to ', vertsInCommon.length, ' vertices in common:', adjoiningFaceIndex);
              coplanarAdjacentFaces[adjoiningFaceIndex] = true;
              examQueue.push(adjoiningFaceIndex);
              coplanarAdjacentVertices[adjoiningFace.a] = true;
              coplanarAdjacentVertices[adjoiningFace.b] = true;
              coplanarAdjacentVertices[adjoiningFace.c] = true;
              if (!coplanarsNormal) {
                coplanarsNormal = adjoiningFace.normal.clone();
              }
            } else {
              // it's possible the adjoining face only touches vertices to the middle of edges, so check for that.
              edgeIntersectExam:
              for (var i = 0; i < FACELEN; ++i) {
                adjoinP1 = overlap1[i];
                adjoinP2 = overlap1[(i + 1) % FACELEN];
                for (var j = 0; j < FACELEN; ++j) {
                  splitPoint = distToSegmentSquared3d(vertices[overlap2[j]], vertices[adjoinP1], vertices[adjoinP2]);
                  if (splitPoint.distance < POINT_ON_LINE_TOLERANCE) {
                    console.log('Adding adjoining face due to edge intersection:', adjoiningFaceIndex);
                    console.log('j=', j, 'Source face:', examFaceIndex, examFace, 'We found split point on adjoining face index:', adjoiningFaceIndex, adjoiningFace);
                    coplanarAdjacentFaces[adjoiningFaceIndex] = true;
                    examQueue.push(adjoiningFaceIndex);
                    coplanarAdjacentVertices[adjoiningFace.a] = true;
                    coplanarAdjacentVertices[adjoiningFace.b] = true;
                    coplanarAdjacentVertices[adjoiningFace.c] = true;
                    if (!coplanarsNormal) {
                      coplanarsNormal = adjoiningFace.normal.clone();
                    }
                    break edgeIntersectExam;
                  }
                }
              }              
            }
          } else {
            var overlap1 = [adjoiningFace.a, adjoiningFace.b, adjoiningFace.c];
            var overlap2 = [examFace.a, examFace.b, examFace.c];
            var vertsInCommon = _.intersection(overlap1, overlap2);
            if (vertsInCommon.length) {
              console.log('vertsInCommon btwn examFace:', examFaceIndex, examFace, 'and adjoinFace:', adjoiningFaceIndex, adjoiningFace);
            }
            if (vertsInCommon.length > 1) {
              console.log('Pushed non-coplanar faces with verts in common being:', vertsInCommon);
              perimeter.push({ verts: [vertsInCommon[0], vertsInCommon[1]],  walked: false});
            }
          }
        }
      }
    }
    examined[examFaceIndex] = true;
  }

  return ({ faces: coplanarAdjacentFaces, vertices: coplanarAdjacentVertices, normal:coplanarsNormal, perimeter: perimeter });
}

function displayPerimeterEdges(perimeter, vertices) {
  for (var pp in perimeter) {
    console.log('Edge:', pp, 'Verts:', perimeter[pp].verts[0], perimeter[pp].verts[1], vertices[perimeter[pp].verts[0]], vertices[perimeter[pp].verts[1]]);
  }
}

function displayOriginalPerimeterVertices(perimeterVertices, vertices, addLabels) {
  for (var vv in perimeterVertices) { 
    console.log('Original perimeter vertex:', vv, '->', vertices[vv].x, vertices[vv].z);
    if (addLabels) {
      var spritey = makeTextSprite( vv, 
                                    { fontsize: 48,
                                      fontface: 'Arial',
                                      textColor: {r:255, g:255, b:0, a:1.0}, 
                                      borderColor: {r:255, g:255, b:255, a:1.0}, 
                                      backgroundColor: {r:0, g:0, b:0, a:0.8} } );
      spritey.position.set(vertices[vv].x, vertices[vv].y - .02, vertices[vv].z);
//      parent.add(spritey);
    }
  }
}

function displayPerimeterVertices(perimeterVertices, vertices, addLabels) {
  for (var vv of perimeterVertices) { 
    console.log('Final perimeter vertex:', vv,'->', vertices[vv].x, vertices[vv].z);
    if (addLabels) {
      var spritey = makeTextSprite( vv, 
                                    { fontsize: 48,
                                      fontface: 'Arial',
                                      textColor: {r:255, g:255, b:0, a:1.0}, 
                                      borderColor: {r:255, g:255, b:255, a:1.0}, 
                                      backgroundColor: {r:0, g:0, b:0, a:0.8} } );
      spritey.position.set(vertices[vv].x, vertices[vv].y - .02, vertices[vv].z);
//      parent.add(spritey);
    }
  }
}

function assignFacesToCoplanarGroups(csgPrimitive) {
  var geometry = csgPrimitive.geometry;
  var faceIndexList = _.mapObject(_.keys(geometry.faces), function() { return true; });
  var processedFaces = {};
  var coplanarFaces;
  var faces = geometry.faces;
  var intIndex;
  var coplanarGroupMax;
  var coplanarGroups = [];
  for (var processFaceIndex in faceIndexList) {
    intIndex = parseInt(processFaceIndex);
    if (!processedFaces.hasOwnProperty(intIndex)) {
      if (coplanarGroups.length == 3) {
        // debugger;
      }
      var coplanars = findCoplanarAdjacentFaces(processFaceIndex, geometry);
      coplanarGroups.push({ faces: coplanars.faces, vertices: coplanars.vertices, normal: coplanars.normal, perimeter: coplanars.perimeter });
      coplanarGroupMax = coplanarGroups.length - 1;
      for (var groupedFaceIndex in coplanars.faces) {
        faces[groupedFaceIndex].coplanarGroupIndex = coplanarGroupMax;
        //faces[groupedFaceIndex].color.setHex(0x0000ff);
        processedFaces[groupedFaceIndex] = true;
      }
    }
  }
  geometry.coplanarGroups = coplanarGroups;
  //geometry.colorsNeedUpdate = true;
}

function assignFacesToAllCoplanarGroups() {
  var now = new Date();
  var startTime = now.getTime();
  for (var csgPrimitive of csgPrimitives.children) {
    assignFacesToCoplanarGroups(csgPrimitive);
  }
  var later = new Date();
  var duration = later.getTime() - startTime;
  console.log('Done assigning faces to coplanar groups in:', duration, 'ms');
}

function faceInCutplane(face, vertices) {
  return ( (Math.abs(vertices[face[0]].z - plane.position.z) < FACE_IN_PLANE_TOLERANCE) &&
           (Math.abs(vertices[face[1]].z - plane.position.z) < FACE_IN_PLANE_TOLERANCE) &&
           (Math.abs(vertices[face[2]].z - plane.position.z) < FACE_IN_PLANE_TOLERANCE)
  );
}

// TODO: merge two colinear line segment edges into one if no other edge also connects to the vertex that joins the two
function createFacesFromPerimeters() {
  for (var csgPrimitive of csgPrimitives.children) {
    var geometry = csgPrimitive.geometry;
    for (var coplanarGroupIndex in geometry.coplanarGroups) {
      var perimeter = geometry.coplanarGroups[coplanarGroupIndex].perimeter;
      var vertices = [];
      var ctr = 0;
      vertices.push(perimeter[0].verts[0]);
      var nextVert = perimeter[0].verts[1];
      perimeter[0].walked = true;
      while (ctr < perimeter.length) {
        vertices.push(nextVert);
        for (var scanner in perimeter) {
          if (!perimeter[scanner].walked) {
            if ((perimeter[scanner].verts[0] == nextVert) && (_.indexOf(_.last(vertices, vertices.length - 1), perimeter[scanner].verts[1]) == -1)) {
              perimeter[scanner].walked = true;
              nextVert = perimeter[scanner].verts[1];
              console.log('Found nextVert:', nextVert, 'at position 1 at scanner:', scanner); 
//              if (perimeter[scanner].verts[1] == 103) {
//                debugger;
//              }
              break;
            } else if ((perimeter[scanner].verts[1] == nextVert) && (_.indexOf(_.last(vertices, vertices.length - 1), perimeter[scanner].verts[0]) == -1)) {
              perimeter[scanner].walked = true;
              nextVert = perimeter[scanner].verts[0];
              console.log('Found nextVert:', nextVert, 'at position 0 at scanner:', scanner); 
              break;
            }
          }
        }
        if (nextVert == vertices[0]) {
          console.log('Reached first vertex, stopping now.');
          ctr = perimeter.length - 1;
        }
        ctr++;
      }
      if (true || coplanarGroupIndex == 3) {
        console.log('Perimeter edges for coplanarGroupIndex:', coplanarGroupIndex);
        displayPerimeterEdges(perimeter, geometry.vertices);
        console.log('Original perimeter vertices for coplanarGroupIndex:', coplanarGroupIndex);
        displayOriginalPerimeterVertices(geometry.coplanarGroups[coplanarGroupIndex].vertices, geometry.vertices, true);
        perimeter.vertices = vertices;
        console.log('Ordered perimeter vertices for coplanarGroupIndex:', coplanarGroupIndex);
        displayPerimeterVertices(perimeter.vertices, geometry.vertices, false);
        var wallShape = new THREE.Geometry();
        for (var vv of vertices) {
          wallShape.vertices.push(new THREE.Vector3(geometry.vertices[vv].x, geometry.vertices[vv].y, geometry.vertices[vv].z));
          console.log('[', geometry.vertices[vv].x, geometry.vertices[vv].y, geometry.vertices[vv].z, ']');
        }
        wallShape.vertices.push(new THREE.Vector3(geometry.vertices[vertices[0]].x, geometry.vertices[vertices[0]].y, geometry.vertices[vertices[0]].z));
        var wallScale = 1.2;
        // wallscale += Math.random() / 2;
        wallShape.scale(wallScale,wallScale,wallScale);
        var wallLineMaterial = new THREE.LineBasicMaterial({
          color: new THREE.Color("rgb(" + parseInt(Math.random() * 255) + "," + parseInt(Math.random() * 255) + "," + parseInt(Math.random() * 255) + ")")
        });
        var line = new THREE.Line(wallShape, wallLineMaterial);
        parent.add(line);

        var spritey = makeTextSprite( coplanarGroupIndex, 
                                      { fontsize: 48,
                                        fontface: 'Georgia',
                                        textColor: {r:255, g:255, b:0, a:1.0}, 
                                        borderColor: {r:255, g:255, b:255, a:1.0}, 
                                        backgroundColor: {r:0, g:0, b:0, a:0.8} } );
        var wallShapeCentroid = new THREE.Vector3(0,0,0);
        for (var i = 0; i < vertices.length; ++i) {
          wallShapeCentroid.x += geometry.vertices[vertices[i]].x;
          wallShapeCentroid.y += geometry.vertices[vertices[i]].y;
          wallShapeCentroid.z += geometry.vertices[vertices[i]].z;
        }
        wallShapeCentroid.x = wallShapeCentroid.x / vertices.length;
        wallShapeCentroid.y = wallShapeCentroid.y / vertices.length;
        wallShapeCentroid.z = wallShapeCentroid.z / vertices.length;
        spritey.position.set(wallShapeCentroid.x,wallShapeCentroid.y, wallShapeCentroid.z);
        //parent.add(spritey);
      }

    }
  }
}

/* This section line routine works on THREE Mesh objects, but otherwise is the same as the JSModeler version (drawSectionLineJSM) above */
function drawSectionLineThreeMesh() {
  var P0, P1;
  var sectionExists;
  var face;
  var sectionEdges;
  var sectionEdgesCount = 0;
  var iKey1, iKey2, finalIKey, intersection, intersections;

  if (!(movingCutplane || dragging || firstRender) ) {
    return; // don't update the sections if not moving the cutplane
  }

  var intersectionsLog = {};
  var facesChecked = 0;
  /* Delete all previous cutSection polygons */
  if (cutSections) {
    parent.remove(cutSections);
  }
  cutSections = new THREE.Object3D();
  parent.add(cutSections);

  for (var csgPrimitive of csgPrimitives.children) {
    csgPrimitive.sectionEdges = {};
    sectionEdges = csgPrimitive.sectionEdges;
    sectionExists = false;
    var csgGeometry = csgPrimitive.geometry;
    var vertices = csgGeometry.vertices;
    var faces = csgGeometry.faces;
    for (var i = 0; i < faces.length; ++i) {
      face = [ faces[i].a, faces[i].b, faces[i].c ];
      if (!faceInCutplane(face, csgGeometry.vertices)) {
        //console.log('Examining face:', face);
        facesChecked++;
        if (facesChecked == 9) {
          //debugger;
        }
        intersections = [];
        /* for each face, find one or more places where the plane cuts across the face. add these to the sectionEdges */
        for (var j = 0; j < FACELEN; ++j) {
          //console.log('i:',i,'j:',j);
          P0 = new THREE.Vector3(vertices[face[j]].x,vertices[face[j]].y,vertices[face[j]].z);
          P1 = new THREE.Vector3(vertices[face[(j + 1) % FACELEN]].x,vertices[face[(j + 1) % FACELEN]].y,vertices[face[(j + 1) % FACELEN]].z);
          intersection = intersectLineWithPlane(P0, P1, plane.position.z);
          if (intersection.intersected) {
            intersections.push(intersection);
            intersectionsLog[intersection.intersectPoint.x.toFixed(TO_FIXED_DECIMAL_PLACES) + '_' + intersection.intersectPoint.y.toFixed(TO_FIXED_DECIMAL_PLACES)] = true;
            //console.log('found intersection: ', intersection.intersectPoint);
          }
          if (intersections.length == 2) {
            sectionExists = true;
            iKey1 = intersections[0].intersectPoint.x.toFixed(TO_FIXED_DECIMAL_PLACES) + '_' + intersections[0].intersectPoint.y.toFixed(TO_FIXED_DECIMAL_PLACES);
            iKey2 = intersections[1].intersectPoint.x.toFixed(TO_FIXED_DECIMAL_PLACES) + '_' + intersections[1].intersectPoint.y.toFixed(TO_FIXED_DECIMAL_PLACES);
            finalIKey = iKey2;
            if (!sectionEdges.hasOwnProperty(iKey1)) {
              sectionEdges[iKey1] = [];
            }
            sectionEdges[iKey1].push({ point: iKey2, face: faces[i] });
            if (!sectionEdges.hasOwnProperty(iKey2)) {
              sectionEdges[iKey2] = [];
            }
            sectionEdges[iKey2].push({ point: iKey1, face: faces[i] });
            sectionEdgesCount++;
            intersections = [];
          }
        }
      } else {
        // console.log('Skipping face:', face);
      }
    }

    if (sectionExists) {

      // debugging
      for (var seKey in sectionEdges) {
        var childCt = 0;
        for (var seChild in sectionEdges[seKey]) {
          childCt++;
        }
        if (childCt < 2) {
          console.log('Less than two children:', seKey);
        }
      }

      /* Now start at final iKey on the sectionEdges array, and walk it to build up section lines */
      var walked = {};
      var numWalked = 0;
      var currentIKey = finalIKey, nextIKey;
      var startLoopIKey = finalIKey;
      var cutSection = new THREE.Geometry();
      var sectionCoord;
      var sectionFace;
      var endedCurrentLoop;
      var coordsRaw;
      var coords;

      while (numWalked < sectionEdgesCount && currentIKey) {
        coordsRaw = currentIKey.split('_');
        coords = [ parseFloat(coordsRaw[0]), parseFloat(coordsRaw[1]) ];
        sectionCoord = new THREE.Vector3(coords[0], coords[1], plane.position.z + 0.01);
        sectionFace = sectionEdges[currentIKey];
        cutSection.vertices.push(sectionCoord);
        numWalked++;
        walked[currentIKey] = true;
        
        nextIKey = undefined;
        for (var seChild of sectionEdges[currentIKey]) {
          if (!walked.hasOwnProperty(seChild.point)) {
            nextIKey = seChild.point;
            break;
          }
        }
        /* If we got through one loop, we will not be able to advance. Scan through the section edges to find an unwalked starting point. */
        endedCurrentLoop = false;
        if (nextIKey == undefined) {
          endedCurrentLoop = true;
          /* Find a candidate to start a new loop, if we can. */
          for (var seKey in sectionEdges) {
            if (!walked.hasOwnProperty(seKey)) {
              nextIKey = seKey;
              break;
            }
          }
        }

        /* To close the loop, add back the startIKey. */
        if (endedCurrentLoop) {
          coordsRaw = startLoopIKey.split('_');
          coords = [ parseFloat(coordsRaw[0]), parseFloat(coordsRaw[1]) ];
          sectionCoord = new THREE.Vector3(parseFloat(coords[0]), parseFloat(coords[1]), plane.position.z + 0.01);
          cutSection.vertices.push(sectionCoord);

          cutSection.computeLineDistances(); // Required for dashed lines cf http://stackoverflow.com/questions/35781346/three-linedashedmaterial-dashes-dont-work
          var sectionPoly = new THREE.Line(cutSection, sectionMaterialDashed);
          sectionPoly.csgPrimitive = csgPrimitive;
          cutSections.add(sectionPoly);

          cutSection = new THREE.Geometry();
          if (nextIKey) {
            startLoopIKey = nextIKey;
          }

          /*
          console.log('Closing loop.');
          console.log('walked:');
          for (var walkedCk in walked) {
             console.log(walkedCk, csgPrimitive.sectionEdges[walkedCk]);
          }

          debugger;
          */

        }

        /* Advance from here on current loop or newly started loop */
        currentIKey = nextIKey;
      }

    }
  }
}


// --------------------------------------------------------------------------------
// Update functions
// --------------------------------------------------------------------------------

// --------------------------------------------------------------------------------
/* DEFUNCT */
// --------------------------------------------------------------------------------

function findAdjacentFaces(v1, v2, csgPrimitive) {
  var edgeKey = v1 + '_' + v2;
  var reverseEdgeKey = v2 + '_' + v1;
  if (csgPrimitive.edgeMap.hasOwnProperty(edgeKey)) {
    var f1 = csgPrimitive.edgeMap[edgeKey][0];
    var f2 = csgPrimitive.edgeMap[edgeKey][1];
  } else {
    var f1 = csgPrimitive.edgeMap[reverseEdgeKey][0];
    var f2 = csgPrimitive.edgeMap[reverseEdgeKey][1];
  }
  return ({ face1: f1, face2: f2 });
}

function findCoplanarAdjacentFacesOrig(v1, v2, evalFace, evalStack, coplanarFaces, examTime, csgPrimitive) {
  var adjacentFaces = findAdjacentFaces(v1, v2, csgPrimitive);
  if ((adjacentFaces.face1.examTime < examTime) && checkCoplanarity(evalFace,adjacentFaces.face1)) {
    evalStack.push(adjacentFaces.face1);
    coplanarFaces.push(adjacentFaces.face1);
    adjacentFaces.face1.examTime = examTime;
  }
  if ((adjacentFaces.face2.examTime < examTime) && checkCoplanarity(evalFace,adjacentFaces.face2)) {
    evalStack.push(adjacentFaces.face2);
    coplanarFaces.push(adjacentFaces.face2);
    adjacentFaces.face2.examTime = examTime;
  }
}

// --------------------------------------------------------------------------------
/* END DEFUNCT */
// --------------------------------------------------------------------------------

function checkCoplanarity(f1, f2) {
  return ((f1.normal.angleTo(f2.normal) * RAD_TO_DEG) <= COPLANAR_ANGLE_TOLERANCE);
}


function makeCoplanarGroupSelectable(coplanarGroupIndex, csgPrimitive) {
  selectableItem = { 
    type:'coplanarGroup', 
    item: csgPrimitive.geometry.coplanarGroups[coplanarGroupIndex],
    csgPrimitive: csgPrimitive
  };
  for (var faceIndex in selectableItem.item.faces) {
    csgPrimitive.geometry.faces[faceIndex].color.setHex(0xffff00);
  }
  csgPrimitive.geometry.colorsNeedUpdate = true;
}

function moveCoplanarGroup(coplanarGroup, csgPrimitive, offset) {
  var vertices = csgPrimitive.geometry.vertices;
  for (var vertIndex in coplanarGroup.vertices) {
    vertices[vertIndex].addVectors(vertices[vertIndex],offset);
  }
  csgPrimitive.geometry.elementsNeedUpdate = true;
}

function updatePickSquare() {
  //debugger;
  var nearestMin = 1e10, highlightCenter = { x: -1e10, y:-1e10 };
  var siblings, coordsArray, coord1, coord2, coordsRaw;

  for (var csgPrimitive of csgPrimitives.children) {
    for (var sectionEdge in csgPrimitive.sectionEdges) {
      coordsArray = [];
      siblings = csgPrimitive.sectionEdges[sectionEdge];
      coordsRaw = sectionEdge.split('_');
      coord1 = { x: parseFloat(coordsRaw[0]), y: parseFloat(coordsRaw[1]) };

      coordsRaw = siblings[0].point.split('_');
      coord2 = { x: parseFloat(coordsRaw[0]), y: parseFloat(coordsRaw[1]) };
      coordsArray.push(coord1);
      coordsArray.push(coord2);

      coordsArray.push(coord1);
      coordsRaw = siblings[1].point.split('_');
      coord2 = { x: parseFloat(coordsRaw[0]), y: parseFloat(coordsRaw[1]) };
      coordsArray.push(coord2);

      for (var ci = 0; ci < 4; ci += 2) {
        var nearest = distToSegmentSquared(crosshair.position,coordsArray[ci], coordsArray[ci+1])
        if ((nearest.distance < nearestMin) && (nearest.distance < 0.005)) {
          nearestMin = nearest.distance;
          highlightCenter.x = nearest.nearestPoint.x;
          highlightCenter.y = nearest.nearestPoint.y;
          if (ci == 0) {
            highlightCenter.face = csgPrimitive.sectionEdges[sectionEdge][0].face;
          } else {
            highlightCenter.face = csgPrimitive.sectionEdges[sectionEdge][1].face;
          }
        }          
      }
    }

    /* Render highlight if near a section edge */
    pickSquare.position.x = highlightCenter.x;
    pickSquare.position.y = highlightCenter.y;
    pickSquare.position.z = plane.position.z + 0.01;
    if (highlightCenter.face) {
      makeCoplanarGroupSelectable(highlightCenter.face.coplanarGroupIndex, csgPrimitive);

      for (ff in csgPrimitive.geometry.faces) {
        if (csgPrimitive.geometry.faces[ff] == highlightCenter.face) {
          addToDebugText(['active face:', 'ID:' + ff + ' V:[' + highlightCenter.face.a + ',' + highlightCenter.face.b + ',' + highlightCenter.face.c + ']']);
          break;
        }
      }
      return (true); // we found a face to highlight, so do not try to highlight entire objects
    }
  }
  return(false);
}


function updateCutplaneProjectionVector() {
  var cutplaneNormal = new THREE.Vector3(0,0,1);
  cutplaneNormal.applyAxisAngle(new THREE.Vector3(1,0,0), roomRotateX);
  cutplaneNormal.applyAxisAngle(new THREE.Vector3(0,1,0), roomRotateY);
  var cutplaneNormal2D_1 = project3DVectorIntoScreenSpace(0,0,0, camera, window.innerWidth, window.innerHeight);
  var cutplaneNormal2D_2 = project3DVectorIntoScreenSpace(cutplaneNormal.x, cutplaneNormal.y, cutplaneNormal.z, camera, window.innerWidth, window.innerHeight);
  cutplaneVectorScreenSpace = new THREE.Vector2(cutplaneNormal2D_2.x - cutplaneNormal2D_1.x, 
                                                cutplaneNormal2D_2.y - cutplaneNormal2D_1.y );
  cutplaneVectorScreenSpace.normalize();
  cutplaneVector2dStr = '[' + cutplaneNormal.x + ',' + cutplaneNormal.y + ',' + cutplaneNormal.z + ' : ' + 
                        cutplaneVectorScreenSpace.x + ',' + cutplaneVectorScreenSpace.y + ']';
}

function updateRoomView() {
  if (wasRotatingRoom != rotatingRoom) {
    if (wasRotatingRoom) {
      // console.log('Stopped rotating room, calculating adjustment.');
      cursorAdjust.x = cursorAdjust.x + (cursorPreMove.x - cursor.current.x);
      cursorAdjust.y = cursorAdjust.y + (cursorPreMove.y - cursor.current.y);
    } else {
      // console.log('started rotating room, saving cursor position');
      cursorPreMove.x = cursor.current.x;
      cursorPreMove.y = cursor.current.y;
    }
    wasRotatingRoom = rotatingRoom;

  }
  if (rotatingRoom) {
    var cursorXdiff = (cursor.current.x - cursor.last.x);
    var cursorYdiff = (cursor.current.y - cursor.last.y);
/*
    roomRotateX = Math.min(90 * DEG_TO_RAD, Math.max(0, roomRotateX + cursorYdiff * DEG_TO_RAD));
    roomRotateY = Math.min(90 * DEG_TO_RAD, Math.max(-90 * DEG_TO_RAD, roomRotateY + cursorXdiff * DEG_TO_RAD));
*/
    roomRotateX = Math.min(180 * DEG_TO_RAD, Math.max(-180, roomRotateX + cursorYdiff * DEG_TO_RAD));
    roomRotateY = Math.min(180 * DEG_TO_RAD, Math.max(-180 * DEG_TO_RAD, roomRotateY + cursorXdiff * DEG_TO_RAD));
    //console.log('roomRotateX:', roomRotateX, 'roomRotateY:', roomRotateY);
  }
  parent.rotation.x = roomRotateX;
  parent.rotation.y = roomRotateY;

  updateCutplaneProjectionVector();
  
}

// http://stackoverflow.com/questions/3437786/get-the-size-of-the-screen-current-web-page-and-browser-window
function updateCrosshair() {
  /* New algo: when user pauses for a few seconds, make this the new center of offsets and map from there, up to about 1/4 of window.innerWidth */
  if ((wasMovingPlane != movingCutplane) || (wasRotatingRoom != rotatingRoom)) {
    if (wasMovingPlane || wasRotatingRoom) {
      // console.log('Stopped moving plane or rotating, calculating adjustment.');
      cursorAdjust.x = cursorAdjust.x + (cursorPreMove.x - cursor.current.x);
      cursorAdjust.y = cursorAdjust.y + (cursorPreMove.y - cursor.current.y);
    } else {
      // console.log('started moving plane or rotating, saving cursor position');
      cursorPreMove.x = cursor.current.x;
      cursorPreMove.y = cursor.current.y;
    }
    wasMovingPlane = movingCutplane;
    wasRotatingRoom = rotatingRoom;
  }
  if (!movingCutplane && !rotatingRoom) {
    var prevCrossHair = { x: crosshair.position.x, y: crosshair.position.y };
    crosshair.position.x = Math.max(-1, Math.min(1, ( 2.0 * ((cursor.current.x + cursorAdjust.x) / (window.innerWidth  / 1.75)))  - 2.0));
    crosshair.position.y = Math.max(-1, Math.min(1, (-2.0 * ((cursor.current.y + cursorAdjust.y) / (window.innerHeight / 1.75))) + 2.0));
    if (pickedItems.length && dragging) {
      var xDiff = crosshair.position.x - prevCrossHair.x;
      var yDiff = crosshair.position.y - prevCrossHair.y;
      for (var pickedItem of pickedItems) {
        switch (pickedItem.type) {
          case 'coplanarGroup':
            addToDebugText(['Clicking coplanarGroup']);
            var diffVector = new THREE.Vector3(xDiff, yDiff, 0);
            var projectedVector = projectOntoVector(diffVector, pickedItem.item.normal);
            moveCoplanarGroup(pickedItem.item, pickedItem.csgPrimitive, projectedVector);
            break;
          case 'mesh':
          default:
            pickedItem.item.geometry.translate(xDiff, yDiff, 0.0);
            break;
        }
      }
      // console.log('Translating object by:', xDiff, yDiff);
    } else {
      updateSelectableItem();
    }
  }

/*
             'cursorX:', cursor.current.x,
             'cursorY:', cursor.current.y,
             'X:',       crosshair.position.x, 
             'Y:',       crosshair.position.y,
             'Z:',       plane.position.z,
             'rotX:',    roomRotateX,
             'rotY:',    roomRotateY,
             'cursorAdjust.X:', cursorAdjust.x,
             'cursorAdjust.Y:', cursorAdjust.y
  ]);
  */

}

// DEFUNCT:
// Version that moves by deltas. This doesn't work at all because you cant "pick up the mouse" with a trackpad.
// canonical, basic mapping:
// crosshair.position.x = ( 2.0 * (cursor.current.x / window.innerWidth))  - 1.0;
// crosshair.position.y = (-2.0 * (cursor.current.y / window.innerHeight)) + 1.0;

function updateCrosshair2() {
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
    var cursorDiff = new THREE.Vector2(
      (cursor.current.x - cursor.last.x) * .01,
      (cursor.current.y - cursor.last.y) * .01
    );
    var projectedVector = projectOntoVector(cursorDiff, cutplaneVectorScreenSpace);
    var projectedVectorNormalized = projectedVector.clone();
    projectedVectorNormalized.normalize();
    var dotProd = projectedVectorNormalized.dot(cutplaneVectorScreenSpace);
    var planeDiff = projectedVector.length() * dotProd;  // if we are moving the same direction as cutplaneVectorScreenSpace, dotProd will be 1, otherwise, dotProd will be -1.

    if( Math.abs(planeDiff) > 0 ){
      var prevPlaneZ = plane.position.z;
      plane.position.z = Math.max(-1, Math.min(plane.position.z + planeDiff, 1.0));

      if (dragging) {
        var zDiff = plane.position.z - prevPlaneZ;
        for (var pickedItem of pickedItems) {
          pickedItem.item.geometry.translate(0,0, zDiff);
        }
        // console.log('Translating object in Z by:', zDiff);
      }

    }
    
  }
}

function updateCursorTracking() {
  cursor.last.x = cursor.current.x;
  cursor.last.y = cursor.current.y;
}

function updateSelectableItem() {
  var selectMesh;

  // First move away any previously displayed selectable highlight
  if (selectableItem) {
    if (selectableItem.type == 'mesh') {
      selectMesh = selectableItem.selectMesh;
      selectMesh.position.x = 10000;
    } else if (selectableItem.type == 'coplanarGroup') {
      for (var faceIndex in selectableItem.item.faces) {
        selectableItem.csgPrimitive.geometry.faces[faceIndex].color.setHex(0xffffff);
      }
      selectableItem.csgPrimitive.geometry.colorsNeedUpdate = true;
    }
    selectableItem = { type: 'none' };
  }

  if (!updatePickSquare()) {
    if (cutSections && cutSections.children && cutSections.children.length > 0) {
      var cutSection, csgPrimitive;
      for (var cutSection of cutSections.children) {
        csgPrimitive = cutSection.csgPrimitive;

        if (pointInPoly(crosshair.position, cutSection.geometry.vertices)) {
          // console.log('inside section line, crosshair:', crosshair.position.x, crosshair.position.y);
          // now we can use csgPrimitiveMesh.translate(x,y,z) to drag it around
          selectableItem = { 
            type:'mesh', 
            item: csgPrimitive,
            selectMesh: csgPrimitive.selectMesh          
          };
          selectableItem.selectMesh.position.x = 0;
          break;
        }
      }
    }
  }      
}

function checkWireFrameToggle() {
  if (window.wKeyPressed) {
    if (useWireFrame == previousUseWireFrame) {
      useWireFrame = !useWireFrame;
      if (useWireFrame) {
        for (var csgPrimitive of csgPrimitives.children) {
          csgPrimitive.material = window.csgPrimitiveMaterialWire;
        }
      } else {
        for (var csgPrimitive of csgPrimitives.children) {
          csgPrimitive.material = window.csgPrimitiveMaterialFlat;
        }
      }
      console.log('useWireFrame:', useWireFrame);
    }
  } else {
    previousUseWireFrame = useWireFrame;
  }
}

// --------------------------------------------------------------------------------
// Main loop begins
// --------------------------------------------------------------------------------


function render() {
  requestAnimationFrame( render );
  renderer.render( scene, camera );
  movingCutplane = window.optionKeyPressed;
  rotatingRoom = window.cmdKeyPressed;

  checkWireFrameToggle();
  updateRoomView();
  updateCrosshair();
  updateCutplane();
  updateCursorTracking();
  drawSectionLineThreeMesh();

  renderDebugText();

  firstRender = false;

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


setupCSGModels();
setupHelp();
setupCutplane();
setupRoom();
updateCutplaneProjectionVector();
setupCrosshair();
setupPickSquare();

camera.position.set( 0, 0, 5);
//controls.update();
//setupSimpleTest();
setupLights();
//setupCSGTest();
setupNewCSGTest();

improveTriangulation();
assignFacesToAllCoplanarGroups();
createFacesFromPerimeters();

render();


