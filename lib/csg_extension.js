
// Set the color of all polygons in this solid
CSG.prototype.setColor = function(r, g, b) {
  this.toPolygons().map(function(polygon) {
    polygon.shared = [r, g, b];
  });
};

CSG.Vector.prototype.cleanNegZeroes = function() {
  return new CSG.Vector(
    ((this.x == -0) ? 0 : this.x),
    ((this.y == -0) ? 0 : this.y),
    ((this.z == -0) ? 0 : this.z)
  );
}


CSG.prototype.assignFaceVertexMaps = function() {
  var CSGVertexKey;
  this.vertexMap = {};
  for (var polygon of this.polygons) {
    for (var vertex of polygon.vertices) {
      CSGVertexKey = vertex.pos.x.toFixed(TO_FIXED_DECIMAL_PLACES) + '_' + vertex.pos.y.toFixed(TO_FIXED_DECIMAL_PLACES) + '_' + vertex.pos.z.toFixed(TO_FIXED_DECIMAL_PLACES);
      if (!this.vertexMap.hasOwnProperty(CSGVertexKey)) {
        this.vertexMap[CSGVertexKey] = [];
      }
      this.vertexMap[CSGVertexKey].push(vertex);
      vertex.vertexMap = this.vertexMap[CSGVertexKey];
    }
  }  
}

