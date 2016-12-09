// http://jsfiddle.net/hbt9c/317/

var parent;
var plane;
var crosshair;
var primitive;

var cursor = { current: {x:0, y:0}, last: {x:0,y:0} };

document.onmousemove = function(e){
  cursor.last.x = cursor.current.x; 
  cursor.last.y = cursor.current.y;
  cursor.current.x = e.pageX;
  cursor.current.y = e.pageY;
}

function handleKeyDown(event) {
  switch (event.keyCode) {
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

function render() {
  requestAnimationFrame( render );
  renderer.render( scene, camera );
  updateCutplane();
  updateCrosshair();
  drawIntersectionPoint();
}

function setupLights() {
  var dirLight = new THREE.DirectionalLight(0xffffff, 1);
  dirLight.position.set(100, 100, 50);
  scene.add(dirLight);
  var light = new THREE.AmbientLight( 0xfff ); // soft white light
  scene.add( light );
}

function setupCutplane() {
  var material = new THREE.MeshLambertMaterial({color: 0x5555ff, transparent: true, opacity: 0.95, side: THREE.DoubleSide });
  var shape = new THREE.Shape();
  shape.moveTo(-1,-1,0);
  shape.lineTo(1,-1,0);
  shape.lineTo(1,1,0);
  shape.lineTo(-1,1,0);
  shape.lineTo(-1,-1,0);

  var geometry = new THREE.ShapeGeometry( shape );
  plane = new THREE.Mesh( geometry, material ) ;

  parent.add(plane);
}

function setupCrosshair() {
  var material = new THREE.LineBasicMaterial({
    color: 'yellow',
    depthTest: true
  });
  var crosshairLines = new THREE.Geometry();
  var crosshairSize = 0.1, crosshairZoffset = 0.05;
  crosshairLines.vertices.push(
    new THREE.Vector3 ( 0,    -crosshairSize, crosshairZoffset),
    new THREE.Vector3 ( 0,    0,              crosshairZoffset),
    new THREE.Vector3 ( -crosshairSize, 0,    crosshairZoffset),
    new THREE.Vector3 ( 0,    0,              crosshairZoffset),
    new THREE.Vector3 ( 0,     crosshairSize, crosshairZoffset),
    new THREE.Vector3 ( 0,    0,              crosshairZoffset),
    new THREE.Vector3 ( crosshairSize, 0,    crosshairZoffset)
  );
  crosshair = new THREE.Line( crosshairLines );

  plane.add(crosshair);
  
}

function setupRoom() {

  var material = new THREE.LineBasicMaterial({
    color: 0xffffff
  });

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

  var line = new THREE.Line( walls, material );
  parent.add( line );

  walls = new THREE.Geometry();
  walls.vertices.push(
    new THREE.Vector3( -1, 1, 1 ),
    new THREE.Vector3( -1, 1, -1 )
  );

  line = new THREE.Line( walls, material );
  parent.add( line );

  walls = new THREE.Geometry();
  walls.vertices.push(
    new THREE.Vector3( 1, 1, 1 ),
    new THREE.Vector3( 1, 1, -1 )
  );

  line = new THREE.Line( walls, material );
  parent.add( line );

  walls = new THREE.Geometry();
  walls.vertices.push(
    new THREE.Vector3( 1, -1, 1 ),
    new THREE.Vector3( 1, -1, -1 )
  );

  line = new THREE.Line( walls, material );
  parent.add( line );

}

function setupPrimitive() {
  var cubeSize = 0.25;
  var geometry = new THREE.BoxGeometry( cubeSize, cubeSize, cubeSize );
  var material = new THREE.MeshPhongMaterial( { 
    color: 0xff33ff, 
    shading: THREE.FlatShading,
    side: THREE.DoubleSide, 
    opacity: 0.2 } );
  primitive = new THREE.Mesh( geometry, material );
  parent.add(primitive);
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

// http://geomalgorithms.com/a05-_intersect-1.html
function drawIntersectionPoint() {
  var n =  new THREE.Vector3(0,0,1); // normal vector to cutplane
  var P0 = new THREE.Vector3(0,0,0);
  var P1 = new THREE.Vector3(1,0.25,1);
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
    //console.log('intersectPoint:', intersectPoint);
    primitive.position.x = intersectPoint.x;
    primitive.position.y = intersectPoint.y;
    primitive.position.z = intersectPoint.z;
  }
}

function updateCrosshair() {
  //console.log('cursor:', cursor.current.x, cursor.current.y);
  crosshair.position.x = 1.0 * ((cursor.current.x / (window.innerWidth / 2)) - 1);
  crosshair.position.y = -1.0 * ((cursor.current.y / (window.innerHeight / 2)) - 1);
}

function updateCutplane() {
  if (window.cmdKeyPressed) {
    var cursorXdiff = (cursor.current.x - cursor.last.x) * .01;
    //console.log('cursorXdiff is:', cursorXdiff, cursor.current.x,cursor.last.x );
    if( Math.abs(cursorXdiff) > 0 ){
      cursor.last.x = cursor.current.x;
      cursor.last.y = cursor.current.y;

      plane.position.z = Math.max(-1, Math.min(plane.position.z + cursorXdiff, 1.0));
    }
  }
}


var RAD_TO_DEG = 180 / Math.PI;
var DEG_TO_RAD = Math.PI / 180;

var scene = new THREE.Scene();
var camera = new THREE.PerspectiveCamera( 15, window.innerWidth / window.innerHeight, 1, 100 );

controls = new THREE.OrbitControls( camera );
controls.minDistance = 10;
controls.maxDistance = 50;

var renderer = new THREE.WebGLRenderer();
renderer.setSize( window.innerWidth, window.innerHeight );
document.body.appendChild( renderer.domElement );

// parent
parent = new THREE.Object3D();
scene.add( parent );

//parent.rotation.x = -1;
//parent.rotation.y = 1;

setupCutplane();
setupRoom();
setupCrosshair();
setupPrimitive();
setupLineSegment();
setupLights();

camera.position.set( 0,0, 5);
controls.update();

setupLights();


render();
