/* eslint-disable no-bitwise */
import { Renderable, DrawingMode } from './renderable.js';
import { Material } from './material.js';
import { vec3 } from '../lib/gl-matrix/index.js';
import { ObjLoader } from './objLoader.js';
import { HairLoader } from './hairloader.js';
import { gl } from './gl.js';
import { TextureParamType, Texture2D } from './texture.js';
import { isMobile } from './logger.js';
import { Shader } from './shader.js';

function addLine(face1, face2, wireframeMap, wireframeIndices) {
  let add = false;
  if (face1 in wireframeMap) {
    if (!wireframeMap[face1].includes(face2)) {
      wireframeMap[face1].push(face2);
      add = true;
    }
  } else if (face2 in wireframeMap) {
    if (!wireframeMap[face2].includes(face1)) {
      wireframeMap[face2].push(face1);
      add = true;
    }
  } else {
    // eslint-disable-next-line no-param-reassign
    wireframeMap[face1] = [face2];
    add = true;
  }
  if (add) {
    wireframeIndices.push(face1);
    wireframeIndices.push(face2);
  }
}

function addWireLines(face1, face2, face3, wireframeMap, wireframeIndices) {
  addLine(face1, face2, wireframeMap, wireframeIndices);
  addLine(face1, face3, wireframeMap, wireframeIndices);
  addLine(face2, face3, wireframeMap, wireframeIndices);
}

function findBestTextureSize(vertexSize) {
  let texSize = 512;
  while (texSize * texSize < vertexSize) {
    texSize *= 2;
  }
  return texSize;
}

function calcNormal(v0, v1, v2) {
  const u = vec3.subtract(vec3.create(), v1, v0);
  const v = vec3.subtract(vec3.create(), v2, v0);

  return vec3.normalize(vec3.create(), vec3.set(vec3.create(),
    (u[1] * v[2]) - (u[2] * v[1]),
    (u[2] * v[0]) - (u[0] * v[2]),
    (u[0] * v[1]) - (u[1] * v[0])));
}

function createBlendShapeTexture(rawTargets, fbxTree, vertexSize, texSize) {
  function getScaleVal(val) {
    if (val > 100000.0) {
      return 0.0000001;
    } if (val > 10000.0) {
      return 0.000001;
    } if (val > 1000.0) {
      return 0.00001;
    } if (val > 100.0) {
      return 0.0001;
    } if (val > 10.0) {
      return 0.001;
    } if (val > 1.0) {
      return 0.01;
    } if (val > 0.1) {
      return 0.1;
    } if (val > 0.01) {
      return 1.0;
    } if (val > 0.001) {
      return 10.0;
    } if (val > 0.0001) {
      return 100.0;
    } if (val > 0.00001) {
      return 1000.0;
    }
    return 10000.0;
  }

  function getScale(val) {
    if (val > 100000.0) {
      return 255; // 1.0
    } if (val > 10000.0) {
      return 232; // 0.91
    } if (val > 1000.0) {
      return 209; // 0.82
    } if (val > 100.0) {
      return 186; // 0.73
    } if (val > 10.0) {
      return 163; // 0.64
    } if (val > 1.0) {
      return 140; // 0.55
    } if (val > 0.1) {
      return 117; // 0.46
    } if (val > 0.01) {
      return 94; // 0.37
    } if (val > 0.001) {
      return 71; // 0.28
    } if (val > 0.0001) {
      return 48; // 0.18
    } if (val > 0.00001) {
      return 25; // 0.1
    }
    return 2; // 0.18
  }
  let texBytes;
  if (isMobile) {
    texBytes = new Uint8Array(texSize * texSize * 4);
    for (let i = texBytes.length - 1; i >= 0; i -= 1) {
      texBytes[i] = 0;
    }
  } else {
    texBytes = new Float32Array(texSize * texSize * 4);
    for (let i = texBytes.length - 1; i >= 0; i -= 1) {
      texBytes[i] = 0.5;
    }
  }

  let data; let indices; let verts; let st; let len; let scaleVal; let
    scaleCode;
  rawTargets.forEach((target, i) => {
    data = fbxTree.get(target.geoID);
    indices = data.indexes;
    verts = data.vertices;
    st = i * vertexSize * 4;
    if (isMobile) {
      indices.forEach((index, j) => {
        len = vec3.length(
          vec3.set(vec3.create(), verts[j * 3], verts[j * 3 + 1], verts[j * 3 + 2]),
        );
        scaleCode = getScale(len);
        scaleVal = getScaleVal(len);
        texBytes[st + index * 4] = (verts[j * 3] * scaleVal + 0.5) * 255.0;
        texBytes[st + index * 4 + 1] = (verts[j * 3 + 1] * scaleVal + 0.5) * 255.0;
        texBytes[st + index * 4 + 2] = (verts[j * 3 + 2] * scaleVal + 0.5) * 255.0;
        texBytes[st + index * 4 + 3] = scaleCode;
      });
    } else {
      indices.forEach((index, j) => {
        texBytes[st + index * 4] = verts[j * 3] + 0.5;
        texBytes[st + index * 4 + 1] = verts[j * 3 + 1] + 0.5;
        texBytes[st + index * 4 + 2] = verts[j * 3 + 2] + 0.5;
        texBytes[st + index * 4 + 3] = 0.35;
      });
    }
  });
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
  const texOptions = { Wrap: TextureParamType.Clamp_To_Edge, Filter: TextureParamType.Nearest };
  return new Texture2D(
    gl.RGBA, isMobile ? gl.UNSIGNED_BYTE : gl.FLOAT, false, texSize, texSize, texBytes, texOptions,
  );
  // return new Texture2D(gl.RGBA, gl.UNSIGNED_BYTE, false, texSize, texSize, texBytes, texOptions);
}

