/**
 * This file is from three.js: https://github.com/mrdoob/three.js/blob/dev/examples/js/loaders/FBXLoader.js
 * LICENSE : https://github.com/mrdoob/three.js/blob/dev/LICENSE
 * Modify by jayshihchou
 */

/**
 * @author Kyle-Larson https://github.com/Kyle-Larson
 * @author Takahiro https://github.com/takahirox
 * @author Lewy Blue https://github.com/looeee
 *
 * Loader loads FBX file and generates Group representing FBX scene.
 * Requires FBX file to be >= 7.0 and in ASCII or >= 6400 in Binary format
 * Versions lower than this may load but will probably have errors
 *
 * Needs Support:
 *  Morph normals / blend shape normals
 *
 * FBX format references:
 * 	https://wiki.blender.org/index.php/User:Mont29/Foundation/FBX_File_Structure
 * 	http://help.autodesk.com/view/FBX/2017/ENU/?guid=__cpp_ref_index_html (C++ SDK reference)
 *
 * 	Binary format specification:
 *		https://code.blender.org/2013/08/fbx-binary-file-format-specification/
 */
import { ReadFile } from '../engine/readFile.js';
import pako from './pako.esm.mjs';

const fbxloader = {};
(function (fbxloader) {
    'use strict';
    var fbxTree;
    var connections;

    function FBXLoader() { }

    fbxloader.load = function (url, onLoad, token) {
        ReadFile.readBinary(url, function (buffer, self) {

            onLoad(self.parse(buffer));

        }, this, token);

    };

    fbxloader.parse = function (FBXBuffer) {

        if (isFbxFormatBinary(FBXBuffer)) {

            fbxTree = new BinaryParser().parse(FBXBuffer);

        } else {

            var FBXText = convertArrayBufferToString(FBXBuffer);

            if (!isFbxFormatASCII(FBXText)) {

                throw new Error('FBXLoader: Unknown format.');

            }

            if (getFbxVersion(FBXText) < 7000) {

                throw new Error('FBXLoader: FBX version not supported, FileVersion: ' + getFbxVersion(FBXText));

            }

            fbxTree = new TextParser().parse(FBXText);

        }

        return new FBXTreeParser().parse(fbxTree);

    };



    // Parse the FBXTree object returned by the BinaryParser or TextParser and return a Group
    function FBXTreeParser() {
    }

    FBXTreeParser.prototype = {

        constructor: FBXTreeParser,

        parse: function () {

            connections = this.parseConnections();
            // console.log(connections);
            const materials = this.parseMaterials();
            var deformers = this.parseDeformers();
            // console.log(deformers);
            var geometryMap = new GeometryParser().parse(deformers, materials);
            // console.log(geometryMap);
            return geometryMap;

        },

        // Parses FBXTree.Connections which holds parent-child connections between objects (e.g. material -> texture, model->geometry )
        // and details the connection type
        parseConnections: function () {

            var connectionMap = new Map();

            if ('Connections' in fbxTree) {

                var rawConnections = fbxTree.Connections.connections;

                rawConnections.forEach(function (rawConnection) {

                    var fromID = rawConnection[0];
                    var toID = rawConnection[1];
                    var relationship = rawConnection[2];

                    if (!connectionMap.has(fromID)) {

                        connectionMap.set(fromID, {
                            parents: [],
                            children: []
                        });

                    }

                    var parentRelationship = { ID: toID, relationship: relationship };
                    connectionMap.get(fromID).parents.push(parentRelationship);

                    if (!connectionMap.has(toID)) {

                        connectionMap.set(toID, {
                            parents: [],
                            children: []
                        });

                    }

                    var childRelationship = { ID: fromID, relationship: relationship };
                    connectionMap.get(toID).children.push(childRelationship);

                });

            }

            return connectionMap;

        },

        // Parse nodes in FBXTree.Objects.Deformer
        // Deformer node can contain skinning or Vertex Cache animation data, however only skinning is supported here
        // Generates map of Skeleton-like objects for use later when generating and binding skeletons.
        parseDeformers: function () {

            // var skeletons = {};
            var morphTargets = {};

            if ('Deformer' in fbxTree.Objects) {

                var DeformerNodes = fbxTree.Objects.Deformer;

                for (var nodeID in DeformerNodes) {

                    var deformerNode = DeformerNodes[nodeID];

                    var relationships = connections.get(parseInt(nodeID));

                    if (deformerNode.attrType === 'Skin') {
                        // var skeleton = this.parseSkeleton(relationships, DeformerNodes);
                        // skeleton.ID = nodeID;

                        // if (relationships.parents.length > 1) console.warn('FBXLoader: skeleton attached to more than one geometry is not supported.');
                        // skeleton.geometryID = relationships.parents[0].ID;

                        // skeletons[nodeID] = skeleton;

                    } else if (deformerNode.attrType === 'BlendShape') {

                        var morphTarget = {
                            id: nodeID,
                        };

                        morphTarget.rawTargets = this.parseMorphTargets(relationships, DeformerNodes);
                        // morphTarget.id = nodeID;

                        if (relationships.parents.length > 1) console.warn('FBXLoader: morph target attached to more than one geometry is not supported.');

                        morphTargets[nodeID] = morphTarget;

                    }

                }

            }

            return {

                // skeletons: skeletons,
                morphTargets: morphTargets,

            };

        },

        // The top level morph deformer node has type "BlendShape" and sub nodes have type "BlendShapeChannel"
        parseMorphTargets: function (relationships, deformerNodes) {

            var rawMorphTargets = [];

            for (var i = 0; i < relationships.children.length; i++) {

                var child = relationships.children[i];

                var morphTargetNode = deformerNodes[child.ID];

                var rawMorphTarget = {

                    name: morphTargetNode.attrName,
                    initialWeight: morphTargetNode.DeformPercent,
                    id: morphTargetNode.id,
                    fullWeights: morphTargetNode.FullWeights.a

                };

                if (morphTargetNode.attrType !== 'BlendShapeChannel') return;

                rawMorphTarget.geoID = connections.get(parseInt(child.ID)).children.filter(function (child) {

                    return child.relationship === undefined;

                })[0].ID;

                rawMorphTargets.push(rawMorphTarget);

            }

            return rawMorphTargets;

        },

        parseMaterials: function () {

            const materialMap = new Map();

            if ('Material' in fbxTree.Objects) {

                const materialNodes = fbxTree.Objects.Material;

                for (const nodeID in materialNodes) {

                    const material = this.parseMaterial(materialNodes[nodeID]);
                    if (material !== null) materialMap.set(parseInt(nodeID), material);

                }

            }

            return materialMap;

        },

        parseMaterial: function (materialNode) {

            const ID = materialNode.id;
            const name = materialNode.attrName;
            let type = materialNode.ShadingModel; // Case where FBX wraps shading model in property object.

            if (typeof type === 'object') {

                type = type.value;

            } // Ignore unused materials which don't have any connections.


            if (!connections.has(ID)) return null;
            return {
                name: name
            };

        },
    };

    // parse Geometry data from FBXTree and return map of BufferGeometries
    function GeometryParser() { }

    GeometryParser.prototype = {

        constructor: GeometryParser,

        // Parse nodes in FBXTree.Objects.Geometry
        parse: function (deformers, materials) {

            var matRelationships = {};
            materials.forEach((mat, key) => {
                var name = mat.name;
                var relationships = connections.get(key);
                // console.log(relationships.parents);
                relationships.parents.forEach((p) => {
                    if (!(p.ID in matRelationships)) matRelationships[p.ID] = [];
                    matRelationships[p.ID].push(name);
                    // console.log(`${p.ID} ======== `);
                    // console.log(connections.get(p.ID));
                });
            });

            var geometryMap = new Map();
            // console.log(connections);

            if ('Geometry' in fbxTree.Objects) {

                var geoNodes = fbxTree.Objects.Geometry;

                for (var nodeID in geoNodes) {

                    var relationships = connections.get(parseInt(nodeID));
                    var geo = this.parseGeometry(relationships, geoNodes[nodeID], deformers, matRelationships);

                    geometryMap.set(parseInt(nodeID), geo);

                }

            }
            // console.log(fbxTree);
            // console.log(geometryMap);
            if (materials) {
                const modelNodes = fbxTree.Objects.Model;
                let geometry;
                for (const nodeID in modelNodes) {
                    const id = parseInt( nodeID );
                    const relationships = connections.get(id);
                    relationships.children.forEach(function (child) {
                        if (geometryMap.has(child.ID)) {
                            geometry = geometryMap.get(child.ID);
                        }
                    });
                    relationships.children.forEach(function (child) {
                        if (geometry && materials.has(child.ID)) {
                            if (!geometry.materials) geometry.materials = [];
                            geometry.materials.push(materials.get(child.ID).name);
                            // console.log(child.ID);
                            // console.log(geometry);
                        }
                    });
                }
                // console.log('===================== fbxTree');
                // console.log(fbxTree.Objects.Model);
                // console.log('===================== mat');
                // materials.forEach((mat, key) => {
                //     var name = mat.name;
                //     var relationships = connections.get(key);
                //     console.log(relationships);
                //     relationships.parents.forEach((p) => {
                //         // console.log(p.ID);
                //         console.log(geometryMap.get(p.ID));
                //     });
                // });
                // console.log('===================== getmap');
                // console.log(geometryMap);
                // console.log('=====================');
                // geometryMap.set('materialNames', material);
            }
            // console.log(geometryMap);

            return geometryMap;

        },

        // Parse single node in FBXTree.Objects.Geometry
        parseGeometry: function (relationships, geoNode, deformers, matRelationships) {
            // console.log(geoNode);
            switch (geoNode.attrType) {
                case 'Mesh':
                    return this.parseMeshGeometry(relationships, geoNode, deformers, matRelationships);
                case 'Shape':
                    return this.genShape(geoNode);
            }
        },


        // Parse single node mesh geometry in FBXTree.Objects.Geometry
        parseMeshGeometry: function (relationships, geoNode, deformers, matRelationships) {
            // console.log(relationships);
            // console.log(matRelationships);
            var morphTargets = [];
            // var matnames;

            var modelNodes = relationships.parents.map(function (parent) {
                return fbxTree.Objects.Model[parent.ID];
            });
            // console.log(modelNodes);

            // don't create geometry if it is not associated with any models
            if (modelNodes.length === 0) return;

            // console.log(relationships.children);

            relationships.children.forEach(function (child) {

                if (deformers.morphTargets[child.ID] !== undefined) {

                    morphTargets.push(deformers.morphTargets[child.ID]);

                }

            });

            // console.log(matnames);

            // Assume one model and get the preRotation from that
            // if there is more than one model associated with the geometry this may cause problems
            var modelNode = modelNodes[0];
            // console.log(modelNode);

            // var transformData = {};

            // if ('RotationOrder' in modelNode) transformData.eulerOrder = getEulerOrder(modelNode.RotationOrder.value);
            // if ('InheritType' in modelNode) transformData.inheritType = parseInt(modelNode.InheritType.value);

            // if ('GeometricTranslation' in modelNode) transformData.translation = modelNode.GeometricTranslation.value;
            // if ('GeometricRotation' in modelNode) transformData.rotation = modelNode.GeometricRotation.value;
            // if ('GeometricScaling' in modelNode) transformData.scale = modelNode.GeometricScaling.value;

            // var transform = generateTransform(transformData);
            var transform = {};
            transform.name = modelNode.attrName;
            if ('Lcl_Rotation' in modelNode) transform.euler = modelNode.Lcl_Rotation.value;
            if ('Lcl_Scaling' in modelNode) transform.scale = modelNode.Lcl_Scaling.value;
            if ('Lcl_Translation' in modelNode) transform.position = modelNode.Lcl_Translation.value;

            if ('RotationPivot' in modelNode) {
                if (!('position' in transform)) {
                    transform.position = [0.0, 0.0, 0.0];
                }
                transform.position[0] += modelNode.RotationPivot.value[0];
                transform.position[1] += modelNode.RotationPivot.value[1];
                transform.position[2] += modelNode.RotationPivot.value[2];
                if (!('pivot' in transform)) {
                    transform.pivot = [0.0, 0.0, 0.0];
                }
                transform.pivot[0] += modelNode.RotationPivot.value[0];
                transform.pivot[1] += modelNode.RotationPivot.value[1];
                transform.pivot[2] += modelNode.RotationPivot.value[2];
            }
            if ('ScalingOffset' in modelNode) {
                if (!('pivot' in transform)) {
                    transform.pivot = [0.0, 0.0, 0.0];
                }
                transform.pivot[0] -= modelNode.ScalingOffset.value[0];
                transform.pivot[1] -= modelNode.ScalingOffset.value[1];
                transform.pivot[2] -= modelNode.ScalingOffset.value[2];
            }

            if ('position' in transform) {
                transform.position[0] *= 0.01;
                transform.position[1] *= 0.01;
                transform.position[2] *= 0.01;
            }

            if ('scale' in transform) {
                transform.scale[0] *= 0.01;
                transform.scale[1] *= 0.01;
                transform.scale[2] *= 0.01;
            } else {
                transform.scale = [0.01, 0.01, 0.01];
            }

            return this.genGeometry(geoNode, morphTargets, transform);

        },

        // Generate a BufferGeometry from a node in FBXTree.Objects.Geometry
        genGeometry: function (geoNode, morphTargets, preTransform) {

            // var geo = new THREE.BufferGeometry();
            // if (geoNode.attrName) geo.name = geoNode.attrName;
            // console.log(geoNode);

            var geoInfo = this.parseGeoNode(geoNode);
            // console.log(geoInfo);

            if ('pivot' in preTransform) {
                let rp = preTransform.pivot;
                for (let i = 0, imax = geoInfo.vertexPositions.length; i < imax; ++i) {
                    geoInfo.vertexPositions[i] -= rp[i % 3];
                }
            }

            // console.log(geoInfo);

            var buffers = this.genBuffers(geoInfo);
            buffers.meshVertices = geoInfo.vertexPositions;
            // console.log(preTransform);
            const matData = [];

            if (geoInfo.material && geoInfo.material.mappingType !== 'AllSame') {

                // Convert the material indices of each vertex into rendering groups on the geometry.
                var prevMaterialIndex = buffers.materialIndex[0];
                var startIndex = 0;

                buffers.materialIndex.forEach(function (currentIndex, i) {

                    if (currentIndex !== prevMaterialIndex) {

                        matData.push({
                            start: startIndex,
                            count: i - startIndex,
                            materialIndex: prevMaterialIndex,
                        })
                        // geo.addGroup(startIndex, i - startIndex, prevMaterialIndex);

                        prevMaterialIndex = currentIndex;
                        startIndex = i;

                    }

                });

                // the loop above doesn't add the last group, do that here.
                if (matData.length > 0) {

                    var lastGroup = matData[matData.length - 1];
                    var lastIndex = lastGroup.start + lastGroup.count;

                    if (lastIndex !== buffers.materialIndex.length) {

                        // geo.addGroup(lastIndex, buffers.materialIndex.length - lastIndex, prevMaterialIndex);
                        matData.push({
                            start: lastIndex,
                            count: buffers.materialIndex.length - lastIndex,
                            materialIndex: prevMaterialIndex,
                        });

                    }

                } else {
                    // geo.addGroup(0, buffers.materialIndex.length, buffers.materialIndex[0]);
                    matData.push({
                        start: 0,
                        count: buffers.materialIndex.length,
                        materialIndex: buffers.materialIndex[0],
                    });
                }

            }

            // console.log(matData);

            return {
                id: geoNode.id,
                buffers: buffers,
                morphTargets: morphTargets,
                transform: preTransform,
                materialData: matData,
                
            };

            // var positionAttribute = new THREE.Float32BufferAttribute(buffers.vertex, 3);

            // preTransform.applyToBufferAttribute(positionAttribute);

            // geo.setAttribute('position', positionAttribute);

            // if (buffers.colors.length > 0) {

            //     geo.setAttribute('color', new THREE.Float32BufferAttribute(buffers.colors, 3));

            // }

            // if (buffers.normal.length > 0) {

            //     var normalAttribute = new THREE.Float32BufferAttribute(buffers.normal, 3);

            //     var normalMatrix = new THREE.Matrix3().getNormalMatrix(preTransform);
            //     normalMatrix.applyToBufferAttribute(normalAttribute);

            //     geo.setAttribute('normal', normalAttribute);

            // }

            // buffers.uvs.forEach(function (uvBuffer, i) {

            //     // subsequent uv buffers are called 'uv1', 'uv2', ...
            //     var name = 'uv' + (i + 1).toString();

            //     // the first uv buffer is just called 'uv'
            //     if (i === 0) {

            //         name = 'uv';

            //     }

            //     geo.setAttribute(name, new THREE.Float32BufferAttribute(buffers.uvs[i], 2));

            // });

            // this.addMorphTargets(geo, geoNode, morphTargets, preTransform);

            // return geo;

        },

        parseGeoNode: function (geoNode) {

            var geoInfo = {};

            geoInfo.vertexPositions = (geoNode.Vertices !== undefined) ? geoNode.Vertices.a : [];
            geoInfo.vertexIndices = (geoNode.PolygonVertexIndex !== undefined) ? geoNode.PolygonVertexIndex.a : [];

            if (geoNode.LayerElementColor) {

                geoInfo.color = this.parseVertexColors(geoNode.LayerElementColor[0]);

            }

            if (geoNode.LayerElementMaterial) {

                geoInfo.material = this.parseMaterialIndices(geoNode.LayerElementMaterial[0]);

            }

            if (geoNode.LayerElementNormal) {

                geoInfo.normal = this.parseNormals(geoNode.LayerElementNormal[0]);

            }

            if (geoNode.LayerElementUV) {

                geoInfo.uv = [];

                var i = 0;
                while (geoNode.LayerElementUV[i]) {

                    geoInfo.uv.push(this.parseUVs(geoNode.LayerElementUV[i]));
                    i++;

                }

            }

            // geoInfo.weightTable = {};

            // if (skeleton !== null) {

            //     geoInfo.skeleton = skeleton;

            //     skeleton.rawBones.forEach(function (rawBone, i) {

            //         // loop over the bone's vertex indices and weights
            //         rawBone.indices.forEach(function (index, j) {

            //             if (geoInfo.weightTable[index] === undefined) geoInfo.weightTable[index] = [];

            //             geoInfo.weightTable[index].push({

            //                 id: i,
            //                 weight: rawBone.weights[j],

            //             });

            //         });

            //     });

            // }

            return geoInfo;

        },

        genBuffers: function (geoInfo) {

            var buffers = {
                vertexIndex: [],
                vertex: [],
                normal: [],
                colors: [],
                uvs: [],
                materialIndex: [],
                vertexWeights: [],
                weightsIndices: [],
                min: [Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE],
                max: [Number.MIN_VALUE, Number.MIN_VALUE, Number.MIN_VALUE],
            };

            var polygonIndex = 0;
            var faceLength = 0;
            var displayedWeightsWarning = false;

            // these will hold data for a single face
            var facePositionIndexes = [];
            var vertexIndexes = [];
            var faceNormals = [];
            var faceColors = [];
            var faceUVs = [];
            var faceWeights = [];
            var faceWeightIndices = [];

            var self = this;
            geoInfo.vertexIndices.forEach(function (vertexIndex, polygonVertexIndex) {

                var endOfFace = false;

                // Face index and vertex index arrays are combined in a single array
                // A cube with quad faces looks like this:
                // PolygonVertexIndex: *24 {
                //  a: 0, 1, 3, -3, 2, 3, 5, -5, 4, 5, 7, -7, 6, 7, 1, -1, 1, 7, 5, -4, 6, 0, 2, -5
                //  }
                // Negative numbers mark the end of a face - first face here is 0, 1, 3, -3
                // to find index of last vertex bit shift the index: ^ - 1
                if (vertexIndex < 0) {

                    vertexIndex = vertexIndex ^ - 1; // equivalent to ( x * -1 ) - 1
                    endOfFace = true;

                }

                var weightIndices = [];
                var weights = [];

                vertexIndexes.push(vertexIndex);

                facePositionIndexes.push(vertexIndex * 3, vertexIndex * 3 + 1, vertexIndex * 3 + 2);

                if (geoInfo.color) {

                    var data = getData(polygonVertexIndex, polygonIndex, vertexIndex, geoInfo.color);

                    faceColors.push(data[0], data[1], data[2]);

                }

                if (geoInfo.skeleton) {

                    if (geoInfo.weightTable[vertexIndex] !== undefined) {

                        geoInfo.weightTable[vertexIndex].forEach(function (wt) {

                            weights.push(wt.weight);
                            weightIndices.push(wt.id);

                        });


                    }

                    if (weights.length > 4) {

                        if (!displayedWeightsWarning) {

                            console.warn('FBXLoader: Vertex has more than 4 skinning weights assigned to vertex. Deleting additional weights.');
                            displayedWeightsWarning = true;

                        }

                        var wIndex = [0, 0, 0, 0];
                        var Weight = [0, 0, 0, 0];

                        weights.forEach(function (weight, weightIndex) {

                            var currentWeight = weight;
                            var currentIndex = weightIndices[weightIndex];

                            Weight.forEach(function (comparedWeight, comparedWeightIndex, comparedWeightArray) {

                                if (currentWeight > comparedWeight) {

                                    comparedWeightArray[comparedWeightIndex] = currentWeight;
                                    currentWeight = comparedWeight;

                                    var tmp = wIndex[comparedWeightIndex];
                                    wIndex[comparedWeightIndex] = currentIndex;
                                    currentIndex = tmp;

                                }

                            });

                        });

                        weightIndices = wIndex;
                        weights = Weight;

                    }

                    // if the weight array is shorter than 4 pad with 0s
                    while (weights.length < 4) {

                        weights.push(0);
                        weightIndices.push(0);

                    }

                    for (var i = 0; i < 4; ++i) {

                        faceWeights.push(weights[i]);
                        faceWeightIndices.push(weightIndices[i]);

                    }

                }

                if (geoInfo.normal) {

                    var data = getData(polygonVertexIndex, polygonIndex, vertexIndex, geoInfo.normal);

                    faceNormals.push(data[0], data[1], data[2]);

                }

                if (geoInfo.material && geoInfo.material.mappingType !== 'AllSame') {
                    // console.log(geoInfo.material);
                    var materialIndex = getData(polygonVertexIndex, polygonIndex, vertexIndex, geoInfo.material)[0];

                }

                if (geoInfo.uv) {

                    geoInfo.uv.forEach(function (uv, i) {

                        var data = getData(polygonVertexIndex, polygonIndex, vertexIndex, uv);

                        if (faceUVs[i] === undefined) {

                            faceUVs[i] = [];

                        }

                        faceUVs[i].push(data[0]);
                        faceUVs[i].push(data[1]);

                    });

                }

                faceLength++;

                if (endOfFace) {

                    self.genFace(buffers, geoInfo, vertexIndexes, facePositionIndexes, materialIndex, faceNormals, faceColors, faceUVs, faceWeights, faceWeightIndices, faceLength);

                    polygonIndex++;
                    faceLength = 0;

                    // reset arrays for the next face
                    vertexIndexes = [];
                    facePositionIndexes = [];
                    faceNormals = [];
                    faceColors = [];
                    faceUVs = [];
                    faceWeights = [];
                    faceWeightIndices = [];

                }

            });

            return buffers;

        },

        // Generate data for a single face in a geometry. If the face is a quad then split it into 2 tris
        genFace: function (buffers, geoInfo, vertexIndexes, facePositionIndexes, materialIndex, faceNormals, faceColors, faceUVs, faceWeights, faceWeightIndices, faceLength) {
            let v0x, v0y, v0z, v1x, v1y, v1z, v2x, v2y, v2z;
            for (var i = 2; i < faceLength; i++) {
                buffers.vertexIndex.push(vertexIndexes[0]);
                buffers.vertexIndex.push(vertexIndexes[(i - 1)]);
                buffers.vertexIndex.push(vertexIndexes[i]);

                buffers.vertex.push(v0x = geoInfo.vertexPositions[facePositionIndexes[0]]);
                buffers.vertex.push(v0z = geoInfo.vertexPositions[facePositionIndexes[1]]);
                buffers.vertex.push(v0y = geoInfo.vertexPositions[facePositionIndexes[2]]);

                buffers.vertex.push(v1x = geoInfo.vertexPositions[facePositionIndexes[(i - 1) * 3]]);
                buffers.vertex.push(v1z = geoInfo.vertexPositions[facePositionIndexes[(i - 1) * 3 + 1]]);
                buffers.vertex.push(v1y = geoInfo.vertexPositions[facePositionIndexes[(i - 1) * 3 + 2]]);

                buffers.vertex.push(v2x = geoInfo.vertexPositions[facePositionIndexes[i * 3]]);
                buffers.vertex.push(v2z = geoInfo.vertexPositions[facePositionIndexes[i * 3 + 1]]);
                buffers.vertex.push(v2y = geoInfo.vertexPositions[facePositionIndexes[i * 3 + 2]]);

                buffers.max[0] = Math.max(buffers.max[0], v0x);
                buffers.max[0] = Math.max(buffers.max[0], v1x);
                buffers.max[0] = Math.max(buffers.max[0], v2x);
                buffers.max[1] = Math.max(buffers.max[1], v0y);
                buffers.max[1] = Math.max(buffers.max[1], v1y);
                buffers.max[1] = Math.max(buffers.max[1], v2y);
                buffers.max[2] = Math.max(buffers.max[2], v0z);
                buffers.max[2] = Math.max(buffers.max[2], v1z);
                buffers.max[2] = Math.max(buffers.max[2], v2z);

                buffers.min[0] = Math.min(buffers.min[0], v0x);
                buffers.min[0] = Math.min(buffers.min[0], v1x);
                buffers.min[0] = Math.min(buffers.min[0], v2x);
                buffers.min[1] = Math.min(buffers.min[1], v0y);
                buffers.min[1] = Math.min(buffers.min[1], v1y);
                buffers.min[1] = Math.min(buffers.min[1], v2y);
                buffers.min[2] = Math.min(buffers.min[2], v0z);
                buffers.min[2] = Math.min(buffers.min[2], v1z);
                buffers.min[2] = Math.min(buffers.min[2], v2z);

                // if (geoInfo.skeleton) {

                //     buffers.vertexWeights.push(faceWeights[0]);
                //     buffers.vertexWeights.push(faceWeights[1]);
                //     buffers.vertexWeights.push(faceWeights[2]);
                //     buffers.vertexWeights.push(faceWeights[3]);

                //     buffers.vertexWeights.push(faceWeights[(i - 1) * 4]);
                //     buffers.vertexWeights.push(faceWeights[(i - 1) * 4 + 1]);
                //     buffers.vertexWeights.push(faceWeights[(i - 1) * 4 + 2]);
                //     buffers.vertexWeights.push(faceWeights[(i - 1) * 4 + 3]);

                //     buffers.vertexWeights.push(faceWeights[i * 4]);
                //     buffers.vertexWeights.push(faceWeights[i * 4 + 1]);
                //     buffers.vertexWeights.push(faceWeights[i * 4 + 2]);
                //     buffers.vertexWeights.push(faceWeights[i * 4 + 3]);

                //     buffers.weightsIndices.push(faceWeightIndices[0]);
                //     buffers.weightsIndices.push(faceWeightIndices[1]);
                //     buffers.weightsIndices.push(faceWeightIndices[2]);
                //     buffers.weightsIndices.push(faceWeightIndices[3]);

                //     buffers.weightsIndices.push(faceWeightIndices[(i - 1) * 4]);
                //     buffers.weightsIndices.push(faceWeightIndices[(i - 1) * 4 + 1]);
                //     buffers.weightsIndices.push(faceWeightIndices[(i - 1) * 4 + 2]);
                //     buffers.weightsIndices.push(faceWeightIndices[(i - 1) * 4 + 3]);

                //     buffers.weightsIndices.push(faceWeightIndices[i * 4]);
                //     buffers.weightsIndices.push(faceWeightIndices[i * 4 + 1]);
                //     buffers.weightsIndices.push(faceWeightIndices[i * 4 + 2]);
                //     buffers.weightsIndices.push(faceWeightIndices[i * 4 + 3]);

                // }

                if (geoInfo.color) {
                    buffers.colors.push(faceColors[0]);
                    buffers.colors.push(faceColors[1]);
                    buffers.colors.push(faceColors[2]);

                    buffers.colors.push(faceColors[(i - 1) * 3]);
                    buffers.colors.push(faceColors[(i - 1) * 3 + 1]);
                    buffers.colors.push(faceColors[(i - 1) * 3 + 2]);

                    buffers.colors.push(faceColors[i * 3]);
                    buffers.colors.push(faceColors[i * 3 + 1]);
                    buffers.colors.push(faceColors[i * 3 + 2]);
                }

                if (geoInfo.material && geoInfo.material.mappingType !== 'AllSame') {
                    buffers.materialIndex.push(materialIndex);
                    buffers.materialIndex.push(materialIndex);
                    buffers.materialIndex.push(materialIndex);
                }

                if (geoInfo.normal) {
                    buffers.normal.push(faceNormals[0]);
                    buffers.normal.push(faceNormals[1]);
                    buffers.normal.push(faceNormals[2]);

                    buffers.normal.push(faceNormals[(i - 1) * 3]);
                    buffers.normal.push(faceNormals[(i - 1) * 3 + 1]);
                    buffers.normal.push(faceNormals[(i - 1) * 3 + 2]);

                    buffers.normal.push(faceNormals[i * 3]);
                    buffers.normal.push(faceNormals[i * 3 + 1]);
                    buffers.normal.push(faceNormals[i * 3 + 2]);
                }

                if (geoInfo.uv) {
                    geoInfo.uv.forEach(function (uv, j) {

                        if (buffers.uvs[j] === undefined) buffers.uvs[j] = [];

                        buffers.uvs[j].push(faceUVs[j][0]);
                        buffers.uvs[j].push(faceUVs[j][1]);

                        buffers.uvs[j].push(faceUVs[j][(i - 1) * 2]);
                        buffers.uvs[j].push(faceUVs[j][(i - 1) * 2 + 1]);

                        buffers.uvs[j].push(faceUVs[j][i * 2]);
                        buffers.uvs[j].push(faceUVs[j][i * 2 + 1]);

                    });

                }

            }

        },

        addMorphTargets: function (parentGeo, parentGeoNode, morphTargets, preTransform) {

            if (morphTargets.length === 0) return;

            parentGeo.morphTargetsRelative = true;

            parentGeo.morphAttributes.position = [];
            // parentGeo.morphAttributes.normal = []; // not implemented

            var self = this;
            morphTargets.forEach(function (morphTarget) {

                morphTarget.rawTargets.forEach(function (rawTarget) {

                    var morphGeoNode = fbxTree.Objects.Geometry[rawTarget.geoID];

                    if (morphGeoNode !== undefined) {

                        self.genMorphGeometry(parentGeo, parentGeoNode, morphGeoNode, preTransform, rawTarget.name);

                    }

                });

            });

        },

        // a morph geometry node is similar to a standard  node, and the node is also contained
        // in FBXTree.Objects.Geometry, however it can only have attributes for position, normal
        // and a special attribute Index defining which vertices of the original geometry are affected
        // Normal and position attributes only have data for the vertices that are affected by the morph
        genMorphGeometry: function (parentGeo, parentGeoNode, morphGeoNode, preTransform, name) {

            var vertexIndices = (parentGeoNode.PolygonVertexIndex !== undefined) ? parentGeoNode.PolygonVertexIndex.a : [];

            var morphPositionsSparse = (morphGeoNode.Vertices !== undefined) ? morphGeoNode.Vertices.a : [];
            var indices = (morphGeoNode.Indexes !== undefined) ? morphGeoNode.Indexes.a : [];

            var length = parentGeo.attributes.position.count * 3;
            var morphPositions = new Float32Array(length);

            for (var i = 0; i < indices.length; i++) {

                var morphIndex = indices[i] * 3;

                morphPositions[morphIndex] = morphPositionsSparse[i * 3];
                morphPositions[morphIndex + 1] = morphPositionsSparse[i * 3 + 1];
                morphPositions[morphIndex + 2] = morphPositionsSparse[i * 3 + 2];

            }

            // TODO: add morph normal support
            var morphGeoInfo = {
                vertexIndices: vertexIndices,
                vertexPositions: morphPositions,

            };

            var morphBuffers = this.genBuffers(morphGeoInfo);

            var positionAttribute = new THREE.Float32BufferAttribute(morphBuffers.vertex, 3);
            positionAttribute.name = name || morphGeoNode.attrName;

            preTransform.applyToBufferAttribute(positionAttribute);

            parentGeo.morphAttributes.position.push(positionAttribute);

        },

        // Parse normal from FBXTree.Objects.Geometry.LayerElementNormal if it exists
        parseNormals: function (NormalNode) {

            var mappingType = NormalNode.MappingInformationType;
            var referenceType = NormalNode.ReferenceInformationType;
            var buffer = NormalNode.Normals.a;
            var indexBuffer = [];
            if (referenceType === 'IndexToDirect') {

                if ('NormalIndex' in NormalNode) {

                    indexBuffer = NormalNode.NormalIndex.a;

                } else if ('NormalsIndex' in NormalNode) {

                    indexBuffer = NormalNode.NormalsIndex.a;

                }

            }

            return {
                dataSize: 3,
                buffer: buffer,
                indices: indexBuffer,
                mappingType: mappingType,
                referenceType: referenceType
            };

        },

        // Parse UVs from FBXTree.Objects.Geometry.LayerElementUV if it exists
        parseUVs: function (UVNode) {

            var mappingType = UVNode.MappingInformationType;
            var referenceType = UVNode.ReferenceInformationType;
            var buffer = UVNode.UV.a;
            var indexBuffer = [];
            if (referenceType === 'IndexToDirect') {

                indexBuffer = UVNode.UVIndex.a;

            }

            return {
                dataSize: 2,
                buffer: buffer,
                indices: indexBuffer,
                mappingType: mappingType,
                referenceType: referenceType
            };

        },

        // Parse Vertex Colors from FBXTree.Objects.Geometry.LayerElementColor if it exists
        parseVertexColors: function (ColorNode) {

            var mappingType = ColorNode.MappingInformationType;
            var referenceType = ColorNode.ReferenceInformationType;
            var buffer = ColorNode.Colors.a;
            var indexBuffer = [];
            if (referenceType === 'IndexToDirect') {

                indexBuffer = ColorNode.ColorIndex.a;

            }

            return {
                dataSize: 4,
                buffer: buffer,
                indices: indexBuffer,
                mappingType: mappingType,
                referenceType: referenceType
            };

        },

        parseMaterialIndices(MaterialNode) {

            const mappingType = MaterialNode.MappingInformationType;
            const referenceType = MaterialNode.ReferenceInformationType;

            if (mappingType === 'NoMappingInformation') {

                return {
                    dataSize: 1,
                    buffer: [0],
                    indices: [0],
                    mappingType: 'AllSame',
                    referenceType: referenceType
                };

            }

            const materialIndexBuffer = MaterialNode.Materials.a; // Since materials are stored as indices, there's a bit of a mismatch between FBX and what
            // we expect.So we create an intermediate buffer that points to the index in the buffer,
            // for conforming with the other functions we've written for other data.

            const materialIndices = [];

            for (let i = 0; i < materialIndexBuffer.length; ++i) {

                materialIndices.push(i);

            }

            return {
                dataSize: 1,
                buffer: materialIndexBuffer,
                indices: materialIndices,
                mappingType: mappingType,
                referenceType: referenceType
            };

        }, // Generate a NurbGeometry from a node in FBXTree.Objects.Geometry

        genShape: function (shapeNode) {
            var vertices = shapeNode.Vertices.a;
            // for (let i = vertices.length - 1; i >= 0; --i) {
            //     vertices[i] = vertices[i] * 1.0;
            // }
            return {
                name: shapeNode.attrName,
                indexes: shapeNode.Indexes.a,
                vertices: vertices,
                normals: shapeNode.Normals.a
            };
        },
    };

    // parse an FBX file in ASCII format
    function TextParser() { }

    TextParser.prototype = {

        constructor: TextParser,

        getPrevNode: function () {

            return this.nodeStack[this.currentIndent - 2];

        },

        getCurrentNode: function () {

            return this.nodeStack[this.currentIndent - 1];

        },

        getCurrentProp: function () {

            return this.currentProp;

        },

        pushStack: function (node) {

            this.nodeStack.push(node);
            this.currentIndent += 1;

        },

        popStack: function () {

            this.nodeStack.pop();
            this.currentIndent -= 1;

        },

        setCurrentProp: function (val, name) {

            this.currentProp = val;
            this.currentPropName = name;

        },

        parse: function (text) {

            this.currentIndent = 0;

            this.allNodes = new FBXTree();
            this.nodeStack = [];
            this.currentProp = [];
            this.currentPropName = '';

            var self = this;

            var split = text.split(/[\r\n]+/);

            split.forEach(function (line, i) {

                var matchComment = line.match(/^[\s\t]*;/);
                var matchEmpty = line.match(/^[\s\t]*$/);

                if (matchComment || matchEmpty) return;

                var matchBeginning = line.match('^\\t{' + self.currentIndent + '}(\\w+):(.*){', '');
                var matchProperty = line.match('^\\t{' + (self.currentIndent) + '}(\\w+):[\\s\\t\\r\\n](.*)');
                var matchEnd = line.match('^\\t{' + (self.currentIndent - 1) + '}}');

                if (matchBeginning) {

                    self.parseNodeBegin(line, matchBeginning);

                } else if (matchProperty) {

                    self.parseNodeProperty(line, matchProperty, split[++i]);

                } else if (matchEnd) {

                    self.popStack();

                } else if (line.match(/^[^\s\t}]/)) {

                    // large arrays are split over multiple lines terminated with a ',' character
                    // if this is encountered the line needs to be joined to the previous line
                    self.parseNodePropertyContinued(line);

                }

            });

            return this.allNodes;

        },

        parseNodeBegin: function (line, property) {

            var nodeName = property[1].trim().replace(/^"/, '').replace(/"$/, '');

            var nodeAttrs = property[2].split(',').map(function (attr) {

                return attr.trim().replace(/^"/, '').replace(/"$/, '');

            });

            var node = { name: nodeName };
            var attrs = this.parseNodeAttr(nodeAttrs);

            var currentNode = this.getCurrentNode();

            // a top node
            if (this.currentIndent === 0) {

                this.allNodes.add(nodeName, node);

            } else { // a subnode

                // if the subnode already exists, append it
                if (nodeName in currentNode) {

                    // special case Pose needs PoseNodes as an array
                    if (nodeName === 'PoseNode') {

                        currentNode.PoseNode.push(node);

                    } else if (currentNode[nodeName].id !== undefined) {

                        currentNode[nodeName] = {};
                        currentNode[nodeName][currentNode[nodeName].id] = currentNode[nodeName];

                    }

                    if (attrs.id !== '') currentNode[nodeName][attrs.id] = node;

                } else if (typeof attrs.id === 'number') {

                    currentNode[nodeName] = {};
                    currentNode[nodeName][attrs.id] = node;

                } else if (nodeName !== 'Properties70') {

                    if (nodeName === 'PoseNode') currentNode[nodeName] = [node];
                    else currentNode[nodeName] = node;

                }

            }

            if (typeof attrs.id === 'number') node.id = attrs.id;
            if (attrs.name !== '') node.attrName = attrs.name;
            if (attrs.type !== '') node.attrType = attrs.type;

            this.pushStack(node);

        },

        parseNodeAttr: function (attrs) {

            var id = attrs[0];

            if (attrs[0] !== '') {

                id = parseInt(attrs[0]);

                if (isNaN(id)) {

                    id = attrs[0];

                }

            }

            var name = '', type = '';

            if (attrs.length > 1) {

                name = attrs[1].replace(/^(\w+)::/, '');
                type = attrs[2];

            }

            return { id: id, name: name, type: type };

        },

        parseNodeProperty: function (line, property, contentLine) {

            var propName = property[1].replace(/^"/, '').replace(/"$/, '').trim();
            var propValue = property[2].replace(/^"/, '').replace(/"$/, '').trim();

            // for special case: base64 image data follows "Content: ," line
            //	Content: ,
            //	 "/9j/4RDaRXhpZgAATU0A..."
            if (propName === 'Content' && propValue === ',') {

                propValue = contentLine.replace(/"/g, '').replace(/,$/, '').trim();

            }

            var currentNode = this.getCurrentNode();
            var parentName = currentNode.name;

            if (parentName === 'Properties70') {

                this.parseNodeSpecialProperty(line, propName, propValue);
                return;

            }

            // Connections
            if (propName === 'C') {

                var connProps = propValue.split(',').slice(1);
                var from = parseInt(connProps[0]);
                var to = parseInt(connProps[1]);

                var rest = propValue.split(',').slice(3);

                rest = rest.map(function (elem) {

                    return elem.trim().replace(/^"/, '');

                });

                propName = 'connections';
                propValue = [from, to];
                append(propValue, rest);

                if (currentNode[propName] === undefined) {

                    currentNode[propName] = [];

                }

            }

            // Node
            if (propName === 'Node') currentNode.id = propValue;

            // connections
            if (propName in currentNode && Array.isArray(currentNode[propName])) {

                currentNode[propName].push(propValue);

            } else {

                if (propName !== 'a') currentNode[propName] = propValue;
                else currentNode.a = propValue;

            }

            this.setCurrentProp(currentNode, propName);

            // convert string to array, unless it ends in ',' in which case more will be added to it
            if (propName === 'a' && propValue.slice(- 1) !== ',') {

                currentNode.a = parseNumberArray(propValue);

            }

        },

        parseNodePropertyContinued: function (line) {

            var currentNode = this.getCurrentNode();

            currentNode.a += line;

            // if the line doesn't end in ',' we have reached the end of the property value
            // so convert the string to an array
            if (line.slice(- 1) !== ',') {

                currentNode.a = parseNumberArray(currentNode.a);

            }

        },

        // parse "Property70"
        parseNodeSpecialProperty: function (line, propName, propValue) {

            // split this
            // P: "Lcl Scaling", "Lcl Scaling", "", "A",1,1,1
            // into array like below
            // ["Lcl Scaling", "Lcl Scaling", "", "A", "1,1,1" ]
            var props = propValue.split('",').map(function (prop) {

                return prop.trim().replace(/^\"/, '').replace(/\s/, '_');

            });

            var innerPropName = props[0];
            var innerPropType1 = props[1];
            var innerPropType2 = props[2];
            var innerPropFlag = props[3];
            var innerPropValue = props[4];

            // cast values where needed, otherwise leave as strings
            switch (innerPropType1) {

                case 'int':
                case 'enum':
                case 'bool':
                case 'ULongLong':
                case 'double':
                case 'Number':
                case 'FieldOfView':
                    innerPropValue = parseFloat(innerPropValue);
                    break;

                case 'Color':
                case 'ColorRGB':
                case 'Vector3D':
                case 'Lcl_Translation':
                case 'Lcl_Rotation':
                case 'Lcl_Scaling':
                    innerPropValue = parseNumberArray(innerPropValue);
                    break;

            }

            // CAUTION: these props must append to parent's parent
            this.getPrevNode()[innerPropName] = {

                'type': innerPropType1,
                'type2': innerPropType2,
                'flag': innerPropFlag,
                'value': innerPropValue

            };

            this.setCurrentProp(this.getPrevNode(), innerPropName);

        },

    };

    // Parse an FBX file in Binary format
    function BinaryParser() { }

    BinaryParser.prototype = {

        constructor: BinaryParser,

        parse: function (buffer) {

            var reader = new BinaryReader(buffer);
            reader.skip(23); // skip magic 23 bytes

            var version = reader.getUint32();

            // console.log('FBXLoader: FBX binary version: ' + version);

            var allNodes = new FBXTree();

            while (!this.endOfContent(reader)) {

                var node = this.parseNode(reader, version);
                if (node !== null) allNodes.add(node.name, node);

            }

            return allNodes;

        },

        // Check if reader has reached the end of content.
        endOfContent: function (reader) {

            // footer size: 160bytes + 16-byte alignment padding
            // - 16bytes: magic
            // - padding til 16-byte alignment (at least 1byte?)
            //	(seems like some exporters embed fixed 15 or 16bytes?)
            // - 4bytes: magic
            // - 4bytes: version
            // - 120bytes: zero
            // - 16bytes: magic
            if (reader.size() % 16 === 0) {

                return ((reader.getOffset() + 160 + 16) & ~0xf) >= reader.size();

            } else {

                return reader.getOffset() + 160 + 16 >= reader.size();

            }

        },

        // recursively parse nodes until the end of the file is reached
        parseNode: function (reader, version) {

            var node = {};

            // The first three data sizes depends on version.
            var endOffset = (version >= 7500) ? reader.getUint64() : reader.getUint32();
            var numProperties = (version >= 7500) ? reader.getUint64() : reader.getUint32();

            // note: do not remove this even if you get a linter warning as it moves the buffer forward
            var propertyListLen = (version >= 7500) ? reader.getUint64() : reader.getUint32();

            var nameLen = reader.getUint8();
            var name = reader.getString(nameLen);

            // Regards this node as NULL-record if endOffset is zero
            if (endOffset === 0) return null;

            var propertyList = [];

            for (var i = 0; i < numProperties; i++) {

                propertyList.push(this.parseProperty(reader));

            }

            // Regards the first three elements in propertyList as id, attrName, and attrType
            var id = propertyList.length > 0 ? propertyList[0] : '';
            var attrName = propertyList.length > 1 ? propertyList[1] : '';
            var attrType = propertyList.length > 2 ? propertyList[2] : '';

            // check if this node represents just a single property
            // like (name, 0) set or (name2, [0, 1, 2]) set of {name: 0, name2: [0, 1, 2]}
            node.singleProperty = (numProperties === 1 && reader.getOffset() === endOffset) ? true : false;

            while (endOffset > reader.getOffset()) {

                var subNode = this.parseNode(reader, version);

                if (subNode !== null) this.parseSubNode(name, node, subNode);

            }

            node.propertyList = propertyList; // raw property list used by parent

            if (typeof id === 'number') node.id = id;
            if (attrName !== '') node.attrName = attrName;
            if (attrType !== '') node.attrType = attrType;
            if (name !== '') node.name = name;

            return node;

        },

        parseSubNode: function (name, node, subNode) {

            // special case: child node is single property
            if (subNode.singleProperty === true) {

                var value = subNode.propertyList[0];

                if (Array.isArray(value)) {

                    node[subNode.name] = subNode;

                    subNode.a = value;

                } else {

                    node[subNode.name] = value;

                }

            } else if (name === 'Connections' && subNode.name === 'C') {

                var array = [];

                subNode.propertyList.forEach(function (property, i) {

                    // first Connection is FBX type (OO, OP, etc.). We'll discard these
                    if (i !== 0) array.push(property);

                });

                if (node.connections === undefined) {

                    node.connections = [];

                }

                node.connections.push(array);

            } else if (subNode.name === 'Properties70') {

                var keys = Object.keys(subNode);

                keys.forEach(function (key) {

                    node[key] = subNode[key];

                });

            } else if (name === 'Properties70' && subNode.name === 'P') {

                var innerPropName = subNode.propertyList[0];
                var innerPropType1 = subNode.propertyList[1];
                var innerPropType2 = subNode.propertyList[2];
                var innerPropFlag = subNode.propertyList[3];
                var innerPropValue;

                if (innerPropName.indexOf('Lcl ') === 0) innerPropName = innerPropName.replace('Lcl ', 'Lcl_');
                if (innerPropType1.indexOf('Lcl ') === 0) innerPropType1 = innerPropType1.replace('Lcl ', 'Lcl_');

                if (innerPropType1 === 'Color' || innerPropType1 === 'ColorRGB' || innerPropType1 === 'Vector' || innerPropType1 === 'Vector3D' || innerPropType1.indexOf('Lcl_') === 0) {

                    innerPropValue = [
                        subNode.propertyList[4],
                        subNode.propertyList[5],
                        subNode.propertyList[6]
                    ];

                } else {

                    innerPropValue = subNode.propertyList[4];

                }

                // this will be copied to parent, see above
                node[innerPropName] = {

                    'type': innerPropType1,
                    'type2': innerPropType2,
                    'flag': innerPropFlag,
                    'value': innerPropValue

                };

            } else if (node[subNode.name] === undefined) {

                if (typeof subNode.id === 'number') {

                    node[subNode.name] = {};
                    node[subNode.name][subNode.id] = subNode;

                } else {

                    node[subNode.name] = subNode;

                }

            } else {

                if (subNode.name === 'PoseNode') {

                    if (!Array.isArray(node[subNode.name])) {

                        node[subNode.name] = [node[subNode.name]];

                    }

                    node[subNode.name].push(subNode);

                } else if (node[subNode.name][subNode.id] === undefined) {

                    node[subNode.name][subNode.id] = subNode;

                }

            }

        },

        parseProperty: function (reader) {

            var type = reader.getString(1);

            switch (type) {

                case 'C':
                    return reader.getBoolean();

                case 'D':
                    return reader.getFloat64();

                case 'F':
                    return reader.getFloat32();

                case 'I':
                    return reader.getInt32();

                case 'L':
                    return reader.getInt64();

                case 'R':
                    var length = reader.getUint32();
                    return reader.getArrayBuffer(length);

                case 'S':
                    var length = reader.getUint32();
                    return reader.getString(length);

                case 'Y':
                    return reader.getInt16();

                case 'b':
                case 'c':
                case 'd':
                case 'f':
                case 'i':
                case 'l':

                    var arrayLength = reader.getUint32();
                    var encoding = reader.getUint32(); // 0: non-compressed, 1: compressed
                    var compressedLength = reader.getUint32();

                    if (encoding === 0) {

                        switch (type) {

                            case 'b':
                            case 'c':
                                return reader.getBooleanArray(arrayLength);

                            case 'd':
                                return reader.getFloat64Array(arrayLength);

                            case 'f':
                                return reader.getFloat32Array(arrayLength);

                            case 'i':
                                return reader.getInt32Array(arrayLength);

                            case 'l':
                                return reader.getInt64Array(arrayLength);

                        }

                    }

                    // if (typeof Zlib === 'undefined') {

                    //     console.error('FBXLoader: External library Inflate.min.js required, obtain or import from https://github.com/imaya/zlib.js');

                    // }

                    const compressed = new Uint8Array(reader.getArrayBuffer(compressedLength));
                    const reader2 = new BinaryReader(pako.inflate(compressed).buffer);
                    // var inflate = new Zlib.Inflate(new Uint8Array(reader.getArrayBuffer(compressedLength))); // eslint-disable-line no-undef
                    // var buffer = inflate.decompress().buffer;
                    // var reader2 = new BinaryReader(inflate.decompress().buffer);

                    switch (type) {

                        case 'b':
                        case 'c':
                            return reader2.getBooleanArray(arrayLength);

                        case 'd':
                            return reader2.getFloat64Array(arrayLength);

                        case 'f':
                            return reader2.getFloat32Array(arrayLength);

                        case 'i':
                            return reader2.getInt32Array(arrayLength);

                        case 'l':
                            return reader2.getInt64Array(arrayLength);

                    }

                default:
                    throw new Error('FBXLoader: Unknown property type ' + type);

            }

        }

    };

    function BinaryReader(buffer, littleEndian) {

        this.dv = new DataView(buffer);
        this.offset = 0;
        this.littleEndian = (littleEndian !== undefined) ? littleEndian : true;

    }

    BinaryReader.prototype = {

        constructor: BinaryReader,

        getOffset: function () {

            return this.offset;

        },

        size: function () {

            return this.dv.buffer.byteLength;

        },

        skip: function (length) {

            this.offset += length;

        },

        // seems like true/false representation depends on exporter.
        // true: 1 or 'Y'(=0x59), false: 0 or 'T'(=0x54)
        // then sees LSB.
        getBoolean: function () {

            return (this.getUint8() & 1) === 1;

        },

        getBooleanArray: function (size) {

            var a = [];

            for (var i = 0; i < size; i++) {

                a.push(this.getBoolean());

            }

            return a;

        },

        getUint8: function () {

            var value = this.dv.getUint8(this.offset);
            this.offset += 1;
            return value;

        },

        getInt16: function () {

            var value = this.dv.getInt16(this.offset, this.littleEndian);
            this.offset += 2;
            return value;

        },

        getInt32: function () {

            var value = this.dv.getInt32(this.offset, this.littleEndian);
            this.offset += 4;
            return value;

        },

        getInt32Array: function (size) {

            var a = [];

            for (var i = 0; i < size; i++) {

                a.push(this.getInt32());

            }

            return a;

        },

        getUint32: function () {

            var value = this.dv.getUint32(this.offset, this.littleEndian);
            this.offset += 4;
            return value;

        },

        // JavaScript doesn't support 64-bit integer so calculate this here
        // 1 << 32 will return 1 so using multiply operation instead here.
        // There's a possibility that this method returns wrong value if the value
        // is out of the range between Number.MAX_SAFE_INTEGER and Number.MIN_SAFE_INTEGER.
        // TODO: safely handle 64-bit integer
        getInt64: function () {

            var low, high;

            if (this.littleEndian) {

                low = this.getUint32();
                high = this.getUint32();

            } else {

                high = this.getUint32();
                low = this.getUint32();

            }

            // calculate negative value
            if (high & 0x80000000) {

                high = ~high & 0xFFFFFFFF;
                low = ~low & 0xFFFFFFFF;

                if (low === 0xFFFFFFFF) high = (high + 1) & 0xFFFFFFFF;

                low = (low + 1) & 0xFFFFFFFF;

                return - (high * 0x100000000 + low);

            }

            return high * 0x100000000 + low;

        },

        getInt64Array: function (size) {

            var a = [];

            for (var i = 0; i < size; i++) {

                a.push(this.getInt64());

            }

            return a;

        },

        // Note: see getInt64() comment
        getUint64: function () {

            var low, high;

            if (this.littleEndian) {

                low = this.getUint32();
                high = this.getUint32();

            } else {

                high = this.getUint32();
                low = this.getUint32();

            }

            return high * 0x100000000 + low;

        },

        getFloat32: function () {

            var value = this.dv.getFloat32(this.offset, this.littleEndian);
            this.offset += 4;
            return value;

        },

        getFloat32Array: function (size) {

            var a = [];

            for (var i = 0; i < size; i++) {

                a.push(this.getFloat32());

            }

            return a;

        },

        getFloat64: function () {

            var value = this.dv.getFloat64(this.offset, this.littleEndian);
            this.offset += 8;
            return value;

        },

        getFloat64Array: function (size) {

            var a = [];

            for (var i = 0; i < size; i++) {

                a.push(this.getFloat64());

            }

            return a;

        },

        getArrayBuffer: function (size) {

            var value = this.dv.buffer.slice(this.offset, this.offset + size);
            this.offset += size;
            return value;

        },

        getString: function (size) {

            // note: safari 9 doesn't support Uint8Array.indexOf; create intermediate array instead
            var a = [];

            for (var i = 0; i < size; i++) {

                a[i] = this.getUint8();

            }

            var nullByte = a.indexOf(0);
            if (nullByte >= 0) a = a.slice(0, nullByte);

            return decodeText(new Uint8Array(a));

        }

    };

    // FBXTree holds a representation of the FBX data, returned by the TextParser ( FBX ASCII format)
    // and BinaryParser( FBX Binary format)
    function FBXTree() { }

    FBXTree.prototype = {

        constructor: FBXTree,

        add: function (key, val) {

            this[key] = val;

        },

    };

    // ************** UTILITY FUNCTIONS **************

    function isFbxFormatBinary(buffer) {

        var CORRECT = 'Kaydara FBX Binary  \0';

        return buffer.byteLength >= CORRECT.length && CORRECT === convertArrayBufferToString(buffer, 0, CORRECT.length);

    }

    function isFbxFormatASCII(text) {

        var CORRECT = ['K', 'a', 'y', 'd', 'a', 'r', 'a', '\\', 'F', 'B', 'X', '\\', 'B', 'i', 'n', 'a', 'r', 'y', '\\', '\\'];

        var cursor = 0;

        function read(offset) {

            var result = text[offset - 1];
            text = text.slice(cursor + offset);
            cursor++;
            return result;

        }

        for (var i = 0; i < CORRECT.length; ++i) {

            var num = read(1);
            if (num === CORRECT[i]) {

                return false;

            }

        }

        return true;

    }

    function getFbxVersion(text) {

        var versionRegExp = /FBXVersion: (\d+)/;
        var match = text.match(versionRegExp);
        if (match) {

            var version = parseInt(match[1]);
            return version;

        }
        throw new Error('FBXLoader: Cannot find the version number for the file given.');

    }

    // Converts FBX ticks into real time seconds.
    function convertFBXTimeToSeconds(time) {

        return time / 46186158000;

    }

    var dataArray = [];

    // extracts the data from the correct position in the FBX array based on indexing type
    function getData(polygonVertexIndex, polygonIndex, vertexIndex, infoObject) {

        var index;

        switch (infoObject.mappingType) {

            case 'ByPolygonVertex':
                index = polygonVertexIndex;
                break;
            case 'ByPolygon':
                index = polygonIndex;
                break;
            case 'ByVertice':
                index = vertexIndex;
                break;
            case 'AllSame':
                index = infoObject.indices[0];
                break;
            default:
                console.warn('FBXLoader: unknown attribute mapping type ' + infoObject.mappingType);

        }

        if (infoObject.referenceType === 'IndexToDirect') index = infoObject.indices[index];

        var from = index * infoObject.dataSize;
        var to = from + infoObject.dataSize;

        return slice(dataArray, infoObject.buffer, from, to);

    }

    // generate transformation from FBX transform data
    // ref: https://help.autodesk.com/view/FBX/2017/ENU/?guid=__files_GUID_10CDD63C_79C1_4F2D_BB28_AD2BE65A02ED_htm
    // ref: http://docs.autodesk.com/FBX/2014/ENU/FBX-SDK-Documentation/index.html?url=cpp_ref/_transformations_2main_8cxx-example.html,topicNumber=cpp_ref__transformations_2main_8cxx_example_htmlfc10a1e1-b18d-4e72-9dc0-70d0f1959f5e
    function generateTransform(transformData) {

        var lTranslationM = mat4.create();
        var lPreRotationM = mat4.create();
        var lRotationM = mat4.create();
        var lPostRotationM = mat4.create();

        var lScalingM = mat4.create();
        var lScalingPivotM = mat4.create();
        var lScalingOffsetM = mat4.create();
        var lRotationOffsetM = mat4.create();
        var lRotationPivotM = mat4.create();

        var lParentGX = mat4.create();
        var lGlobalT = mat4.create();

        var inheritType = (transformData.inheritType) ? transformData.inheritType : 0;

        if (transformData.translation) mat4.translate(lTranslationM, lTranslationM, transformData.translation);

        // if (transformData.preRotation) {
        //     var array = transformData.preRotation.map(THREE.Math.degToRad);
        //     array.push(transformData.eulerOrder);
        //     lPreRotationM = mat4.fromQuat(mat4.create(), quat.fromEuler(quat.create(), array[0], array[1], array[2]));
        // }

        if (transformData.rotation) {
            var array = transformData.rotation.map(THREE.Math.degToRad);
            array.push(transformData.eulerOrder);
            lRotationM = mat4.fromQuat(mat4.create(), quat.fromEuler(quat.create(), array[0], array[1], array[2]));
        }

        // if (transformData.postRotation) {

        //     var array = transformData.postRotation.map(THREE.Math.degToRad);
        //     array.push(transformData.eulerOrder);
        //     lPostRotationM = mat4.fromQuat(mat4.create(), quat.fromEuler(quat.create(), array[0], array[1], array[2]));

        // }

        if (transformData.scale) mat4.scale(lScalingM, lScalingM, transformData.scale);

        // Pivots and offsets
        // if (transformData.scalingOffset) mat4.translate(lScalingOffsetM, lScalingOffsetM, transformData.scalingOffset);
        // if (transformData.scalingPivot) mat4.translate(lScalingPivotM, lScalingPivotM, transformData.scalingPivot);
        // if (transformData.rotationOffset) mat4.translate(lRotationOffsetM, lRotationOffsetM, transformData.rotationOffset);
        // if (transformData.rotationPivot) mat4.translate(lRotationPivotM, lRotationPivotM, transformData.rotationPivot);

        // parent transform
        // if (transformData.parentMatrixWorld) lParentGX = transformData.parentMatrixWorld;

        // Global Rotation
        var lLRM = mat4.multiply(mat4.create(), mat4.multiply(mat4.create(), lPreRotationM, lRotationM), lPostRotationM);
        var lParentGRM = mat4.fromQuat(mat4.create(), mat4.getRotation(quat.create(), lParentGX));

        // Global Shear*Scaling
        var lParentTM = mat4.translate(mat4.create(), mat4.create(), mat4.getTranslation(vec3.create(), lParentGX));
        var lLSM;
        var lParentGSM;
        var lParentGRSM;

        lParentGRSM = mat4.multiply(mat4.create(), mat4.invert(lParentTM, lParentTM), lParentGX);
        lParentGSM = mat4.multiply(mat4.create(), mat4.invert(lParentGRM, lParentGRM), lParentGRSM);
        lLSM = lScalingM;

        var lGlobalRS;
        if (inheritType === 0) {
            lGlobalRS = mat4.multiply(mat4.create(), mat4.multiply(mat4.create(), mat4.multiply(mat4.create(), lParentGRM, lLRM), lParentGSM), lLSM);
        } else if (inheritType === 1) {
            lGlobalRS = mat4.multiply(mat4.create(), mat4.multiply(mat4.create(), mat4.multiply(mat4.create(), lParentGRM, lParentGSM), lLRM), lLSM);
        } else {
            var lParentLSM = mat4.copy(mat4.create(), lScalingM);
            var lParentGSM_noLocal = mat4.multiply(mat4.create(), lParentGSM, mat4.invert(lParentLSM, lParentLSM));
            lGlobalRS = mat4.multiply(mat4.create(), mat4.multiply(mat4.create(), mat4.multiply(mat4.create(), lParentGRM, lLRM), lParentGSM_noLocal), lLSM);
        }

        // Calculate the local transform matrix
        var lTransform = mat4.multiply(mat4.create(), mat4.multiply(mat4.create(), mat4.multiply(mat4.create(), mat4.multiply(mat4.create(), mat4.multiply(mat4.create(), mat4.multiply(mat4.create(), mat4.multiply(mat4.create(),
            mat4.multiply(mat4.create(), mat4.multiply(mat4.create(), mat4.multiply(mat4.create(), lTranslationM, lRotationOffsetM),
                lRotationPivotM), lPreRotationM), lRotationM), lPostRotationM),
            mat4.invert(lRotationPivotM, lRotationPivotM)), lScalingOffsetM),
            lScalingPivotM), lScalingM), mat4.invert(lScalingPivotM, lScalingPivotM));

        var lLocalTWithAllPivotAndOffsetInfo = mat4.translate(mat4.create(), mat4.create(), mat4.getTranslation(vec3.create(), lTransform));

        var lGlobalTranslation = mat4.multiply(mat4.create(), lParentGX, lLocalTWithAllPivotAndOffsetInfo);
        lGlobalT = mat4.translate(mat4.create(), mat4.create(), mat4.getTranslation(vec3.create(), lGlobalTranslation));

        lTransform = mat4.multiply(mat4.create(), lGlobalT, lGlobalRS);

        return lTransform;
    }

    // Returns the three.js intrinsic Euler order corresponding to FBX extrinsic Euler order
    // ref: http://help.autodesk.com/view/FBX/2017/ENU/?guid=__cpp_ref_class_fbx_euler_html
    function getEulerOrder(order) {

        order = order || 0;

        var enums = [
            'ZYX', // -> XYZ extrinsic
            'YZX', // -> XZY extrinsic
            'XZY', // -> YZX extrinsic
            'ZXY', // -> YXZ extrinsic
            'YXZ', // -> ZXY extrinsic
            'XYZ', // -> ZYX extrinsic
            //'SphericXYZ', // not possible to support
        ];

        if (order === 6) {

            console.warn('FBXLoader: unsupported Euler Order: Spherical XYZ. Animations and rotations may be incorrect.');
            return enums[0];

        }

        return enums[order];

    }

    // Parses comma separated list of numbers and returns them an array.
    // Used internally by the TextParser
    function parseNumberArray(value) {

        var array = value.split(',').map(function (val) {

            return parseFloat(val);

        });

        return array;

    }

    function decodeText(array) {
        let s = '';
        for (let i = 0, imax = array.length; i < imax; ++i) {
            s += String.fromCharCode(array[i]);
        }
        try {
            // merges multi-byte utf-8 characters.
            return decodeURIComponent(escape(s));
        } catch (e) { // see #16358
            return s;
        }
    }

    function convertArrayBufferToString(buffer, from, to) {

        if (from === undefined) from = 0;
        if (to === undefined) to = buffer.byteLength;

        return decodeText(new Uint8Array(buffer, from, to));

    }

    function append(a, b) {

        for (var i = 0, j = a.length, l = b.length; i < l; i++, j++) {

            a[j] = b[i];

        }

    }

    function slice(a, b, from, to) {

        for (var i = from, j = 0; i < to; i++, j++) {

            a[j] = b[i];

        }

        return a;

    }

    return FBXLoader;

})(fbxloader);
export default { fbxloader };