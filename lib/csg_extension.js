
// Set the color of all polygons in this solid
CSG.prototype.setColor = function(r, g, b) {
  this.toPolygons().map(function(polygon) {
    polygon.shared = [r, g, b];
  });
};

// Convert from CSG solid to GL.Mesh object
CSG.prototype.toMesh = function() {
  var polygons = this.toPolygons();
  var geometry = new THREE.Geometry();
  var vertices = geometry.vertices;
  var faces = geometry.faces;
  var CSGVertexMap = {};
  var vertCtr = 0;
  var i, pos,polygon,polyIpolyIndex,polyIndexes,pos,vertex,face, mapIndex;
  for (i in polygons) {
    polygon = polygons[i];
    polyIndexes = [];
    for (vertex of polygon.vertices) {
      pos = vertex.pos;
      CSGVertexKey = pos.x.toFixed(TO_FIXED_DECIMAL_PLACES) + '_' + pos.y.toFixed(TO_FIXED_DECIMAL_PLACES) + '_' + pos.z.toFixed(TO_FIXED_DECIMAL_PLACES);
      if (CSGVertexMap.hasOwnProperty(CSGVertexKey)) {
        mapIndex = CSGVertexMap[CSGVertexKey];
      } else {
        vertices.push(new THREE.Vector3(pos.x,pos.y,pos.z));
        CSGVertexMap[CSGVertexKey] = vertCtr;
        mapIndex = vertCtr;
        vertCtr++;
      }
      polyIndexes.push(mapIndex);
    }
    for (polyIndex = 2; polyIndex < polyIndexes.length; ++polyIndex) {
      face = new THREE.Face3(polyIndexes[0], polyIndexes[polyIndex - 1], polyIndexes[polyIndex]);
      faces.push(face);
    }    
  }
  geometry.elementsNeedUpdate = true;
  return(geometry);
};

CSG.Polygon.prototype.setBoundingBox = function() {
  this.bbox = { min:  new CSG.Vector( 1.0E-10, 1.0E-10, 1.0E-10), max: new CSG.Vector(-1.0E-10,-1.0E-10,-1.0E-10) };
  var vi;
  for (var i = 0; i < this.vertices.length; ++i) {
    vi = this.vertices[i];

    this.bbox.min.x = ((vi.pos.x < this.bbox.min.x) ? vi.pos.x : this.bbox.min.x);
    this.bbox.min.y = ((vi.pos.y < this.bbox.min.y) ? vi.pos.y : this.bbox.min.y);
    this.bbox.min.z = ((vi.pos.z < this.bbox.min.z) ? vi.pos.z : this.bbox.min.z);

    this.bbox.max.x = ((vi.pos.x > this.bbox.max.x) ? vi.pos.x : this.bbox.max.x);
    this.bbox.max.y = ((vi.pos.y > this.bbox.max.y) ? vi.pos.y : this.bbox.max.y);
    this.bbox.max.z = ((vi.pos.z > this.bbox.max.z) ? vi.pos.z : this.bbox.max.z);
  }
}

CSG.Node.prototype.setBoundingBoxes = function() {
  var poly;
  this.bbox = { min:  new CSG.Vector( 1.0E-10, 1.0E-10, 1.0E-10), max: new CSG.Vector(-1.0E-10,-1.0E-10,-1.0E-10) };
  for (var i = 0; i < this.polygons.length; i++) {
    poly = this.polygons[i];
    poly.setBoundingBox();

    this.bbox.min.x = ((poly.bbox.min.x < this.bbox.min.x) ? poly.bbox.min.x : this.bbox.min.x);
    this.bbox.min.y = ((poly.bbox.min.y < this.bbox.min.y) ? poly.bbox.min.y : this.bbox.min.y);
    this.bbox.min.z = ((poly.bbox.min.y < this.bbox.min.z) ? poly.bbox.min.z : this.bbox.min.z);

    this.bbox.max.x = ((poly.bbox.max.x > this.bbox.max.x) ? poly.bbox.max.x : this.bbox.max.x);
    this.bbox.max.y = ((poly.bbox.max.y > this.bbox.max.y) ? poly.bbox.max.y : this.bbox.max.y);
    this.bbox.max.z = ((poly.bbox.max.y > this.bbox.max.z) ? poly.bbox.max.z : this.bbox.max.z);

  }
}
  
CSG.Node.prototype.translate = function(x,y,z) {
  var polygon;
  var allPolygons = this.allPolygons();
  for (var polyIndex in allPolygons) {
    polygon = allPolygons[polyIndex];
    for (var vertex of polygon.vertices) {
      vertex.pos.x += x;
      vertex.pos.y += y;
      vertex.pos.z += z;
    }
    polygon.setBoundingBox();
  }
}

// Cf: Foley & Van Dam, https://books.google.com/books?id=-4ngT05gmAQC&pg=PA556&lpg=PA556&dq=point+inside+bsp+tree+solid&source=bl&ots=QXMqeVkzmd&sig=yqc3nNCupSWKVpEUpG1RpCJutfY&hl=en&sa=X&ved=0ahUKEwjz1PiXj9_RAhUD-mMKHYY0CDIQ6AEIJjAC#v=onepage&q=point%20inside%20bsp%20tree%20solid&f=false

CSG.Node.prototype.pointInside = function(testPoint) {
  var COPLANAR = 0;
  var FRONT = 1;
  var BACK = 2;

//  console.log('Entering pointInside, with normal:', this.plane.normal, 'w:', this.plane.w);
  var t = this.plane.normal.dot(testPoint) - this.plane.w;
  var type = (t < -CSG.Plane.EPSILON) ? BACK : (t > CSG.Plane.EPSILON) ? FRONT : COPLANAR;

  if ((this.front == null) && (this.back == null)) {
//    console.log('reached leaf, type:', type);
    return(type == BACK); // reached leaf, return whether we are inside this plane
  }

  switch (type) {
    case FRONT:
      if (this.front == null) {
//        console.log('leaf, point is in front');
        return(false);
      }
//      console.log('Point in front, recursing:');
      return(this.front.pointInside(testPoint));
    case BACK:
      if (this.back == null) {
//        console.log('leaf, point is in back');
        return(true);
      }
//      console.log('Point in back, recursing:');
      return(this.back.pointInside(testPoint));
    case COPLANAR:
//      console.log('Point coplanar, recursing front:');
      var p1 = false, p2 = false;
      if (this.front) {
        p1 = this.front.pointInside(testPoint);
      }
//      console.log('Point coplanar, recursing back:');
      if (this.back) {
        var p2 = this.back.pointInside(testPoint);
      }
      if (p1 == p2) {
//        console.log('point coplanar, returning:', p1);
        return(p1);
      } else {
//        console.log('point coplanar, returning false');
        return(false);
      }
  }
  return(false);
}