let blendshapeCount = 0;
export default class Mesh extends Renderable {
  constructor(shaderName, fileData) {
    super(new Material(shaderName));

    if (fileData === undefined) return undefined;

    this.size = 0;
    this.wireframe_size = 0;
    this.blendShapeSize = 0;
    this.blendShapeNames = undefined;
    this.blendWeights = undefined;
    this.blendVertexTexture = undefined;

    this.LoadObj(fileData);
  }

  LoadMesh(mesh, loadTag = undefined) {
    let loadName = loadTag;
    this.size = 0;
    this.wireframe_size = 0;
    this.aabb = mesh.aabb;
    const { vertices } = mesh;
    let { normals } = mesh;
    const texcoords = mesh.uv;
    const { vertexColors } = mesh;
    const vIndice = mesh.faces;
    const tIndice = mesh.uv_faces;
    const nIndice = mesh.normal_faces;
    const { meshDict } = mesh;
    // console.log(loadName);
    if (loadName && (!meshDict || Object.keys(meshDict).length === 0 || !(loadName in meshDict))) {
      loadName = undefined;
    }
    // console.log(mesh);
    // console.log(vIndice);

    let sameIndices = [];
    const faces = [];
    let vID = -1;
    let i0;
    let i1;
    let i2;
    let v0;
    let v1;
    let v2;
    let nor;
    let t0;
    let t1;
    let n0;
    let n1;
    let n2;
    const wireframeMap = {};
    const wireframeIndices = [];
    const wireframeFaces = [];
    // var add_vertex_color = vertexColors.length > 0;

    let i;
    let ist;
    let imax;
    if (!loadName) {
      ist = 0;
      imax = vIndice.length;
    } else {
      // console.log(meshDict[loadName]);
      ({ ist, imax } = meshDict[loadName]);
      // ist = meshDict[loadName][0];
      // imax = meshDict[loadName][1];
    }
    // console.log(`ist : ${ist}, imax : ${imax}`);
    for (i = ist; i < imax; i += 3) {
      addWireLines(vIndice[i], vIndice[i + 1], vIndice[i + 2], wireframeMap, wireframeIndices);
    }

    if (nIndice.length === 0) {
      normals = [...Array(vertices.length).fill(0.0)];
      sameIndices = [...Array(vertices.length).fill(0.0)];
      for (i = 0; i < vIndice.length; i += 3) {
        i0 = vIndice[i];
        i1 = vIndice[i + 1];
        i2 = vIndice[i + 2];
        v0 = [vertices[i0 * 3], vertices[(i0 * 3) + 1], vertices[(i0 * 3) + 2]];
        v1 = [vertices[i1 * 3], vertices[(i1 * 3) + 1], vertices[(i1 * 3) + 2]];
        v2 = [vertices[i2 * 3], vertices[(i2 * 3) + 1], vertices[(i2 * 3) + 2]];

        nor = calcNormal(v0, v1, v2);
        nIndice.push(i0);
        nIndice.push(i1);
        nIndice.push(i2);
        sameIndices[i0 * 3] += 1.0;
        sameIndices[(i0 * 3) + 1] += 1.0;
        sameIndices[(i0 * 3) + 2] += 1.0;
        sameIndices[i1 * 3] += 1.0;
        sameIndices[(i1 * 3) + 1] += 1.0;
        sameIndices[(i1 * 3) + 2] += 1.0;
        sameIndices[i2 * 3] += 1.0;
        sameIndices[(i2 * 3) + 1] += 1.0;
        sameIndices[(i2 * 3) + 2] += 1.0;

        normals[i0 * 3] += nor[0];
        normals[(i0 * 3) + 1] += nor[1];
        normals[(i0 * 3) + 2] += nor[2];
        normals[i1 * 3] += nor[0];
        normals[(i1 * 3) + 1] += nor[1];
        normals[(i1 * 3) + 2] += nor[2];
        normals[i2 * 3] += nor[0];
        normals[(i2 * 3) + 1] += nor[1];
        normals[(i2 * 3) + 2] += nor[2];
      }
      for (i = normals.length - 1; i >= 0; i -= 1) {
        normals[i] /= sameIndices[i];
      }
      // eslint-disable-next-line no-param-reassign
      mesh.normals = normals;
      // eslint-disable-next-line no-param-reassign
      mesh.normal_faces = nIndice;
    }

    for (i = ist; i < imax; i += 1) {
      vID = vIndice[i];
      if (tIndice.length === 0) {
        t0 = undefined;
        t1 = undefined;
      } else {
        t0 = texcoords[tIndice[i] * 2];
        t1 = texcoords[(tIndice[i] * 2) + 1];
      }
      if (nIndice.length === 0) {
        n0 = undefined;
        n1 = undefined;
        n2 = undefined;
      } else {
        n0 = normals[(nIndice[i] * 3)];
        n1 = normals[(nIndice[i] * 3) + 1];
        n2 = normals[(nIndice[i] * 3) + 2];
      }
      this.setFace(faces,
        vID,
        vertices[vID * 3],
        vertices[(vID * 3) + 1],
        vertices[(vID * 3) + 2],
        t0,
        t1,
        n0,
        n1,
        n2,
        vertexColors[vID * 3],
        vertexColors[vID * 3 + 1],
        vertexColors[vID * 3 + 2]);
    }

    let offset = 0;
    let stride = 3;
    if (faces.length > 0) {
      // vert_id
      stride += 1;
      if (vertexColors.length > 0) stride += 3;
    } else if (vertexColors.length > 0) stride += 3;
    if (normals.length > 0) stride += 3;
    if (texcoords.length > 0) stride += 2;

    let size = 3;
    this.attributeDatas.push({
      name: 'position', size, offset, stride,
    });
    offset += size;

    if (faces.length > 0) {
      size = 1;
      this.attributeDatas.push({
        name: 'vert_id', size, offset, stride,
      });
      offset += size;

      if (vertexColors.length > 0) {
        size = 3;
        this.attributeDatas.push({
          name: 'color', size, offset, stride,
        });
        offset += size;
      }

      if (normals.length > 0) {
        size = 3;
        this.attributeDatas.push({
          name: 'normal', size, offset, stride,
        });
        offset += size;
      }

      if (texcoords.length > 0) {
        size = 2;
        this.attributeDatas.push({
          name: 'texcoord', size, offset, stride,
        });
        offset += size;
      }
    } else {
      size = 3;
      this.attributeDatas.push({
        name: 'color', size, offset, stride,
      });
      offset += size;

      this.setPointsFace(faces, vertices, vertexColors);
      this.drawingMode = DrawingMode.Points;
    }

    this.faces = faces;

    this.uploadList(this.faces);

    imax = wireframeIndices.length;
    for (i = 0; i < imax; i += 1) {
      vID = wireframeIndices[i];
      this.setWireframeFace(
        wireframeFaces,
        vertices[vID * 3],
        vertices[(vID * 3) + 1],
        vertices[(vID * 3) + 2],
        vID,
      );
    }
    this.wireframeAttributeDatas.push({
      name: 'position', size: 3, offset: 0, stride: 4,
    });
    this.wireframeAttributeDatas.push({
      name: 'vert_id', size: 1, offset: 3, stride: 4,
    });
    this.uploadListWireframe(wireframeFaces);
    // if (add_vertex_color) {
    //     // this.material.setUniformData('texture', getDefaultTextures()["black"]);
    // }
  }

