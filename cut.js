// http://jsfiddle.net/hbt9c/317/

var parent;
var plane;
var crosshair;

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
      window.movePlaneBack = true;
      break;
    case 76:
      window.movePlaneForward = true;
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
      window.movePlaneBack = false;
      break;
    case 76:
      window.movePlaneForward = false;
      break;
  }
}

window.addEventListener('keydown', handleKeyDown, false);
window.addEventListener('keyup', handleKeyUp, false);

function render() {
  requestAnimationFrame( render );
  renderer.render( scene, camera );
  if (window.cmdKeyPressed) {
    console.log('Command key down at', cursor.current.x, cursor.current.y);
    moveCutplane();
  }
}

function setupLights() {
  var dirLight = new THREE.DirectionalLight(0xffffff, 1);
  dirLight.position.set(100, 100, 50);
  scene.add(dirLight);
  var light = new THREE.AmbientLight( 0xfff ); // soft white light
  scene.add( light );
}

function setupCutplane() {
  var material = new THREE.MeshLambertMaterial({color: 0x5555ff, transparent: true, opacity: 0.95});
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
    color: 0xff0000
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
  var line = new THREE.Line( crosshairLines, material );

  plane.add(line);
  
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

function moveCutCursor() {
}

function moveCutplane() {
  var cursorXdiff = (cursor.current.x - cursor.last.x) * .01;
  if( cursorXdiff > 0 ){
    cursor.last.x = cursor.current.x;
    cursor.last.y = cursor.current.y;
  }

  console.log('cursorXdiff:', cursorXdiff);
  plane.position.z = Math.max(-1, Math.min(plane.position.z + cursorXdiff, 1.0));
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

parent.rotation.x = -1;
parent.rotation.y = 1;

setupCutplane();
setupRoom();
setupCrosshair();
setupLights();

camera.position.set( 0,0, 0);
controls.update();

setupLights();


render();