/* Create a CSG extrusion from a threeJs triangle, depth is the distance along the normal vector you want to extrude  */
CSG.prototype.extrudeFromPolygon = function(polygon,depth) {
  var top, bottom, side, polygons = [], sideVec1, sideVec2, sideNormal, sideVertices;
  var numVertices = polygon.vertices.length;

  var extrusionVector = polygon.plane.normal.clone().times(depth);
  bottom = polygon.clone();
  top = polygon.clone();
  top.translate(extrusionVector);
  polygons.push(top);

  for (var i = 0 ; i < numVertices; ++i) {
    sideVertices = [];
    sideVec1 = top.vertices[i].pos.minus(bottom.vertices[i].pos).unit();
    sideVec2 = bottom.vertices[(i + 1) % numVertices].pos.minus(bottom.vertices[i].pos).unit();
    sideNormal = sideVec2.cross(sideVec1).cleanNegZeroes();
    sideVertices.push(new CSG.Vertex(bottom.vertices[i].pos, sideNormal));
    sideVertices.push(new CSG.Vertex(bottom.vertices[(i + 1) % numVertices].pos, sideNormal));
    sideVertices.push(new CSG.Vertex(top.vertices[(i + 1) % numVertices].pos, sideNormal));
    sideVertices.push(new CSG.Vertex(top.vertices[i].pos, sideNormal));
//    for (j = 0; j < sideVertices.length; ++j) {
//      console.log(sideVertices[j].pos, sideNormal);
//    }
    side = new CSG.Polygon(sideVertices);
    polygons.push(side);
  }

  bottom.flip();
  polygons.push(bottom);

  var extrusion = CSG.fromPolygons(polygons);
  extrusion.assignFaceVertexMaps();
  return ({ object: extrusion, topFace: top });
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
    polygon.faces = [];
    for (polyIndex = 2; polyIndex < polyIndexes.length; ++polyIndex) {
      face = new THREE.Face3(polyIndexes[0], polyIndexes[polyIndex - 1], polyIndexes[polyIndex]);
      faces.push(face);
      polygon.faces.push(face);
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

CSG.prototype.setBoundingBoxes = function() {
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

// cf http://stackoverflow.com/questions/105034/create-guid-uuid-in-javascript
CSG.prototype.generateUuid = function() {
  return('xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
    return v.toString(16);
  }) );
}

CSG.prototype.assignUuids = function() {
  this.uuid = this.generateUuid();
  for (var polygon of this.polygons) {
    polygon.uuid = this.generateUuid();
  }
}

CSG.Polygon.prototype.translate = function(vector) {
  var vertexMap;
  var vi;
  for (var i = 0; i < this.vertices.length; ++i) {
    vi = this.vertices[i];
    vertexMap = vi.vertexMap;
    if (vertexMap) {
      for (var vm of vertexMap) {
        vm.pos.x += vector.x;
        vm.pos.y += vector.y;
        vm.pos.z += vector.z;
      }
    } else {
      vi.pos.x += vector.x;
      vi.pos.y += vector.y;
      vi.pos.z += vector.z;
    }      
  }
  this.plane = CSG.Plane.fromPoints(this.vertices[0].pos, this.vertices[1].pos, this.vertices[2].pos);
}


CSG.prototype.translate = function(x,y,z) {
  for (var polygon of this.polygons) {
    polygon.translate(new CSG.Vector(x,y,z));
  }
  this.setBoundingBoxes();
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


/* Create coplanar grouped polygons so we can drag them as a unit */
CSG.prototype.createCoplanarGroups = function() {

  // Step 1: group coplanar faces together. 
  var step1Groups = {};
  var coplanarGroupKey, normal;
  for (var polygon of this.polygons) {
    normal = polygon.plane.normal;
    coplanarGroupKey = [normal.x.toFixed(TO_FIXED_DECIMAL_PLACES),
                        normal.y.toFixed(TO_FIXED_DECIMAL_PLACES),
                        normal.z.toFixed(TO_FIXED_DECIMAL_PLACES),
                        polygon.plane.w.toFixed(TO_FIXED_DECIMAL_PLACES)].join('_');
    if (!step1Groups.hasOwnProperty(coplanarGroupKey)) {
      step1Groups[coplanarGroupKey] = [];
    }
    //console.log('pushing polygon:', polygon, 'to group:', coplanarGroupKey);
    step1Groups[coplanarGroupKey].push(polygon);
  }    

  // Step 2: faces may not be adjacent though so we have to refilter for adjacency in step 2.
  var step2Groups = [];  
  var subGroups, subGroup;
  for (var coplanarGroupKey in step1Groups) {
    var coplanarGroup = step1Groups[coplanarGroupKey];
    //console.log('coplanarGroupNormal:', coplanarGroup[0].plane.normal, 'coplanarGroup size:', coplanarGroup.length);
    var vertexMap = [];
    for (var i in coplanarGroup) {
      var polygon = coplanarGroup[i];
      for (var vertex of polygon.vertices) {
        vertexKey = [vertex.pos.x.toFixed(TO_FIXED_DECIMAL_PLACES),
                     vertex.pos.y.toFixed(TO_FIXED_DECIMAL_PLACES),
                     vertex.pos.z.toFixed(TO_FIXED_DECIMAL_PLACES)].join('_');
        if (!vertexMap.hasOwnProperty(vertexKey)) {
          vertexMap[vertexKey] = [];
        }
        vertexMap[vertexKey].push(i);
      }
    }
    subGroups = [];
    for (var vMap in vertexMap) {
      if (subGroups.length == 0) {
        subGroups.push(vertexMap[vMap].slice());
      } else {
        var uniqueVmap = true;
        for (var i in subGroups) {
          var common = _.intersection(subGroups[i], vertexMap[vMap]);
          if (common.length > 0) {
            subGroups[i] = _.union(subGroups[i], vertexMap[vMap]);
            uniqueVmap = false;
          }
        }
        if (uniqueVmap) {
          subGroups.push(vertexMap[vMap].slice()); // if there was no overlap, we need to add this vmap as a subGroup so we can find totally separate faces as separated subgroups
        }
      }
    }  

    // Step 3:  Consolidate subgroups that still have overlaps. This is seriously n-squared but what the hell...
    for (var i in subGroups) {
      if (subGroups[i] != undefined) {
        for (var j in subGroups) {
          if ((i != j) && (subGroups[j] != undefined)) {
            var common = _.intersection(subGroups[i], subGroups[j]);
            if (common.length > 0) {
              subGroups[i] = _.union(subGroups[i], subGroups[j]);
              delete(subGroups[j]);
            }
          }
        }
      }
    }
    subGroups = _.compact(subGroups);

    var coplanarPolygon;
    for (subGroup of subGroups) {
      var step2Group = [];
      for (var polygonIndex of subGroup) {
        coplanarPolygon = coplanarGroup[polygonIndex];
        step2Group.push(coplanarPolygon);
        coplanarPolygon.coplanarGroup = step2Group; // map polygon back to its containing coplanar group
      }
      step2Groups.push(step2Group);
    }
  }

  this.coplanarGroups = step2Groups;
}