  LoadObj(fileData) {
    this.LoadMesh(ObjLoader(fileData));
  }

  LoadHair(fileData) {
    const mesh = HairLoader(fileData);
    const { vertexBuffer, vertexSize, aabb } = mesh;
    // console.log(mesh);
    // console.log(vertexBuffer);
    // console.log(vertexSize);
    // console.log(aabb);

    this.size = vertexSize;
    this.wireframe_size = 0;
    this.aabb = aabb;
    // console.log(aabb);

    this.attributeDatas.push({
      name: 'position', size: 3, offset: 0, stride: 6,
    });
    this.attributeDatas.push({
      name: 'tangent', size: 3, offset: 3, stride: 6,
    });

    this.drawingMode = DrawingMode.Lines;
    this.faces = vertexBuffer;
    this.uploadList(this.faces);
    this.material = new Material('hair');
    this.material.setUniformData('color', [0.6, 0.35, 0.1, 1.0]);
  }

  setFace(faces, id, x, y, z, tx, ty, nx, ny, nz, cx = undefined, cy = undefined, cz = undefined) {
    faces.push(parseFloat(x));
    faces.push(parseFloat(y));
    faces.push(parseFloat(z));
    if (id !== null) {
      faces.push(id);
    }

    if (cx !== undefined && cy !== undefined && cz !== undefined) {
      const checker = parseFloat(cx);
      if (checker < 1.0) {
        faces.push(checker);
        faces.push(parseFloat(cy));
        faces.push(parseFloat(cz));
      } else {
        faces.push(checker / 255.0);
        faces.push(parseFloat(cy) / 255.0);
        faces.push(parseFloat(cz) / 255.0);
      }
    }

    if (nx !== undefined && ny !== undefined && nz !== undefined) {
      faces.push(parseFloat(nx));
      faces.push(parseFloat(ny));
      faces.push(parseFloat(nz));
    }

    if (tx !== undefined && ty !== undefined) {
      faces.push(parseFloat(tx));
      faces.push(parseFloat(ty));
    }

    this.size += 1;
    return faces;
  }

