/* eslint-disable prefer-destructuring */
import { clamp } from './inputmanager.js';

export default function ObjLoader(fileData) {
  if (fileData === undefined) return undefined;

  const lines = fileData.split('\n');
  if (lines === undefined || lines.length === 0) return undefined;

  let minX = Number.MAX_VALUE;
  let minY = Number.MAX_VALUE;
  let minZ = Number.MAX_VALUE;
  let maxX = Number.MIN_VALUE;
  let maxY = Number.MIN_VALUE;
  let maxZ = Number.MIN_VALUE;

  let c;
  let max;
  let line;
  let i;
  let valSize;
  let vals;
  const vertices = [];
  const vertexColors = [];
  const normals = [];
  const texcoords = [];
  const vIndices = [];
  const tIndices = [];
  const nIndices = [];
  let vertOnFaceCount = -1;
  let slashCount = 1;
  let addTexcoord = false;
  let addNormal = false;
  const meshDict = {};
  let lastMeshName;

  let splitted = [];
  function setIndices(val, sCount) {
    splitted = val.split(/\//);
    vIndices.push(splitted[0] - 1);
    if (addTexcoord) tIndices.push(splitted[1] - 1);
    if (addNormal) {
      if (sCount === 3) {
        nIndices.push(splitted[2] - 1);
      } else {
        nIndices.push(splitted[1] - 1);
      }
    }
  }

  for (c = 0, max = lines.length; c < max; c += 1) {
    line = lines[c];
    if (line[0] === 'v') {
      if (line[1] === 'n') {
        vals = line.split(' ');
        vals[1] = parseFloat(vals[1]);
        vals[2] = parseFloat(vals[2]);
        vals[3] = parseFloat(vals[3]);
        normals.push(vals[1]);
        normals.push(vals[2]);
        normals.push(vals[3]);
        addNormal = true;
      } else if (line[1] === 't') {
        vals = line.split(' ');
        vals[1] = parseFloat(vals[1]);
        vals[2] = parseFloat(vals[2]);
        texcoords.push(vals[1]);
        texcoords.push(vals[2]);
        addTexcoord = true;
      } else {
        vals = line.split(' ');
        vals[1] = parseFloat(vals[1]);
        vals[2] = parseFloat(vals[2]);
        vals[3] = parseFloat(vals[3]);
        // console.log(vals);
        vertices.push(vals[1]);
        vertices.push(vals[2]);
        vertices.push(vals[3]);

        if (vals[1] < minX) minX = vals[1];
        if (vals[2] < minY) minY = vals[2];
        if (vals[3] < minZ) minZ = vals[3];
        if (vals[1] > maxX) maxX = vals[1];
        if (vals[2] > maxY) maxY = vals[2];
        if (vals[3] > maxZ) maxZ = vals[3];

        if (vals.length > 4) {
          vertexColors.push(clamp(parseFloat(vals[4]), 0.0, 1.0));
          vertexColors.push(clamp(parseFloat(vals[5]), 0.0, 1.0));
          vertexColors.push(clamp(parseFloat(vals[6]), 0.0, 1.0));
          // add_vertex_color = true;
        }
      }
    } else if (line[0] === 'f') {
      if (vertOnFaceCount === -1) {
        //                                       - 'f'
        vertOnFaceCount = line.split(' ').length - 1;
        slashCount = 1 + (line.split('/').length - 1) / vertOnFaceCount;
      }
      vals = line.split(/ /);

      valSize = vals.length;
      for (i = 3; i < valSize; i += 1) {
        setIndices(vals[1], slashCount);
        setIndices(vals[i - 1], slashCount);
        setIndices(vals[i], slashCount);
      }
    } else if (line[0] === 'u') {
      if (lastMeshName) {
        meshDict[lastMeshName].imax = vIndices.length;
      }
      lastMeshName = line.split(/ /)[1];
      meshDict[lastMeshName] = { ist: vIndices.length, imax: -1 };
      // console.log(meshDict[lastMeshName]);
    }
  }
  if (lastMeshName) {
    meshDict[lastMeshName].imax = vIndices.length;
  }

  const aabb = [];
  aabb[0] = [minX, minY, minZ];
  aabb[1] = [maxX, maxY, maxZ];
  // console.log(meshDict);
  // console.log(Object.keys(meshDict).length);
  return {
    vertices,
    normals,
    uv: texcoords,
    vertexColors,
    faces: vIndices,
    uv_faces: tIndices,
    normal_faces: nIndices,
    aabb,
    meshDict,
  };
}

export { ObjLoader };
