
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

/*
  var indexer = new GL.Indexer();
  this.toPolygons().map(function(polygon) {
    var indices = polygon.vertices.map(function(vertex) {
      vertex.color = polygon.shared || [1, 1, 1];
      return indexer.add(vertex);
    });
    for (var i = 2; i < indices.length; i++) {
      mesh.triangles.push([indices[0], indices[i - 1], indices[i]]);
    }
  });
  mesh.vertices = indexer.unique.map(function(v) { return [v.pos.x, v.pos.y, v.pos.z]; });
  mesh.normals = indexer.unique.map(function(v) { return [v.normal.x, v.normal.y, v.normal.z]; });
  mesh.colors = indexer.unique.map(function(v) { return v.color; });
  mesh.computeWireframe();
  */
