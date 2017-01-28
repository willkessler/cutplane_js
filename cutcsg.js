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
var csgObjects;
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


function cleanNegZero(negZero) {
  return((negZero == -0) ? 0 : negZero);
}

function setupNewCSGTest() {
  csgObjects = new THREE.Object3D();
  parent.add(csgObjects);

  //var a = CSG.cube();
  var a = CSG.cube({ radius:0.5 });
  var b = CSG.cube ({ radius:[1,0.3,0.3], center:[0.25, 0.65, 0] });
  var c = a.subtract(b);

  var polygons = c.toPolygons();

  cGeo = c.toMesh();
  var mesh = new THREE.Mesh( cGeo, csgPrimitiveMaterialFlat);  
  mesh.rawCsgObject = c;

  var bsp = new CSG.Node(c.clone().polygons);
  bsp.translate(0,0,0);

  mesh.bsp = bsp;

  csgObjects.add(mesh);
  setupSelectMesh(mesh);
  console.log(cGeo);
  
  //var bsp = new CSG.Node(c.clone().polygons);
  //var testPoint = new CSG.Vector(0.4999,.49,.49);
  //var inside = bsp.pointInside(testPoint);
  //console.log('inside:', inside);
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

function faceInCutplane(face, vertices) {
  return ( (Math.abs(vertices[face[0]].z - plane.position.z) < FACE_IN_PLANE_TOLERANCE) &&
           (Math.abs(vertices[face[1]].z - plane.position.z) < FACE_IN_PLANE_TOLERANCE) &&
           (Math.abs(vertices[face[2]].z - plane.position.z) < FACE_IN_PLANE_TOLERANCE)
  );
}


/* This section line routine works on THREE Mesh objects, but otherwise is the same as the JSModeler version (drawSectionLineJSM) above */
function drawSectionLineCSG() {
  var P0, P1;
  var sectionExists;
  var face;
  var sectionEdges;
  var sectionEdgesCount = 0;
  var iKey1, iKey2, finalIKey, intersection, intersections;

  if (!(movingCutplane || dragging || firstRender) ) {
    return; // don't update the sections if not moving the cutplane
  }
  if (!csgObjects) {
    return;
  }


  var intersectionsLog = {};
  var facesChecked = 0;
  /* Delete all previous cutSection polygons */
  if (cutSections) {
    parent.remove(cutSections);
  }
  cutSections = new THREE.Object3D();
  parent.add(cutSections);

  for (var csgObject of csgObjects.children) {
    var rawCsgObject = csgObject.rawCsgObject;
    csgObject.sectionEdges = {};
    sectionEdges = csgObject.sectionEdges;
    sectionExists = false;
    var csgGeometry = rawCsgObject.geometry;
    var vertices = csgGeometry.vertices;
    var faces = rawCsgObject.polygons;
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
          sectionPoly.csgObject = csgObject;
          cutSections.add(sectionPoly);

          cutSection = new THREE.Geometry();
          if (nextIKey) {
            startLoopIKey = nextIKey;
          }

          /*
          console.log('Closing loop.');
          console.log('walked:');
          for (var walkedCk in walked) {
             console.log(walkedCk, csgObject.sectionEdges[walkedCk]);
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

  if (!csgObjects) {
    return(false);
  }

  for (var csgPrimitive of csgObjects.children) {
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

    var mainObj = csgObjects.children[0];
    var testPoint = new CSG.Vector(crosshair.position.x, crosshair.position.y, plane.position.z);
    var inside = mainObj.bsp.pointInside(testPoint);
    console.log('cursor inside:',inside);

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
        for (var csgPrimitive of csgObjects.children) {
          csgPrimitive.material = window.csgPrimitiveMaterialWire;
        }
      } else {
        for (var csgPrimitive of csgObjects.children) {
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
//  drawSectionLineCSG();

  renderDebugText();

  firstRender = false;

}

var scene = new THREE.Scene();
var camera = new THREE.PerspectiveCamera( 30, window.innerWidth / window.innerHeight, 1, 100 );

var renderer = new THREE.WebGLRenderer();
renderer.setSize( window.innerWidth, window.innerHeight );
document.body.appendChild( renderer.domElement );

// parent
parent = new THREE.Object3D();
scene.add( parent );

setupHelp();
setupCutplane();
setupRoom();
updateCutplaneProjectionVector();
setupCrosshair();
setupPickSquare();

camera.position.set( 0, 0, 5);
setupLights();
setupNewCSGTest();

render();


