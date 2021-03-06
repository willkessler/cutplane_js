// TODOS: 
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

//  [X] Make extrusion for polygon dragging and drag the whole coplanar group
//  [X] Make extrusion only fire when you start dragging the face. If you just pick it, it should do nothing
//  [X] Make it so that you can't drag the extrusion face inside the extrusion, or if you do it switches to extending the bottom face and does a subtract() instead of union().
//  [X] Fix section line bug where sometimes it will jump over the surface
//  [X] Picked items should indicate they're still picked, e.g. selectMesh should stay green
//  [ ] Select and drag in-plane faces and prevent section line bug when faces are in plane. Highlight in-plane faces correctly.
//  [ ] Slice objects in half at cutplane
//  [ ] Keep dragged polygons looking picked while being dragged
//  [ ] Restore the rotate tool but make it smarter about snapping faces into the plane. 
//  [ ] Marching ants section line bug
//  [X]  *) rotate tool around Z axes when you drag side circles
//  [X]  *) make x and y axes work correctly when z rotate applied
//  [ ]  *) hold down shift key while rotating, and we snap to whatever faces can be made parallel or 90 degrees to the cutplane, e.g. cuboid will rotate by 90 deg increments
//  [ ] BUG: After dragging we should deselect text as this is interfering with mouse movements
//  [ ] BUG: Rotate and then drag faces, and sometimes the coplanarity check fails
//  [X]  *) rotate objects around section line
//  [ ]  *) pick object when you snap rotate tool to its section line so you can immediately rotate it
//  [ ]  *) make rotated objects snap back to start point when you pass it, and/or when faces are parallel to the plane
//  [ ]  *) if inside object and you hit R, snap to center point between max and min points of all section lines that intersect xaxis aligned with crosshair
//  [X]  *) snap it to sectionline
//  [X]  *) R jumps rotate tool to cursor
//  [X]  *) show highlights on it when you hover 
//  [X]  *) We have to put each object in an Object3D of its own so we can use RotateOnAxis;
//  [X]  *) rotate picked objects around it 
//  [X]  *) lock cursor on it when you drag on it. 
//  [ ] Restore the tool chests with colors (toggle colors on/off)
//  [X] Clean up all the messy code leftovers
//  [ ] If extrusion isn't dragged to create anything new, just cancel the boolean op
//  [ ] Extrusion inward to subtract
//  [ ] Make it possible to select polygons that are flush in the cutplane
//  [ ] Load/save models to cloud
//  [ ] Inspect how we could store objects in google drive or github repos
//  [ ] If looking at room from behind, reverse the cursor controls
//  [ ] Use mousewheel to zoom in and out
//  [ ] Scale boxes to resize objects in any direction, when object is picked
//  [ ] Reinstate shadow on the ground (use lights?)
//  [ ] restore snapping of faces to other faces. maybe use physics libraries to let objects press up against each other and stop

//  [ ] Can we do an algo where we pick the highest vertex and then walk edges picking the edge that has the greatest angle as the next edge each time? look at crossprod to get angle btwn vectors and 
//      pay attention to the direction of the vector to make sure you're taking the inside angle every time. Alternatively, use raycasting approach.
//  [X] Support grabbing edges and dragging them and update the model . Robust point in poly: cf https://github.com/mikolalysenko/robust-point-in-polygon
//  [ ] Separately compute faces that are in the plane and highlight them differently
//  [ ] restore booleans manipulations within the UI cf http://learningthreejs.com/blog/2011/12/10/constructive-solid-geometry-with-csg-js/
//  [ ] cmd-z to undo drags
//  [X] Fix the coplanar faces issues on the CSG boolean results

// http://jsfiddle.net/hbt9c/317/

// basic threejs tutorial: https://manu.ninja/webgl-3d-model-viewer-using-three-js

var FACELEN = 3; // triangles by default in meshes
var ROOM_SIZE = 1.0;
var RAD_TO_DEG = 180 / Math.PI;
var DEG_TO_RAD = Math.PI / 180;
var FACE_IN_PLANE_TOLERANCE = 0.0001;
var POINT_ON_POINT_TOLERANCE = 0.001;
var POINT_ON_LINE_TOLERANCE = 0.001;
var POINT_ON_PLANE_TOLERANCE = 0.001;
var NORMAL_TO_CUTPLANE_TOLERANCE = 0.001;
var TO_FIXED_DECIMAL_PLACES = 4;
var COPLANAR_ANGLE_TOLERANCE = .1; // degrees, not radians
var COPLANAR_DRAG_TOLERANCE = 0.0015;
var SELECT_STATUSES = {
  'HIDDEN' : 0x00,
  'SELECTABLE' : 0x01,
  'PICKED' : 0x02
}

var parent;
var plane;
var crosshair;
var rotateTool;
var cutplaneVectorScreenSpace;
var csgObjects;

var controls;
var vertices;
var faces;
var pickSquare;
var selectMeshMaterialSelectable;
var selectMeshMaterialPicked;
var selectMeshMaterialPickedAndSelectable;

var selectableItem = { type: 'none' };
var pickedItems = [];


var pickedList = [];
var dragging = false;
var rotating = false;
var mergeParent = undefined;
var movingCutplane = false;
var checkForCoplanarDragging = false;
var coplanarDragBegun = false;
var coplanarDragStart;
var coplanarDraggable;
var coplanarDragTotal;
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
var inplanePolygons = {};
var firstRender = true;
var coplanarGroupHighlight;

var debugTextArray = [];
var allLabels = [];

var cursor = { current: {x:0, y:0}, last: {x:0,y:0} };

var lineMaterial = new THREE.LineBasicMaterial({
  color: 0xffffff
});

var lineMaterialGreen = new THREE.LineBasicMaterial({
  color: 0x00ff00
});


var csgObjectMaterialFlat = new THREE.MeshStandardMaterial ( {
  shading: THREE.FlatShading,
  color:0xffffff,
  side: THREE.DoubleSide,
  vertexColors: THREE.FaceColors // you need this if you want to change face colors later
} );

//var material = new THREE.MeshLambertMaterial({color: 0x5555ff, transparent: true, opacity: 0.95, side: THREE.DoubleSide });
var polygonHighlightTexture = new THREE.TextureLoader().load( "images/grid2.jpg" );
polygonHighlightTexture.wrapS = THREE.RepeatWrapping;
polygonHighlightTexture.wrapT = THREE.RepeatWrapping;
polygonHighlightTexture.repeat.set(22,22 );

var polygonHighlightMaterial = new THREE.MeshLambertMaterial ( {
  map: polygonHighlightTexture,
  transparent: true,
  side: THREE.DoubleSide,
  shading: THREE.FlatShading,
  color:0xffff00,
  vertexColors: THREE.FaceColors // you need this if you want to change face colors later
} );

// http://stackoverflow.com/questions/20153705/three-js-wireframe-material-all-polygons-vs-just-edges
var csgObjectMaterialWire = new THREE.MeshBasicMaterial ( {
  color:0xffffff,
  wireframe: true
} );