  setWireframeFace(faces, x, y, z, id) {
    faces.push(parseFloat(x));
    faces.push(parseFloat(y));
    faces.push(parseFloat(z));
    faces.push(id);

    this.wireframe_size += 1;
    return faces;
  }

  setPointsFace(faces, vertices, vertexColors) {
    if (!vertices || vertices.length === 0 || vertices.length % 3 !== 0) return;

    if (vertexColors.length === vertices.length) {
      const total = vertices.length / 3;
      const checker = vertexColors[0];
      const isuint8 = checker > 1.0;
      for (let i = 0; i < total; i += 1) {
        faces.push(parseFloat(vertices[i * 3 + 0]));
        faces.push(parseFloat(vertices[i * 3 + 1]));
        faces.push(parseFloat(vertices[i * 3 + 2]));
        if (isuint8) {
          faces.push(parseFloat(vertexColors[i * 3 + 0]) / 255.0);
          faces.push(parseFloat(vertexColors[i * 3 + 1]) / 255.0);
          faces.push(parseFloat(vertexColors[i * 3 + 2]) / 255.0);
        } else {
          faces.push(parseFloat(vertexColors[i * 3 + 0]));
          faces.push(parseFloat(vertexColors[i * 3 + 1]));
          faces.push(parseFloat(vertexColors[i * 3 + 2]));
        }
        this.size += 1;
      }
    } else {
      const total = vertices.length / 3;
      for (let i = 0; i < total; i += 1) {
        faces.push(parseFloat(vertices[i * 3 + 0]));
        faces.push(parseFloat(vertices[i * 3 + 1]));
        faces.push(parseFloat(vertices[i * 3 + 2]));
        faces.push(1.0);
        faces.push(1.0);
        faces.push(1.0);
        this.size += 1;
      }
    }
  }

