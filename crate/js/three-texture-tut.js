var camera;
var scene;
var renderer;
var mesh;


init();
animate();

function init() {

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera( 70, window.innerWidth / window.innerHeight, 1, 1000);

    var light = new THREE.DirectionalLight( 0xffffff );
    light.position.set( 0, 1, 1 ).normalize();
    scene.add(light);

    var geometry = new THREE.CubeGeometry( 10, 10, 10); 
    
    var material = new THREE.MeshPhongMaterial( { map: THREE.ImageUtils.loadTexture('images/texture-atlas.jpg') } );
  
    var bricks = [new THREE.Vector2(0, .666), new THREE.Vector2(.5, .666), new THREE.Vector2(.5, 1), new THREE.Vector2(0, 1)];
    var clouds = [new THREE.Vector2(.5, .666), new THREE.Vector2(1, .666), new THREE.Vector2(1, 1), new THREE.Vector2(.5, 1)];
    var crate = [new THREE.Vector2(0, .333), new THREE.Vector2(.5, .333), new THREE.Vector2(.5, .666), new THREE.Vector2(0, .666)];
    var stone = [new THREE.Vector2(.5, .333), new THREE.Vector2(1, .333), new THREE.Vector2(1, .666), new THREE.Vector2(.5, .666)];
    var water = [new THREE.Vector2(0, 0), new THREE.Vector2(.5, 0), new THREE.Vector2(.5, .333), new THREE.Vector2(0, .333)];
    var wood = [new THREE.Vector2(.5, 0), new THREE.Vector2(1, 0), new THREE.Vector2(1, .333), new THREE.Vector2(.5, .333)];

    geometry.faceVertexUvs[0] = [];
    
	geometry.faceVertexUvs[0][0] = [ bricks[0], bricks[1], bricks[3] ];
	geometry.faceVertexUvs[0][1] = [ bricks[1], bricks[2], bricks[3] ];
	
	geometry.faceVertexUvs[0][2] = [ clouds[0], clouds[1], clouds[3] ];
	geometry.faceVertexUvs[0][3] = [ clouds[1], clouds[2], clouds[3] ];
	
	geometry.faceVertexUvs[0][4] = [ crate[0], crate[1], crate[3] ];
	geometry.faceVertexUvs[0][5] = [ crate[1], crate[2], crate[3] ];
	
	geometry.faceVertexUvs[0][6] = [ stone[0], stone[1], stone[3] ];
	geometry.faceVertexUvs[0][7] = [ stone[1], stone[2], stone[3] ];
	
	geometry.faceVertexUvs[0][8] = [ water[0], water[1], water[3] ];
	geometry.faceVertexUvs[0][9] = [ water[1], water[2], water[3] ];
	
	geometry.faceVertexUvs[0][10] = [ wood[0], wood[1], wood[3] ];
	geometry.faceVertexUvs[0][11] = [ wood[1], wood[2], wood[3] ];
	
    mesh = new THREE.Mesh(geometry,  material);
    mesh.position.z = -50;
    scene.add( mesh );
     
    renderer = new THREE.WebGLRenderer();
    renderer.setSize( window.innerWidth, window.innerHeight );
    document.body.appendChild( renderer.domElement );

    window.addEventListener( 'resize', onWindowResize, false );
        
    render();
}

function animate() {
    mesh.rotation.x += .04;
    mesh.rotation.y += .02;
  
    render();
    requestAnimationFrame( animate );
}

function render() {
    renderer.render( scene, camera );
}


function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize( window.innerWidth, window.innerHeight );
    render();
}