var SELECTMESH_MATERIALS = [];
SELECTMESH_MATERIALS[1] = new THREE.MeshBasicMaterial( { color: 0XFFFF00, side: THREE.BackSide } );
SELECTMESH_MATERIALS[2] = new THREE.MeshBasicMaterial( { color: 0X00CC00, side: THREE.BackSide } );
SELECTMESH_MATERIALS[3] = new THREE.MeshBasicMaterial( { color: 0X00FF00, side: THREE.BackSide } );


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
      break;
    case 70: // "f" key flush or flip command
      console.log('Flush key pressed');
      flushSelectableObject();
      break;
    case 82: // R key
      toggleRotateTool();
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
function dist3slow(v, w) { return Math.sqrt(sqr(v.x - w.x) + sqr(v.y - w.y) + sqr(v.z - w.z)) }
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
  var planeProjection1 = new THREE.Vector3(P0.x, P0.y, planeZ);
  var planeProjection2 = new THREE.Vector3(P1.x, P1.y, planeZ);
  if ((dist3(P0, planeProjection1) < POINT_ON_PLANE_TOLERANCE) && (dist3(P1, planeProjection2) < POINT_ON_PLANE_TOLERANCE)) {
    // line segment is in the plane
    return({intersected: true,
            intersectPoint: P0,
            whichEndpoint: 2 // ie, both
    });
  }
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
  var whichEndpoint = -1;
  if ((s1 >= 0.0) && (s1 <= 1.0)) {
    var intersectPoint = new THREE.Vector3();
    intersectPoint.copy(P0);
    var offset = u.multiplyScalar(s1);
    intersectPoint.add(offset);
    if (s1 < FACE_IN_PLANE_TOLERANCE) {
      //console.log('point 0', P0.x, P0.y, P0.z, ' on plane with P1=', P1.x, P1.y, P1.z);
      whichEndpoint = 0;
    } else if  (1.0 - s1 < FACE_IN_PLANE_TOLERANCE) {
      //console.log('point 1', P1.x, P1.y, P1.z, ' on plane with P0=', P0.x, P0.y, P0.z);
      whichEndpoint = 1;
    }
    //console.log('Intersection found at', intersectPoint, ' between P0:', P0.x, P0.y, P0.z, ' and P1:', P1.x, P1.y, P1.z);
    return({intersected: true,
            intersectPoint: intersectPoint,
            whichEndpoint: whichEndpoint
    });
  } else {
    //console.log('No intersection found, P0:', P0.x, P0.y, P0.z, ' and P1:', P1.x, P1.y, P1.z);
    return({intersected: false});
  }
}

function pointsAreEqual(P0, P1) {
  return (dist3(P0, P1) < POINT_ON_POINT_TOLERANCE * POINT_ON_POINT_TOLERANCE);
}

/* From: http://stackoverflow.com/questions/27409074/converting-3d-position-to-2d-screen-position-r69, answer 3 */
function project3DVectorIntoScreenSpace(x, y, z, camera, width, height) {
  var p = new THREE.Vector3(x, y, z);
  var vector = p.project(camera);

  vector.x = (vector.x + 1) / 2 * width;
  vector.y = -(vector.y - 1) / 2 * height;

  return vector;
}