  setLineFace(faces, vertices, vertexColors) {
    if (!vertices || vertices.length === 0 || vertices.length % 3 !== 0) return;

    const total = vertices.length / 3;
    if (vertexColors.length === vertices.length) {
      const checker = vertexColors[0];
      const isuint8 = checker > 1.0;
      if (isuint8) {
        for (let i = 0; i < total; i += 1) {
          faces.push(parseFloat(vertices[i * 3 + 0]));
          faces.push(parseFloat(vertices[i * 3 + 1]));
          faces.push(parseFloat(vertices[i * 3 + 2]));
          faces.push(parseFloat(vertexColors[i * 3 + 0]) / 255.0);
          faces.push(parseFloat(vertexColors[i * 3 + 1]) / 255.0);
          faces.push(parseFloat(vertexColors[i * 3 + 2]) / 255.0);
          this.size += 1;
        }
      } else {
        for (let i = 0; i < total; i += 1) {
          faces.push(parseFloat(vertices[i * 3 + 0]));
          faces.push(parseFloat(vertices[i * 3 + 1]));
          faces.push(parseFloat(vertices[i * 3 + 2]));
          faces.push(parseFloat(vertexColors[i * 3 + 0]));
          faces.push(parseFloat(vertexColors[i * 3 + 1]));
          faces.push(parseFloat(vertexColors[i * 3 + 2]));
          this.size += 1;
        }
      }
    } else {
      faces.push(parseFloat(vertices[0]));
      faces.push(parseFloat(vertices[1]));
      faces.push(parseFloat(vertices[2]));
      faces.push(1.0);
      faces.push(1.0);
      faces.push(1.0);
      this.size += 1;
      for (let i = 0; i < total; i += 1) {
        faces.push(parseFloat(vertices[i * 3 + 0]));
        faces.push(parseFloat(vertices[i * 3 + 1]));
        faces.push(parseFloat(vertices[i * 3 + 2]));
        faces.push(1.0);
        faces.push(1.0);
        faces.push(1.0);
        this.size += 1;
        if (i < total - 1) {
          faces.push(parseFloat(vertices[i * 3 + 0]));
          faces.push(parseFloat(vertices[i * 3 + 1]));
          faces.push(parseFloat(vertices[i * 3 + 2]));
          faces.push(1.0);
          faces.push(1.0);
          faces.push(1.0);
          this.size += 1;
        }
      }
    }
  }

  LoadBlendShape(binData) {
    this.bytes = new Uint8Array(binData);
    this.blendShapeSize = this.readInt();

    // console.log(this.blendShapeSize);

    this.blendWeights = new Float32Array(this.blendShapeSize);
    this.verticeSize = this.readInt();

    // console.log(this.verticeSize);

    this.blendShapeNames = [];
    for (let i = 0; i < this.blendShapeSize; i += 1) {
      const size = this.readInt();
      // console.log(size);
      const name = this.readString(size);
      this.blendShapeNames.push(name);
    }
    const texSize = this.readInt();
    let texBytes = this.readBytes(texSize * texSize * 3 * 4);
    texBytes = new Uint8Array(texBytes);
    texBytes = new Float32Array(texBytes.buffer);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
    const texOptions = { Wrap: TextureParamType.Clamp_To_Edge, Filter: TextureParamType.Nearest };
    this.blendVertexTexture = new Texture2D(
      gl.RGB, gl.FLOAT, false, texSize, texSize, texBytes, texOptions,
    );
    this.blendShapeTextureSize = texSize;
    this.createBlendShapeMaterial(texSize, false);
  }

  readBytes(size) {
    if (this.bytes.length < size) throw new Error(`this.bytes.length:${this.bytes.length} < ${size}`);
    const data = this.bytes.subarray(0, size);
    this.bytes = this.bytes.subarray(size);
    return data;
  }

  readString(s) {
    const size = Math.min(s, this.bytes.length);
    let a = '';
    for (let c = 0; c < size; c += 1) a += String.fromCharCode(this.bytes[c]);
    this.bytes = this.bytes.subarray(size);
    return a;
  }

  readFloat() {
    let a = new Uint8Array(this.bytes);
    a = new Float32Array(a.buffer);
    this.bytes = this.bytes.subarray(4);
    return a[0];
  }

  readInt() {
    const a = this.bytes;
    // eslint-disable-next-line no-mixed-operators
    const c = a[0] | a[1] << 8 | a[2] << 16 | a[3] << 24;
    this.bytes = a.subarray(4);
    return c;
  }

  LoadBlendShapeJson(json, texture) {
    const jsonObj = JSON.parse(json);
    this.blendShapeSize = jsonObj.size;
    this.blendWeights = new Float32Array(this.blendShapeSize);
    this.verticeSize = jsonObj.vc;
    this.blendShapeNames = jsonObj.names;
    this.blendVertexTexture = texture;
    const texSize = jsonObj.texture_size;
    this.createBlendShapeMaterial(texSize, false);
  }

  parseBlendShape(json, verticeSize, texSize) {
    const jsonObj = JSON.parse(json);

    const { frameDatas } = jsonObj;
    this.blendShapeSize = frameDatas.length;
    this.blendShapeSize = Math.min(
      this.blendShapeSize, gl.getParameter(gl.MAX_VERTEX_UNIFORM_VECTORS) - 9,
    );
    this.blendWeights = new Float32Array(this.blendShapeSize);
    this.verticeSize = verticeSize;
    const texOptions = { Wrap: TextureParamType.Clamp_To_Edge, Filter: TextureParamType.Nearest };

    this.blendShapeNames = [];
    const vertices = new Float32Array(texSize * texSize * 3);

    for (let i = 0, ind = 0; i < this.blendShapeSize; i += 1) {
      const verts = frameDatas[i].vertices;
      this.blendShapeNames.push(`m_${frameDatas[i].name}`);
      const len = verts.length;
      for (let j = 0; j < len; j += 1) {
        vertices[ind] = verts[j];
        ind += 1;
      }
    }
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
    this.blendVertexTexture = new Texture2D(
      gl.RGB, gl.FLOAT, false, texSize, texSize, vertices, texOptions,
    );
  }

  SetBlendWeight(index, value) {
    this.blendWeights[index] = value;
    this.material.setUniformData('blendWeights', this.blendWeights);
    this.wireframeMaterial.setUniformData('blendWeights', this.blendWeights);
  }

  BlendShapeNameToIndex(name) {
    // console.log(this);
    for (let i = this.blendShapeNames.length - 1; i >= 0; i -= 1) {
      if (this.blendShapeNames[i] === name) return i;
    }
    return -1;
  }