function midPoint(coords) {
  return (new CSG.Vector(((coords[1].x - coords[0].x) / 2) + coords[0].x,
                         ((coords[1].y - coords[0].y) / 2) + coords[0].y,
                         ((coords[1].z - coords[0].z) / 2) + coords[0].z) );
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

// From: http://stackoverflow.com/questions/20774648/three-js-generate-uv-coordinate
function assignUvs(geometry) {
  geometry.faceVertexUvs[0] = [];
  _.each(geometry.faces, function(face) {
    var components = ['x', 'y', 'z'].sort(function(a, b) {
      return Math.abs(face.normal[a]) > Math.abs(face.normal[b]);
    });

    var v1 = geometry.vertices[face.a];
    var v2 = geometry.vertices[face.b];
    var v3 = geometry.vertices[face.c];

    geometry.faceVertexUvs[0].push([
      new THREE.Vector2(v1[components[0]], v1[components[1]]),
      new THREE.Vector2(v2[components[0]], v2[components[1]]),
      new THREE.Vector2(v3[components[0]], v3[components[1]])
    ]);

  });
  geometry.uvsNeedUpdate = true;
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
                    '<li><div class="key">W</div><div class="hintText">Toggle wireframe display</div></li>' +
                    '<li><div class="key">Mouse-wheel</div><div class="hintText">Zoom</div></li>' +
                    '<li><div class="key">Cmd-Z</div><div class="hintText">Undo last change</div></li>' +
                    '<li><div class="key">Shift-Cmd-Z</div><div class="hintText">Redo last change</div></li>' +
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

  plane.position.z = 0.5;
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
  pickSquare = { 
    visible: false,
    mesh: new THREE.Mesh( geometry, material ) 
  };
  parent.add(pickSquare.mesh);
}


// Dashed circles example: https://jsfiddle.net/56sqt3rq/
function setupRotateTool() {
  rotateTool = {
    position: {},
    zRotation: 0,
    specs: { 
      radius: 0.2,
      margin: 0,
      segments: 25,
      thickness: 0.005
    },
    nearestHotSpot: { which: 'none' }
  };

  // NOTA BENE: Materials have to be defined in the function where they're used if we want to use AlwaysDepth. Wtf, but whatever, no global materials here.
  var rotateToolMaterial = new THREE.LineDashedMaterial({
    color: 0xaaaaaa,
    dashSize: .015,
    gapSize: .005,
    side: THREE.DoubleSide,
    depthTest: true,
    depthWrite: true,
    depthFunc: THREE.AlwaysDepth
  });

  var rotateToolSelectedMaterial = new THREE.MeshBasicMaterial({
    color: 0xffff00,
    side: THREE.DoubleSide,
    depthTest: true,
    depthWrite: true,
    depthFunc: THREE.AlwaysDepth
  });

  var specs = rotateTool.specs;
  specs.startingPos = 
    { x: -1 * ROOM_SIZE + specs.radius + specs.margin, y: ROOM_SIZE - specs.radius - specs.margin, z: crosshair.position.z };
  specs.smallRingRadius = specs.radius * 0.15;
  specs.centerRingRadius = specs.smallRingRadius * 1.5;

  rotateTool.object3D = new THREE.Object3D();
  var rToolObj = rotateTool.object3D;

  var geometry = new THREE.CircleGeometry( specs.radius, specs.segments );
  geometry.vertices.shift();
  geometry.computeLineDistances();
  var ring = new THREE.Line( geometry, rotateToolMaterial );
  rToolObj.add( ring );

  rotateTool.makeAxes = function() {
    rotateTool.object3D.remove(rotateTool.axes);
    var cross = new THREE.Geometry();
    var angleRad = rotateTool.zRotation * DEG_TO_RAD;
    var oppositeAngleRad = (rotateTool.zRotation - 180) * DEG_TO_RAD;
    var angle90Rad = (rotateTool.zRotation + 90) * DEG_TO_RAD;
    var oppositeAngle90Rad = (rotateTool.zRotation - 90) * DEG_TO_RAD;
    rotateTool.axesCoords = [
      new THREE.Vector3(specs.radius * Math.cos(oppositeAngleRad),   specs.radius * Math.sin(oppositeAngleRad), 0),
      new THREE.Vector3(specs.radius * Math.cos(angleRad),           specs.radius * Math.sin(angleRad), 0),
      new THREE.Vector3(specs.radius * Math.cos(oppositeAngle90Rad), specs.radius * Math.sin(oppositeAngle90Rad), 0),
      new THREE.Vector3(specs.radius * Math.cos(angle90Rad),         specs.radius * Math.sin(angle90Rad), 0)
    ];
    rotateTool.axesVecs = [ new THREE.Vector3(rotateTool.axesCoords[1].x - rotateTool.axesCoords[0].x,
                                              rotateTool.axesCoords[1].y - rotateTool.axesCoords[0].y,
                                              rotateTool.axesCoords[1].z - rotateTool.axesCoords[0].z),
                            new THREE.Vector3(rotateTool.axesCoords[3].x - rotateTool.axesCoords[2].x,
                                              rotateTool.axesCoords[3].y - rotateTool.axesCoords[2].y,
                                              rotateTool.axesCoords[3].z - rotateTool.axesCoords[2].z) ];
    rotateTool.axesVecs[0].normalize();
    rotateTool.axesVecs[1].normalize();

    cross.vertices.push(rotateTool.axesCoords[0],rotateTool.axesCoords[1],rotateTool.axesCoords[2],rotateTool.axesCoords[3]);
    cross.computeLineDistances();
    rotateTool.axes = new THREE.LineSegments(cross, rotateToolMaterial );
    rotateTool.object3D.add(rotateTool.axes);
  }

  rotateTool.makeAxes();

  geometry = new THREE.CircleGeometry( specs.centerRingRadius , specs.segments );
  geometry.vertices.shift();
  geometry.computeLineDistances();

  var smallRingCtr = new THREE.Line( geometry, rotateToolMaterial );
  rToolObj.add(smallRingCtr);

  geometry = new THREE.CircleGeometry( specs.smallRingRadius , specs.segments );
  geometry.vertices.shift();
  geometry.computeLineDistances();

  /*
     smallRingCtr = new THREE.Line( geometry, rotateToolMaterial );
     var smallRingLeft = smallRingCtr.clone();
     var smallRingRight = smallRingLeft.clone();
     var smallRingTop = smallRingLeft.clone();
     var smallRingBottom = smallRingLeft.clone();

     smallRingLeft.position.x = -1 * specs.radius;
     rToolObj.add(smallRingLeft);

     smallRingRight.position.x = specs.radius;
     rToolObj.add(smallRingRight);

     smallRingTop.position.y =  1 * specs.radius;
     rToolObj.add(smallRingTop);

     smallRingBottom.position.y = -1 * specs.radius;
     rToolObj.add(smallRingBottom);
   */


  geometry = new THREE.RingGeometry( (specs.smallRingRadius) - specs.thickness, (specs.smallRingRadius) ,  specs.segments );
  var yellowRing = new THREE.Line( geometry, rotateToolSelectedMaterial );
  yellowRing.position.x = 0;

  rToolObj.add(yellowRing);

  rotateTool.hotSpots = { 
    center: { x:  0, y: 0 },
    sides:    [ { x:  0, y: specs.radius },
                { x: -1 * specs.radius, y: 0 },
                { x:  0, y: -1 * specs.radius },
                { x:  specs.radius, y: 0 } ],
    yellowRing : yellowRing
  };

  positionRotateTool(specs.startingPos);

  plane.add(rToolObj);

}

function prepareForRotation() {
  var csgObject;
  var nearestHotSpot = rotateTool.nearestHotSpot;
  selectableItem.hotSpot = nearestHotSpot.which;
  pickedItems.unshift(selectableItem); // put the rotatetool at the front of the picked items list

  rotateTool.dragStart = nearestHotSpot.dragStart.clone();
  rotateTool.dragStartVector = new THREE.Vector3(rotateTool.dragStart.x, rotateTool.dragStart.y, 0);
  rotateTool.dragStartVector.normalize();

  // Save backup of meshes so we can reapply rotation while dragging on rotate tool. We reapply to avoid build up of rotation errors.
  for (var pickedItem of pickedItems) {
    if (pickedItem.type == 'csg') {
      csgObject = pickedItem.item;
      csgObject.saveVertexBackups();
    }
  }

  clearCoplanarGroupHighlight();
}

function placeIntoCsgObjects(csgObject) {
  csgObject.saveVertexBackups();
  csgObject.bsp = new CSG.Node(csgObject.polygons);
  csgObject.createMesh(parent, csgObjectMaterialFlat);  
  csgObject.createSelectMesh(parent);
  csgObject.assignUuids();
  csgObject.createCoplanarGroups();

  csgObjects.push(csgObject);
  firstRender = true;
}



function setupCSG() {
  csgObjects = [];

  //var a = CSG.cube();
  var a = CSG.cube({ radius:0.5 });
  //var b = CSG.cube ({ radius:[1,0.3,0.3], center:[0.25, 0.65, 0] });
  var b = CSG.cube ({ radius:[0.3,1.0,0.3], center:[0.25, 0.65, 0] });
  /* sphere causes section line issues, need to investigate */

  //  var b = CSG.sphere( { radius: 0.5, slices:16, stacks:8 } );
  //  b.translate(0.25,0.5,0.25);

  var csgObject = a.subtract(b);

  placeIntoCsgObjects(csgObject);
  
  /* bug: two section lines means one of them has a marching ants issue */

  var c = CSG.cube({ radius: 0.25, center:[0.5, 0.5, .2] });
  placeIntoCsgObjects(c);

  var d = CSG.cube({ radius: 0.25, center:[-0.5, -0.5, 0] });
  placeIntoCsgObjects(d);

}



// --------------------------------------------------------------------------------
// Main interaction functions
// --------------------------------------------------------------------------------

function pickSelectable() {
  if (selectableItem.type == 'csg') {
    var coplanarGroup = selectableItem.item;
    coplanarGroup.setSelectMeshStatus({ action: 'add', status: SELECT_STATUSES.PICKED });
    pickedItems.push(selectableItem);
  } else if (selectableItem.type == 'coplanarGroup') {
    var csgObject = selectableItem.csgObject;
    csgObject.setSelectMeshStatus({ action: 'add', status: SELECT_STATUSES.PICKED });
    selectableItem = { 
      type:'csg', 
      item: csgObject
    };
    pickedItems.push(selectableItem);
  }
}

function pickSelectableFromSectionLine() {
}

function flushSelectableObject() {
  if (selectableItem.type == 'coplanarGroup') {
    console.log('flipping :', selectableItem);
    var csgObject = selectableItem.csgObject;
    var normal = selectableItem.item[0].plane.normal;
    console.log('normal before', normal);
    var sectionVector = new THREE.Vector3(pickSquare.sectionCoords[1].x - pickSquare.sectionCoords[0].x,
                                          pickSquare.sectionCoords[1].y - pickSquare.sectionCoords[0].y,
                                          pickSquare.sectionCoords[1].z - pickSquare.sectionCoords[0].z);
    sectionVector.normalize();
    var origin = midPoint(pickSquare.sectionCoords);
    console.log(origin);
    var zVector = new THREE.Vector3(0,0,1);
    var angle = zVector.angleTo(sectionVector) * RAD_TO_DEG;
    var rotationVector = zVector.clone();
    rotationVector.cross(normal);
    if (Math.sign(rotationVector.x) > 0) {
      console.log('flush reversing angle');
      angle = 360 - angle;
    }
    clearCoplanarGroupHighlight();
    console.log('origin:', origin, 'angle:', angle, 'rotationVector:', rotationVector);
    csgObject.animateRotate(origin, rotationVector, angle, parent, csgObjectMaterialFlat, 15);
    rotating = true;
    csgObject.saveVertexBackups();
    console.log('normal after', normal);
    unpickAllItems();
  }
}

// Shiftkey: http://stackoverflow.com/questions/3781142/jquery-or-javascript-how-determine-if-shift-key-being-pressed-while-clicking-an

function unpickAllItems() {
  for (var pickedItem of pickedItems) {
    if (pickedItem.type == 'csg') {
      pickedItem.item.setSelectMeshStatus({ action: 'remove', status: SELECT_STATUSES.PICKED });
    }
  }
  pickedItems = [];
}

function unpickRotateTool() {
  var csgObject;
  pickedItems.shift(); // remove rotateTool, which is always at the front of the pickedItems list when it gets picked.
  for (var pickedItem of pickedItems) {
    if (pickedItem.type == 'csg') {
      csgObject = pickedItem.item;
      csgObject.saveVertexBackups();
    }
  }
}

function updatePickedItems(mouseDown, shiftKeyDown) {
  if (mouseDown) {
    switch (selectableItem.type) {
      case 'rotateTool':
        if (rotateTool.nearestHotSpot.which == 'center') {
          unpickAllItems();
        }
        prepareForRotation();
        rotating = true;
        break;
      case 'csg':
        console.log('status:', selectableItem.item.selectMesh.status & SELECT_STATUSES.PICKED);
        if (!(selectableItem.item.selectMesh.status & SELECT_STATUSES.PICKED)) {
          if (!shiftKeyDown) {
            unpickAllItems();
          }
          pickSelectable();
        }
        dragging = true;
        break;
      case 'coplanarGroup':
        if (!shiftKeyDown) {
          unpickAllItems();
        }
        checkForCoplanarDragging = true;
        coplanarDragStart = selectableItem.pickPosition.clone();
        coplanarDraggable = selectableItem;
        dragging = true;
        break;
      case 'none':
      default:
        if (!shiftKeyDown) {
          dragging = false;
          unpickAllItems();
        }
    }
  } else {
    unpickAllAfter = false;
    switch (selectableItem.type) {
      case 'csg':
        dragging = false;
        break;
      case 'polygon':
        dragging = false;
        break;
      case 'rotateTool':
        if (rotating) {
          unpickRotateTool();
          rotating = false;
        }
        break;
    }
    checkForCoplanarDragging = false;
    if (coplanarDragBegun) {
      mergeExtensions();
      coplanarDragBegun = false;
      unpickAllAfter = true;
    }
    // Redo all bsps for any dragged items
    for (var pickedItem of pickedItems) {
      if (pickedItem.type == 'csg') {
        pickedItem.item.bsp = new CSG.Node(pickedItem.item.polygons);
      }
    }
    if (unpickAllAfter) {
      unpickAllItems();
    }      
  }    
}

function faceInCutplane(face, vertices) {
  return ( (Math.abs(vertices[face[0]].z - plane.position.z) < FACE_IN_PLANE_TOLERANCE) &&
           (Math.abs(vertices[face[1]].z - plane.position.z) < FACE_IN_PLANE_TOLERANCE) &&
           (Math.abs(vertices[face[2]].z - plane.position.z) < FACE_IN_PLANE_TOLERANCE)
  );
}

function addToSectionSegments(intersections, sectionSegments, sectionSegmentKeys, sectionEdges, polygon ) {
  var iKey1 = intersections[0].intersectPoint.x.toFixed(TO_FIXED_DECIMAL_PLACES) + '_' + intersections[0].intersectPoint.y.toFixed(TO_FIXED_DECIMAL_PLACES);
  var iKey2 = intersections[1].intersectPoint.x.toFixed(TO_FIXED_DECIMAL_PLACES) + '_' + intersections[1].intersectPoint.y.toFixed(TO_FIXED_DECIMAL_PLACES);
  var checkKey1 = iKey1 + ':' + iKey2;
  var checkKey2 = iKey2 + ':' + iKey1;
  if (sectionSegmentKeys.hasOwnProperty(checkKey1) || sectionSegmentKeys.hasOwnProperty(checkKey2)) {
    // we already have this segment or its backwards equivalent. 
    //console.log('key found on polygon normal', polygon.plane.normal, 'planez:', plane.position.z);
    intersections = [];
    return(false);
  }

  //console.log('Insert poly segment');
  sectionSegmentKeys[checkKey1] = true;
  sectionSegmentKeys[checkKey2] = true;
  sectionSegments.vertices.push(intersections[0].intersectPoint);
  sectionSegments.vertices.push(intersections[1].intersectPoint);

  if (!sectionEdges.hasOwnProperty(iKey1)) {
    sectionEdges[iKey1] = [];
  }
  sectionEdges[iKey1].push({ point: iKey2, polygon: polygon });
  if (!sectionEdges.hasOwnProperty(iKey2)) {
    sectionEdges[iKey2] = [];
  }
  sectionEdges[iKey2].push({ point: iKey1, polygon: polygon });
  intersections = [];

  return(true);
}

/* This section line routine works on THREE Mesh objects, but otherwise is the same as the JSModeler version (drawSectionLineJSM) above */
function drawSectionLineCSG() {
  var P0, P1;
  var sectionExists = false;
  var face;
  var sectionEdges;
  var sectionEdgesCount = 0;
  var sectionSegmentKeys = {};
  var segmentGroup;
  var intersection, intersections, inplaneIntersections;

  if (!(movingCutplane || dragging || rotating || firstRender) ) {
    return; // don't update the sections if not moving the cutplane
  }
  if (!csgObjects) {
    return;
  }

  var sectionMaterialDashed = new THREE.LineDashedMaterial({
    color: 0xffff00,
    dashSize: .04,
    gapSize: .03,
    linewidth: 2,
    depthTest: false, 
    depthWrite: true,
    depthFunc: THREE.AlwaysDepth // so that we can always see the section line. Materials using alwaysdepth MUST be defined in the function where they are used.
  });

  var intersectionsLog = {};
  var facesChecked = 0;
  /* Delete all previous cutSection polygons */
  if (cutSections) {
    parent.remove(cutSections);
  }
  cutSections = new THREE.Object3D();
  parent.add(cutSections);

  var objCtr = 0;
  var sectionSegments = new THREE.Geometry();

  inplanePolygons = {};
  for (var csgObject of csgObjects) {
    var polygons = csgObject.polygons;
    csgObject.sectionEdges = {};
    sectionEdges = csgObject.sectionEdges;
    var polygons = csgObject.polygons;
    var polygon, polygonLength, vertices;
    for (var i = 0; i < polygons.length; ++i) {
      polygon = polygons[i];
      vertices = polygon.vertices;
      polygonLength = vertices.length;
      intersections = [];
      /* for each face, find one or more places where the plane cuts across the face. add these to the sectionEdges */
      for (var j = 0; j < polygonLength; ++j) {
        //console.log('i:',i,'j:',j);
        P0 = new THREE.Vector3(vertices[j].pos.x,vertices[j].pos.y,vertices[j].pos.z);
        P1 = new THREE.Vector3(vertices[(j+1) % polygonLength].pos.x,vertices[(j+1) % polygonLength].pos.y,vertices[(j+1) % polygonLength].pos.z);
        intersection = intersectLineWithPlane(P0, P1, plane.position.z);
        if (intersection.intersected) {
          if ((intersection.whichEndpoint == 0) || 
              (intersection.whichEndpoint == 1)) {
            //console.log('endpoint ', intersection.whichEndpoint, ' in plane, skipping.');
          } else if (intersection.whichEndpoint == 2) {
            //console.log('segment in plane:', P0, P1, 'planeZ:', plane.position.z, 'normal:', polygon.plane.normal);
            inplaneIntersections = [
              { intersectPoint: new THREE.Vector3(P0.x, P0.y, plane.position.z) },
              { intersectPoint: new THREE.Vector3(P1.x, P1.y, plane.position.z) } 
            ];
            if (Math.abs(1.0 - Math.abs(polygon.plane.normal.z)) < NORMAL_TO_CUTPLANE_TOLERANCE) {
              inplanePolygons[polygon.uuid] = polygon;
            } else {
              addToSectionSegments(inplaneIntersections, sectionSegments, sectionSegmentKeys, sectionEdges, polygon);
              continue;
            } 
          } else {
            intersections.push(intersection);
          }
          intersectionsLog[intersection.intersectPoint.x.toFixed(TO_FIXED_DECIMAL_PLACES) + '_' + intersection.intersectPoint.y.toFixed(TO_FIXED_DECIMAL_PLACES)] = true;
          //console.log('found intersection: ', intersection.intersectPoint);

          if (intersections.length == 2) {
            if (addToSectionSegments(intersections, sectionSegments, sectionSegmentKeys, sectionEdges, polygon)) {
              sectionExists = true;
              sectionEdgesCount++;
            }
          }
        }
      }
    }
    objCtr++;
  }

  if (sectionExists) {
    sectionSegments.computeLineDistances();
    segmentGroup = new THREE.LineSegments(sectionSegments, sectionMaterialDashed);
    cutSections.add(segmentGroup);
  }
}


// --------------------------------------------------------------------------------
// Update functions
// --------------------------------------------------------------------------------

function checkCoplanarity(f1, f2) {
  return ((f1.normal.angleTo(f2.normal) * RAD_TO_DEG) <= COPLANAR_ANGLE_TOLERANCE);
}

function clearCoplanarGroupHighlight() {
  if (coplanarGroupHighlight) {
    parent.remove(coplanarGroupHighlight);
    coplanarGroupHighlight = undefined;
  }
}

function updateCoplanarGroupHighlight(offset) {
  if (coplanarGroupHighlight) {
    var geometry = coplanarGroupHighlight.geometry;
    for (var face of geometry.faces) {
      face.setVerticesFromBackups(offset);
      setPolygonMeshFromBackup(face, offset);
    }
  }
}

function createCoplanarGroupHighlight(highlightCenter, pickPosition) {
  var coplanarGroup = highlightCenter.coplanarGroup;
  
  clearCoplanarGroupHighlight();
  var geometry = new THREE.Geometry();
  var base = 0;
  var polyCtr = 0;
  var highlightVertex, normalVector;
  for (var polygon of coplanarGroup) {
    var vertices = polygon.vertices;
    normalVector = new THREE.Vector3(polygon.plane.normal.x,polygon.plane.normal.y,polygon.plane.normal.z);
    normalVector.multiplyScalar(.01);
    for (var vertex of vertices) {
      highlightVertex = new THREE.Vector3(vertex.pos.x, vertex.pos.y, vertex.pos.z);
      highlightVertex.add(normalVector);
      geometry.vertices.push(highlightVertex);
      //console.log('Created highlight vertex:', vertex.pos.x, vertex.pos.y, vertex.pos.z);
    }
    //console.log('highlight normal:', polygon.plane.normal);
    var face;
    for (var i = 2; i < vertices.length; ++i) {
      face = new THREE.Face3(base, base + i - 1, base + i);
      geometry.faces.push(face);
    }
    base += polygon.vertices.length;
    //console.log('Highlighted polygon:', polyCtr++);
  }

  var coplanarLineMaterial= new THREE.LineBasicMaterial({
    color: 0xaaa,
    side: THREE.DoubleSide,
    linewidth: 2,
    depthTest: true,
    depthWrite: true
  });

  assignUvs(geometry);

  coplanarGroupHighlight = new THREE.Object3D();
  var coplanarGroupFaces = new THREE.Mesh( geometry, polygonHighlightMaterial ) ;
  coplanarGroupHighlight.add(coplanarGroupFaces);
  parent.add(coplanarGroupHighlight);

  selectableItem = { 
    type:'coplanarGroup', 
    item: coplanarGroup,
    csgObject: highlightCenter.csgObject,
    pickPosition: pickPosition
  };

}

function mergeExtensions() {
  var fullyMergedObject;
  fullyMergedObject = mergeParent.clone();
  var pickedObjects = _.map(pickedItems, function(pickedItem) { 
    var csgObject = pickedItem.csgObject;
    fullyMergedObject = fullyMergedObject.union(csgObject);
    parent.remove(csgObject.mesh);
    parent.remove(csgObject.selectMesh);
    return (csgObject);
  });
  csgObjects = _.difference(csgObjects, pickedObjects);

  fullyMergedObject.bsp = new CSG.Node(fullyMergedObject.polygons);
  fullyMergedObject.createMesh(parent, csgObjectMaterialFlat);
  fullyMergedObject.createSelectMesh(parent);
  fullyMergedObject.assignUuids();
  fullyMergedObject.createCoplanarGroups();

  for (var i in csgObjects) {
    var csgObject = csgObjects[i];
    if (csgObject == mergeParent) {

      parent.remove(csgObject.mesh)
      parent.remove(mergeParent.selectMesh);

      csgObjects[i] = fullyMergedObject;
      selectableItem = { type: 'none' };
      break;
    }
  }
  firstRender = true; // force section line recalculation
}

// To move a coplanar group, we need to extrude all its polygons and grab all the outer faces for dragging.
// When dragging is done, need to union all the extruded polygons with the main csgObject for the final output.
// Need to constrain the drag so that you can't go back "inside" the main object (flipping the extrusions) as that would be 
// a bad thing.

function pickCoplanarGroup() {
  var extrusions = [], extrusion, extrusionParts;
  var extrusionDepth = COPLANAR_DRAG_TOLERANCE;
  var dragPoly;
  var coplanarGroup = coplanarDraggable.item;
  var csgObject = coplanarDraggable.csgObject;
  var pickedItem;

  console.log('picked coplanar group');

  unpickAllItems();

  for (var polygon of coplanarGroup) {
    console.log('extruding from polygon:', polygon.uuid);
    extrusionParts = csgObject.extrudeFromPolygon(polygon, extrusionDepth);
    extrusion = extrusionParts.object;
    extrusionParts.topFace.csgObject = extrusion;
    extrusion.assignUuids();
    console.log('picked face::', extrusionParts.topFace.uuid);

    pickedItem = {
      type: 'polygon',
      item: extrusionParts.topFace,
      csgObject: extrusion
    }
    pickedItems.push(pickedItem);

    extrusion.bsp = new CSG.Node(extrusion.polygons);
    extrusion.createMesh(parent, csgObjectMaterialFlat);
    extrusion.createSelectMesh(parent);
    extrusion.createCoplanarGroups();

    csgObjects.push(extrusion);
    extrusion.saveVertexBackups();
    saveMeshVertices(extrusion);
  }
  mergeParent = csgObject;

  coplanarDragBegun = true;
  coplanarDragTotal = new THREE.Vector3(0,0,0);
  dragging = true;
  checkForCoplanarDragging = false;

}

function saveMeshVertices(csgObject) {
  csgObject.mesh.geometry.backups = [];
  for (vertex of csgObject.mesh.geometry.vertices) {
    csgObject.mesh.geometry.backups.push(new THREE.Vector3( vertex.x, vertex.y, vertex.z ));
  }
}

function setPolygonMeshFromBackup(polygon, offset) {
  var vertices = polygon.csgObject.mesh.geometry.vertices;
  var backups = polygon.csgObject.mesh.geometry.backups;
  var vertIndex, face;
  var allVertexIndexes = {};
  for (face of polygon.faces) {
    allVertexIndexes[face.a] = true;
    allVertexIndexes[face.b] = true;
    allVertexIndexes[face.c] = true;
  }
  for (vertIndex in allVertexIndexes) {
    vertices[vertIndex].x = backups[vertIndex].x + offset.x;
    vertices[vertIndex].y = backups[vertIndex].y + offset.y;
    vertices[vertIndex].z = backups[vertIndex].z + offset.z;
  }
  polygon.csgObject.mesh.geometry.elementsNeedUpdate = true;

}

function hidePickSquare() {
  pickSquare.mesh.position.x = -1e10;
  pickSquare.visible = false;
}

function updatePickSquare() {
  var nearestMin = 1e10;
  var highlightCenter = { x: -1e10, y:-1e10, active: false };
  var siblings, coordsArray, coord1, coord2, coordsRaw, finalSectionCoords;
  var inplaneSelectableFound;

  if (!csgObjects) {
    return(false);
  }

  inplaneSelectableFound = false;
  // First check if an inplaneSelectableFound is in fact selectable.
  _.each(inplanePolygons, function(polygon) {
    if (polygon.pointInside(crosshair.position)) {
      if (!inplaneSelectableFound) {
        highlightCenter = { x: crosshair.position.x, y: crosshair.position.y, csgObject: polygon.csgObject, coplanarGroup: polygon.coplanarGroup, active:true };
        inplaneSelectableFound = true;
      }
    }
  });

  for (var csgObject of csgObjects) {
    if (!inplaneSelectableFound) {
      for (var sectionEdge in csgObject.sectionEdges) {
        coordsArray = [];
        siblings = csgObject.sectionEdges[sectionEdge];
        if (siblings.length < 2) {
          // degenerate case, not a full edge
          continue;
        }
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

        var tolerance = rotateTool.specs.smallRingRadius * rotateTool.specs.smallRingRadius;
        for (var ci = 0; ci < 4; ci += 2) {
          var nearest = distToSegmentSquared(crosshair.position,coordsArray[ci], coordsArray[ci+1])
          if ((nearest.distance < nearestMin) && (nearest.distance < tolerance)) {
            nearestMin = nearest.distance;
            highlightCenter = { x: nearest.nearestPoint.x, y: nearest.nearestPoint.y, csgObject: csgObject, active:true };
            coordsArray[ci].z = plane.position.z;
            coordsArray[ci+1].z = plane.position.z;
            pickSquare.sectionCoords = [ coordsArray[ci], coordsArray[ci+1] ];
            if (ci == 0) {
              highlightCenter.coplanarGroup = csgObject.sectionEdges[sectionEdge][0].polygon.coplanarGroup;
            } else {
              highlightCenter.coplanarGroup = csgObject.sectionEdges[sectionEdge][1].polygon.coplanarGroup;
            }
          }          
        }
      }
    }
  }

  if (highlightCenter.active) {
    /* Render highlight if near a section edge */
    pickSquare.mesh.position.x = highlightCenter.x;
    pickSquare.mesh.position.y = highlightCenter.y;
    pickSquare.mesh.position.z = plane.position.z + 0.01;
    pickSquare.visible = true;
    if (highlightCenter.coplanarGroup) {
      //console.log('we have a highlight coplanarGroup');
      highlightCenter.csgObject.setSelectMeshStatus({ action: 'remove', status: SELECT_STATUSES.SELECTABLE });
      createCoplanarGroupHighlight(highlightCenter, pickSquare.mesh.position);
      return (true); // we found a face to highlight, so do not try to highlight entire objects
    }
  }
  
  if (coplanarGroupHighlight) {
    console.log('cleaning highlight');
    parent.remove(coplanarGroupHighlight);
    coplanarGroupHighlight = undefined;
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

function positionRotateTool(position) {
  var rToolObj = rotateTool.object3D;
  var finalPosition = position;
  var zRotation = 0;

  if (pickSquare.visible) {
    finalPosition = pickSquare.mesh.position;
    var sectionVector = new THREE.Vector3(pickSquare.sectionCoords[1].x - pickSquare.sectionCoords[0].x,
                                          pickSquare.sectionCoords[1].y - pickSquare.sectionCoords[0].y,
                                          pickSquare.sectionCoords[1].z - pickSquare.sectionCoords[0].z);
    sectionVector.normalize();
    var yVec = new THREE.Vector3(0,1,0);
    zRotation = -1 * yVec.angleTo(sectionVector) * RAD_TO_DEG;
    var checkZ = yVec.clone();
    checkZ.cross(sectionVector);
    if (Math.sign(checkZ.z) > 0) {
      console.log('Reversing angle');
      zRotation = 360 - zRotation;
    }
    console.log(pickSquare.sectionCoords, sectionVector, zRotation);
  } else {
    finalPosition = position;
  }
  rotateTool.position.x = position.x;
  rotateTool.position.y = position.y;
  rotateTool.zRotation = zRotation;
  rotateTool.makeAxes();
  rToolObj.position.x = finalPosition.x;
  rToolObj.position.y = finalPosition.y;

}

function toggleRotateTool() {
  var distToSpot = dist2(rotateTool.position, crosshair.position);
  if (distToSpot < rotateTool.specs.smallRingRadius) {
    positionRotateTool(rotateTool.specs.startingPos);
    // Calculate z rotation such that an axis lines up with the section line.
    rotateTool.zRotation = 0;
    rotateTool.makeAxes();
  } else {
    positionRotateTool(crosshair.position);
  }
}

// Bugs:
// object jumps around if previously translated, when beginning to rotate
// object does not stay picked while rotating

function updateRotations() {
  var hotSpots = rotateTool.hotSpots;
  var nearestHotSpot = rotateTool.nearestHotSpot;
  //console.log('nearestHotSpot:', nearestHotSpot);

  if (nearestHotSpot.which == 'ring') {
    // rotating about z axis
    var crosshairToRotateToolVector = new THREE.Vector3(crosshair.position.x - rotateTool.position.x, crosshair.position.y - rotateTool.position.y,0);
    crosshairToRotateToolVector.normalize();
    var angle = rotateTool.dragStartVector.angleTo(crosshairToRotateToolVector) * RAD_TO_DEG;
    var axisVector = new THREE.Vector3(0,0,1);    
    var checkZ = rotateTool.dragStartVector.clone();
    checkZ.cross(crosshairToRotateToolVector);
    if (Math.sign(checkZ.z) < 0) {
      angle = 360 - angle; // because angleTo only gives us 0-180, we have to figure out when we're greater than 180.
    }
    var checkZ2 = new THREE.Vector3(0,1,0);
    var axesAngle = checkZ2.angleTo(crosshairToRotateToolVector) * RAD_TO_DEG;
    checkZ2.cross(crosshairToRotateToolVector);
    if (Math.sign(checkZ2.z) < 0) {
      axesAngle = 360 - axesAngle;
    }
    rotateTool.zRotation = axesAngle;
    rotateTool.makeAxes(axesAngle);
    //console.log('Angle:', angle.toFixed(2), rotateTool.dragStartVector.dot(crosshairToRotateToolVector), checkZ.z.toFixed(2));
  } else if (nearestHotSpot.which == 'axis') {
    var dragVector = new THREE.Vector3(hotSpots.yellowRing.position.x - rotateTool.dragStart.x,
                                       hotSpots.yellowRing.position.y - rotateTool.dragStart.y,
                                       hotSpots.yellowRing.position.z - rotateTool.dragStart.z);
    dragVector.normalize();
    var axisVector = rotateTool.axesVecs[nearestHotSpot.axisId].clone();
    var reversed = -1 * axisVector.dot(dragVector);
    var angle = reversed * 360 * ((Math.sqrt(dist2(hotSpots.yellowRing.position, rotateTool.dragStart))) / (rotateTool.specs.radius * 2));
    axisVector.applyAxisAngle(new THREE.Vector3(0,0,-1), 90 * DEG_TO_RAD);
  }
  var angleRadians = angle * DEG_TO_RAD;
  var newMesh, csgObject;
  for (var pickedItem of pickedItems) {
    if (pickedItem.type == 'csg') {
      var csgObject = pickedItem.item;
      //console.log('updating rotation of item:', csgObject);
      var origin = new CSG.Vector(rotateTool.position.x, rotateTool.position.y, plane.position.z);
      csgObject.rotateOnAxis(origin, axisVector, angleRadians);
      csgObject.createMesh(parent, csgObjectMaterialFlat);
      csgObject.createSelectMesh(parent, SELECT_STATUSES.PICKED);
    }
  }
}

function updateRotateTool(conditions) {
  var spot, sideSpot;
  var specs = rotateTool.specs;
  var hotSpots = rotateTool.hotSpots;
  var yellowRing = hotSpots.yellowRing;
  yellowRing.position.x = 10000;

  spot = { x: rotateTool.position.x, y: rotateTool.position.y };

  // Check for situation where we are locked on either an axis or the ring.
  if (conditions && conditions.lock && conditions.lock.which) {
    if (conditions.lock.which == 'axis') {
      var axisId = conditions.lock.axisId;

      var rToolVec3 = new THREE.Vector3(rotateTool.position.x, rotateTool.position.y,0);
      var axis = [ new THREE.Vector3(rotateTool.axesCoords[axisId * 2].x, rotateTool.axesCoords[axisId*2].y, 0 ),
                   new THREE.Vector3(rotateTool.axesCoords[(axisId * 2) + 1].x, rotateTool.axesCoords[(axisId * 2) + 1].y, 0) ];
      axis[0].add(rToolVec3); 
      axis[1].add(rToolVec3);
      var ds = distToSegmentSquared3d(crosshair.position, axis[0], axis[1]);
      yellowRing.position.x = ds.nearestPoint.x - rotateTool.position.x;
      yellowRing.position.y = ds.nearestPoint.y - rotateTool.position.y;
      rotateTool.nearestHotSpot = { which: 'axis', axisId: axisId, location: new THREE.Vector2(yellowRing.position.x, yellowRing.position.y) };
    } else if (conditions.lock.which == 'ring') {
      var angleVector = new THREE.Vector2(crosshair.position.x - rotateTool.position.x, crosshair.position.y - rotateTool.position.y);
      angleVector.normalize();
      yellowRing.position.x = angleVector.x * specs.radius;
      yellowRing.position.y = angleVector.y * specs.radius;
      rotateTool.nearestHotSpot = { which: 'ring', location: { x: yellowRing.position.x, y: yellowRing.position.y } };
    }
    return(true);
  }

  rotateTool.nearestHotSpot = { which: 'none' };

  var distToSpot = Math.sqrt(dist2(crosshair.position,rotateTool.position));
  if (distToSpot < specs.smallRingRadius) {
    yellowRing.position.x = 0;
    yellowRing.position.y = 0;
    rotateTool.nearestHotSpot = { which: 'center' };
    if (distToSpot < specs.centerRingRadius) {
      selectableItem = { type: 'rotateTool' };
    }
    return(true);
  }

  /*
     for (var i in hotSpots.sides) {
     sideSpot = { x: rotateTool.position.x + hotSpots.sides[i].x, y: rotateTool.position.y + hotSpots.sides[i].y };
     distToSpot = Math.sqrt(dist2(crosshair.position, sideSpot));
     if (distToSpot < specs.smallRingRadius) {
     yellowRing.position.x = hotSpots.sides[i].x;
     yellowRing.position.y = hotSpots.sides[i].y;
     rotateTool.nearestHotSpot = { which: 'corner', index: i, dragStart: new THREE.Vector2(hotSpots.sides[i].x, hotSpots.sides[i].y) };
     selectableItem = { type: 'rotateTool' };
     return(true);
     }
     }
   */

  spot = { x: rotateTool.position.x, y: rotateTool.position.y };
  distToSpot = Math.sqrt(dist2(crosshair.position, spot));
  if ((distToSpot > specs.radius - specs.smallRingRadius) &&
      (distToSpot <= specs.radius + specs.smallRingRadius) ) {
    // cf http://math.stackexchange.com/questions/127613/closest-point-on-circle-edge-from-point-outside-inside-the-circle
    yellowRing.position.x = specs.radius * ((crosshair.position.x - spot.x) / distToSpot);
    yellowRing.position.y = specs.radius * ((crosshair.position.y - spot.y) / distToSpot);
    rotateTool.nearestHotSpot = { which: 'ring', dragStart: new THREE.Vector2(yellowRing.position.x, yellowRing.position.y) };
    selectableItem = { type: 'rotateTool' };
    return(true);
  }

  // Check for position nearest to axes 
  var rToolVec3 = new THREE.Vector3(rotateTool.position.x, rotateTool.position.y,0);
  for (var i = 0; i < 3; i += 2) {
    var axis = [ new THREE.Vector3(rotateTool.axesCoords[i].x, rotateTool.axesCoords[i].y, 0 ),
                 new THREE.Vector3(rotateTool.axesCoords[i+1].x, rotateTool.axesCoords[i+1].y, 0) ];
    axis[0].add(rToolVec3); 
    axis[1].add(rToolVec3);
    addToDebugText(['axis:',axis[0].x, axis[0].y]);
    var ds = distToSegmentSquared3d(crosshair.position, axis[0], axis[1]);
    var tolerance = rotateTool.specs.smallRingRadius * rotateTool.specs.smallRingRadius;
    if (ds.distance < tolerance) {
      yellowRing.position.x = ds.nearestPoint.x - rotateTool.position.x;
      yellowRing.position.y = ds.nearestPoint.y - rotateTool.position.y;
      rotateTool.nearestHotSpot = { which: 'axis', axisId: i / 2, dragStart: new THREE.Vector2(yellowRing.position.x, yellowRing.position.y) };
      selectableItem = { type: 'rotateTool', which: 'axis', axisId: i / 2 };
      return(true);
    }
  }
  
  return(false);
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

    addToDebugText(['crosshair: ', crosshair.position.x, crosshair.position.y, '<br>']);
    addToDebugText(['nearestHotSpot: ', rotateTool.nearestHotSpot.which, '<br>']);
    addToDebugText(['rtool_zroot: ', rotateTool.zRotation, '<br>']);

    if (checkForCoplanarDragging) {
      if (dist2(crosshair.position, coplanarDragStart) > COPLANAR_DRAG_TOLERANCE) {
        pickCoplanarGroup();
      }
    }        

    if (pickedItems.length && (dragging || rotating)) {
      var xDiff = crosshair.position.x - prevCrossHair.x;
      var yDiff = crosshair.position.y - prevCrossHair.y;
      var sumCtr = 0;
      if (coplanarDragStart) {
        addToDebugText(['coplanarDragStart: ', coplanarDragStart.x, coplanarDragStart.y]);
      }

      var terminateEarly = false;
      for (var pickedItem of pickedItems) {
        switch (pickedItem.type) {
          case 'polygon':
            if (coplanarDragBegun) {
              var polygon = pickedItem.item;
              var diffVector = new THREE.Vector3(xDiff, yDiff, 0);
              var planeVector = new THREE.Vector3(polygon.plane.normal.x, polygon.plane.normal.y, polygon.plane.normal.z);
              var crosshairVector = new THREE.Vector3(crosshair.position.x, crosshair.position.y, plane.position.z);
              var amountMoved = dist3slow(crosshairVector, coplanarDragStart);
              var normalizedCrosshairVector = crosshairVector.clone();
              normalizedCrosshairVector.sub(coplanarDragStart);
              normalizedCrosshairVector.normalize();
              var projectedVector = projectOntoVector(normalizedCrosshairVector, planeVector);
              var scaledProjectedVector = projectedVector.clone();
              scaledProjectedVector.multiplyScalar(amountMoved);
              addToDebugText(['<br>projectedVector: ', projectedVector.x, projectedVector.y]);
              addToDebugText(['<br>amountMoved: ', amountMoved]);

              var check2 = crosshairVector.clone();
              check2.sub(coplanarDragStart);
              check2.normalize();
              var check3 = planeVector.angleTo(check2) * RAD_TO_DEG;
              //console.log('crosshairVector.x:', crosshairVector.x, 'coplanarDragStart.x:', coplanarDragStart.x);

              addToDebugText(['<br>check2: ', check2.x,check2.y]);
              addToDebugText(['<br>check3: ', check3]);
              if (check3 >= 90) {
                scaledProjectedVector = new THREE.Vector3(0,0,0);
              }

              polygon.setVerticesFromBackups(scaledProjectedVector);
              setPolygonMeshFromBackup(polygon, scaledProjectedVector);
              updateCoplanarGroupHighlight(scaledProjectedVector);
            }
            break;
          case 'rotateTool':
            //console.log('dragging rotate tool');
            switch (pickedItem.hotSpot) {
              case 'axis':
                console.log('dragging along axis');
                updateRotateTool({ lock: { which: 'axis', axisId: pickedItem.axisId } });
                updateRotations();
                terminateEarly = true;
                break;
              case 'ring':
                // Rotate around z axis
                updateRotateTool({ lock: { which: 'ring' }});
                updateRotations();
                terminateEarly = true;
                break;
              case 'center':
              default:
                positionRotateTool(crosshair.position);
                break;
            }
            break;
          case 'csg':
            pickedItem.item.mesh.geometry.translate(xDiff, yDiff, 0.0);
            pickedItem.item.translate(xDiff, yDiff, 0.0);
            break;
          default:
            break;
        }
        if (terminateEarly) {
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
    clearCoplanarGroupHighlight();
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

        if (checkForCoplanarDragging) {
          if (dist3slow(crosshair.position, coplanarDragStart) > COPLANAR_DRAG_TOLERANCE) {
            pickCoplanarGroup();
          }
        }        

        var zDiff = plane.position.z - prevPlaneZ;
        for (var pickedItem of pickedItems) {
          switch (pickedItem.type) {
            case 'rotateTool':
              // do nothing
              break;
            case 'csg':
              pickedItem.item.mesh.geometry.translate(0,0, zDiff);
              pickedItem.item.translate(0,0,zDiff);
              break;
            case 'polygon':
              console.log('Dragging polygons');
              var polygon = pickedItem.item;
              var offsetVector = new THREE.Vector3(0,0,plane.position.z - coplanarDragStart.z);
              if (Math.sign(offsetVector.z) != Math.sign(polygon.plane.normal.z)) {
                offsetVector.z = 0; // you cannot drag the in-plane faces "into" the object
              }
              polygon.setVerticesFromBackups(offsetVector);
              setPolygonMeshFromBackup(polygon, offsetVector);
              break;
          }
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
    if (selectableItem.type == 'csg') {
    } else if (selectableItem.type == 'coplanarGroup') {
      // do nothing
    }
    selectableItem = { type: 'none' };
  }

  hidePickSquare();
  if (!updateRotateTool()) {
    if (!updatePickSquare()) {
      for (var csgObject of csgObjects) {
        var testPoint = new CSG.Vector(crosshair.position.x, crosshair.position.y, plane.position.z);
        selectMesh = csgObject.selectMesh;
        var selectability = false;
        if (csgObject.bsp) {
          var inside = csgObject.bsp.pointInside(testPoint);
          if (inside) {
            // console.log('inside section line, crosshair:', crosshair.position.x, crosshair.position.y);
            // now we can use csgObjectMesh.translate(x,y,z) to drag it around
            selectableItem = { 
              type:'csg', 
              item: csgObject
            };
            csgObject.setSelectMeshStatus({ action: 'add', status: SELECT_STATUSES.SELECTABLE });
            //console.log('selectMeshstatus:', csgObject.selectMesh.status);
            selectability = true;
          }
        }
        if (!selectability) {
          csgObject.setSelectMeshStatus({ action: 'remove', status: SELECT_STATUSES.SELECTABLE });
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
        for (var csgObject of csgObjects) {
          csgObject.mesh.material = window.csgObjectMaterialWire;
        }
      } else {
        for (var csgObject of csgObjects) {
          csgObject.mesh.material = window.csgObjectMaterialFlat;
        }
      }
      console.log('useWireFrame:', useWireFrame);
    }
  } else {
    previousUseWireFrame = useWireFrame;
  }
}

function updateAnimations() {
  for (var csgObject of csgObjects) {
    if (csgObject.animation) {
      rotating = csgObject.animate(csgObjectMaterialFlat, SELECT_STATUSES.SELECTABLE);
    }
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
  drawSectionLineCSG();
  updateRoomView();
  updateCrosshair();
  updateCutplane();
  updateCursorTracking();
  updateAnimations();

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
setupCrosshair();
setupPickSquare();
setupRotateTool();
setupRoom();
updateCutplaneProjectionVector();

camera.position.set( 0, 0, 5);
setupLights();
setupCSG();

render();