  LoadFBX(mesh, fbxTree) {
    this.attributeDatas = [];
    this.wireframeAttributeDatas = [];
    this.size = 0;
    this.wireframe_size = 0;
    this.aabb = [
      mesh.buffers.max, mesh.buffers.min,
    ];

    const faces = [];
    let imax = mesh.buffers.vertexIndex.length;
    for (let i = 0; i < imax; i += 1) {
      this.setFace(
        faces,
        mesh.buffers.vertexIndex[i],
        mesh.buffers.vertex[i * 3], mesh.buffers.vertex[i * 3 + 1], mesh.buffers.vertex[i * 3 + 2],
        mesh.buffers.uvs[0][i * 2], mesh.buffers.uvs[0][i * 2 + 1],
        mesh.buffers.normal[i * 3], mesh.buffers.normal[i * 3 + 1], mesh.buffers.normal[i * 3 + 2],
        mesh.buffers.colors[i * 3], mesh.buffers.colors[i * 3 + 1], mesh.buffers.colors[i * 3 + 2],
      );
    }

    let offset = 0;
    let stride = 3;

    if (mesh.buffers.colors.length > 0) stride += 3;
    if (faces.length > 0) {
      // vert_id
      stride += 1;
      if (mesh.buffers.colors.length > 0) stride += 3;
    } else if (mesh.buffers.colors.length > 0) stride += 3;
    if (mesh.buffers.normal.length > 0) stride += 3;
    if (mesh.buffers.uvs.length > 0) stride += 2;

    let size = 3;
    this.attributeDatas.push({
      name: 'position', size, offset, stride,
    });
    offset += size;
    if (faces.length > 0) {
      size = 1;
      this.attributeDatas.push({
        name: 'vert_id', size, offset, stride,
      });
      offset += size;
      if (mesh.buffers.colors.length > 0) {
        size = 3;
        this.attributeDatas.push({
          name: 'color', size, offset, stride,
        });
        offset += size;
      }
      if (mesh.buffers.normal.length > 0) {
        size = 3;
        this.attributeDatas.push({
          name: 'normal', size, offset, stride,
        });
        offset += size;
      }
      if (mesh.buffers.uvs[0].length > 0) {
        size = 2;
        this.attributeDatas.push({
          name: 'texcoord', size, offset, stride,
        });
        offset += size;
      }
    } else {
      size = 3;
      this.attributeDatas.push({
        name: 'color', size, offset, stride,
      });
      offset += size;

      this.setPointsFace(faces, mesh.buffers.vertex, mesh.buffers.colors);
      this.drawingMode = DrawingMode.Points;
    }
    this.faces = faces;

    this.uploadList(this.faces);

    const wireframeMap = {};
    const wireframeIndices = [];
    const wireframeFaces = [];
    imax /= 3;
    // console.log(mesh.buffers.vertexIndex);
    for (let i = 0; i < imax; i += 1) {
      addWireLines(
        mesh.buffers.vertexIndex[i * 3],
        mesh.buffers.vertexIndex[i * 3 + 1],
        mesh.buffers.vertexIndex[i * 3 + 2],
        wireframeMap,
        wireframeIndices,
      );
    }

    imax = wireframeIndices.length;
    for (let i = 0, vID = 0; i < imax; i += 1) {
      vID = wireframeIndices[i];
      this.setWireframeFace(
        wireframeFaces,
        mesh.buffers.meshVertices[vID * 3],
        mesh.buffers.meshVertices[(vID * 3) + 1],
        mesh.buffers.meshVertices[(vID * 3) + 2],
        vID,
      );
    }
    this.wireframeAttributeDatas.push({
      name: 'position', size: 3, offset: 0, stride: 4,
    });
    this.wireframeAttributeDatas.push({
      name: 'vert_id', size: 1, offset: 3, stride: 4,
    });
    this.uploadListWireframe(wireframeFaces);

    if (mesh.morphTargets.length > 0) {
      // console.log(mesh.morphTargets[0].rawTargets);
      // console.log(fbxTree);
      const { rawTargets } = mesh.morphTargets[0];
      this.blendShapeSize = rawTargets.length;
      this.blendWeights = new Float32Array(this.blendShapeSize);
      this.verticeSize = mesh.buffers.meshVertices.length;
      this.blendShapeNames = [];
      for (let i = 0; i < this.blendShapeSize; i += 1) {
        this.blendShapeNames.push(rawTargets[i].name);
      }
      const texSize = findBestTextureSize(this.verticeSize * this.blendShapeSize);
      this.blendVertexTexture = createBlendShapeTexture(
        rawTargets, fbxTree, this.verticeSize, texSize,
      );
      this.createBlendShapeMaterial(texSize, true, 100.0);
    }
  }

  createBlendShapeMaterial(texSize, doScale, gloss = 30.0) {
    const blendShapeShader = Shader.FindShaderSource('blendshape');
    const replaceDefines = `#define BLENDSHAPE_SIZE ${this.blendShapeSize}\n`
      + `#define BLENDSHAPE_TEX_SIZE ${texSize}.0\n`
      + 'attribute float vert_id;\n';
    let replaceUniforms = 'uniform float verticeSize;\n'
      + 'uniform sampler2D blendVertexTexture;\n'
      + 'uniform float blendWeights[BLENDSHAPE_SIZE];\n'
      + 'vec4 getBlendOffset(sampler2D blendTexture, int blendShapeID) {\n'
      + 'float posInTexture = vert_id + (float(blendShapeID) * verticeSize);\n'
      + 'float xTexel, yTexel;\n'
      + 'xTexel = floor(mod(posInTexture, BLENDSHAPE_TEX_SIZE));\n'
      + 'yTexel = floor(posInTexture / BLENDSHAPE_TEX_SIZE);\n'
      + 'xTexel += 0.5;\n'
      + 'yTexel += 0.5;\n'
      + 'xTexel /= BLENDSHAPE_TEX_SIZE;\n'
      + 'yTexel /= BLENDSHAPE_TEX_SIZE;\n'
      + 'return texture2D(blendTexture, vec2(xTexel, yTexel));\n'
      + '}\n';
    if (doScale) {
      replaceUniforms += 'float getScale(float scaleCode) {\n'
      + 'if (scaleCode > 0.97) return 10000000.0;\n'
      + 'else if (scaleCode > 0.9) return 1000000.0;\n'
      + 'else if (scaleCode > 0.8) return 100000.0;\n'
      + 'else if (scaleCode > 0.7) return 10000.0;\n'
      + 'else if (scaleCode > 0.6) return 1000.0;\n'
      + 'else if (scaleCode > 0.5) return 100.0;\n'
      + 'else if (scaleCode > 0.4) return 10.0;\n'
      + 'else if (scaleCode > 0.3) return 1.0;\n'
      + 'else if (scaleCode > 0.2) return 0.1;\n'
      + 'else if (scaleCode > 0.1) return 0.01;\n'
      + 'else if (scaleCode > 0.01) return 0.001;\n'
      + 'return 0.0;\n'
      + '}\n';
    }
    const replaceGLPositionSrc = 'gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(finalPos, 1.0);';
    let replaceGLPosition = 'for (int i = 0; i < BLENDSHAPE_SIZE; i++) {\n'
      + 'vec4 texelVertex = getBlendOffset(blendVertexTexture, i);\n';
    if (doScale) {
      replaceGLPosition += 'if (texelVertex.w > 0.0) finalPos += (texelVertex.xyz - 0.5) * getScale(texelVertex.w) * blendWeights[i];\n';
    } else {
      replaceGLPosition += 'if (texelVertex.w > 0.0) finalPos += (texelVertex.xyz - 0.5) * 10.0 * blendWeights[i];\n';
    }
    replaceGLPosition += '}\n'
      + 'gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(finalPos, 1.0);\n';
    blendshapeCount += 1;
    Shader.ShaderMap().push({
      name: `blendshape${blendshapeCount}`,
      vs: blendShapeShader.vs.slice()
        .replace('DEFINES', replaceDefines)
        .replace('UNIFORMS', replaceUniforms)
        .replace(replaceGLPositionSrc, replaceGLPosition),
      fs: blendShapeShader.fs.slice(),
    });
    this.material = new Material(`blendshape${blendshapeCount}`);
    this.material.setUniformData('verticeSize', this.verticeSize);
    this.material.setUniformData('blendVertexTexture', this.blendVertexTexture);
    this.material.setUniformData('blendWeights', this.blendWeights);
    this.material.setUniformData('gloss', gloss);
    // console.log("loaded");
    const debugShader = Shader.FindShaderSource('debug');
    Shader.ShaderMap().push({
      name: `debug${blendshapeCount}`,
      vs: debugShader.vs.slice()
        .replace('DEFINES', replaceDefines)
        .replace('UNIFORMS', replaceUniforms)
        .replace(replaceGLPositionSrc, replaceGLPosition),
      fs: debugShader.fs.slice(),
    });
    // console.log(shadersMap);
    // console.log(this.verticeSize);
    this.wireframeMaterial = new Material(`debug${blendshapeCount}`);
    this.wireframeMaterial.setUniformData('verticeSize', this.verticeSize);
    this.wireframeMaterial.setUniformData('blendVertexTexture', this.blendVertexTexture);
    this.wireframeMaterial.setUniformData('blendWeights', this.blendWeights);
    this.wireframeMaterial.setUniformData('color', [0.0, 1.0, 0.0, 1.0]);
  }
}

export { Mesh };
