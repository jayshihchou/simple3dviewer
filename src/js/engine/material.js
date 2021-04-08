import { Shader } from './shader.js';
import { Texture2D } from './texture.js';
import {
  vec2, vec3, vec4, mat2, mat3, mat4,
} from '../lib/gl-matrix/index.js';
import { gl } from './gl.js';
import { logger } from './logger.js';

export default class Material {
  constructor(shaderName) {
    this.parameters = [];
    this.ifdefines = [];
    this.defines = [];
    this.defineVals = [];
    this.additionalDefines = [];
    this.updateShader(shaderName);
  }

  get getShader() { return this.shader; }

  get getParameterCount() { return this.parameters.length; }

  updateShader(shaderName = undefined) {
    if (shaderName) {
      this.ifdefines.length = 0;
      this.defines.length = 0;
      this.defineVals.length = 0;
      this.shaderName = shaderName;
    }
    let shaderSrc = Shader.FindShaderSource(this.shaderName);
    if (!shaderSrc) shaderSrc = Shader.FindShaderSource('debug');
    if (shaderName) {
      this.parseFromShader(shaderSrc);
    } else {
      this.updateParameters();
      let defines = '';
      let c;
      let defineObj;
      for (c = this.additionalDefines.length - 1; c >= 0; c -= 1) {
        defineObj = this.additionalDefines[c];
        if (defineObj.val > 0) {
          defines += `#define ${defineObj.key} ${defineObj.val}\n`;
        }
      }
      shaderSrc = {
        name: shaderSrc.name,
        vs: shaderSrc.vs.replace('DEFINES', defines),
        fs: shaderSrc.fs.replace('DEFINES', defines),
      };
    }
    this.shader = new Shader(shaderSrc);
  }

  updateParameters() {
    let c;
    let i;
    let param;
    for (c = this.defines.length - 1; c >= 0; c -= 1) {
      for (i = this.parameters.length - 1; i >= 0; i -= 1) {
        param = this.parameters[i];
        if (param && param.name === this.defines[c]) {
          if (param.arrayVal !== this.defineVals[c]) {
            param.data = undefined;
            this.createParameter(i);
          }
        }
      }
    }
  }

  getParameterAt(index) {
    return this.parameters[index];
  }

  parseFromShader(shaderSrc) {
    // console.log(shaderSrc.name);
    this.parseFromStr(shaderSrc.vs);
    this.parseFromStr(shaderSrc.fs);
    return this;
  }

  getParameter(name) {
    let c;
    let param;
    for (c = this.parameters.length - 1; c >= 0; c -= 1) {
      param = this.parameters[c];
      if (param && param.name === name) {
        return param.data;
      }
    }
    return null;
  }

  /**
   * @param {string} name name of uniform data
   * @param {any} data data of uniform data
   * @returns {boolean} true when data setted.
   */
  setUniformData(name, data) {
    let c;
    let param;
    for (c = this.parameters.length - 1; c >= 0; c -= 1) {
      param = this.parameters[c];
      if (param && param.name === name) {
        param.data = data;
        param.expired = true;
        return true;
      }
    }

    return false;
  }

  setUniformArrayData(name, index, data) {
    let c;
    let param;
    for (c = this.parameters.length - 1; c >= 0; c -= 1) {
      param = this.parameters[c];
      if (param && param.array && param.name === name) {
        if (!param.data) {
          param = this.createParameter(c);
        }
        param.data[index] = data;
        param.expired = true;
        return true;
      }
    }

    return false;
  }

  hasKey(key) {
    for (let c = this.parameters.length - 1; c >= 0; c -= 1) {
      if (this.parameters[c].name === key) return true;
    }

    return false;
  }

  hasDefine(key) {
    for (let c = this.defines.length - 1; c >= 0; c -= 1) {
      if (this.defines[c] === key) return true;
    }

    return false;
  }

  hasIfDefine(key) {
    for (let c = this.ifdefines.length - 1; c >= 0; c -= 1) {
      if (this.ifdefines[c] === key) return true;
    }
    return false;
  }

  addOrUpdateDefine(key, val) {
    let index = -1;
    for (let c = this.defines.length - 1; c >= 0; c -= 1) {
      if (this.defines[c] === key) {
        index = c;
      }
    }
    if (index === -1) {
      this.additionalDefines.push({ key, val });
      this.defines.push(key);
      this.defineVals.push(val);
    } else {
      if (this.defineVals[index] === val) return;
      this.defineVals[index] = val;
    }
    this.updateShader();
  }

  createParameter(index) {
    const param = this.parameters[index];
    switch (param.type) {
      case 'sampler2D':
        if (!param.array) {
          param.data = new Texture2D();
        } else {
          param.data = [new Texture2D()];
          param.texArr = new Int32Array(param.arrayVal);
        }
        break;
      case 'vec4':
        if (!param.array) param.data = vec4.create();
        else param.data = new Float32Array(param.arrayVal * 4);
        break;
      case 'vec3':
        if (!param.array) param.data = vec3.create();
        else param.data = new Float32Array(param.arrayVal * 3);
        break;
      case 'vec2':
        if (!param.array) param.data = vec2.create();
        else param.data = new Float32Array(param.arrayVal * 2);
        break;
      case 'mat2':
        if (!param.array) param.data = mat2.create();
        else param.data = new Float32Array(param.arrayVal * 4);
        break;
      case 'mat3':
        if (!param.array) param.data = mat3.create();
        else param.data = new Float32Array(param.arrayVal * 9);
        break;
      case 'mat4':
        if (!param.array) param.data = mat4.create();
        else param.data = new Float32Array(param.arrayVal * 16);
        break;
      case 'float':
      case 'double':
        if (!param.array) param.data = 0.0;
        else param.data = new Float32Array(param.arrayVal);
        break;
      case 'bool':
      case 'int':
        if (!param.array) param.data = 0;
        else param.data = new Int32Array(param.arrayVal);
        break;
      default:
        break;
    }
    param.expired = true;
    return param;
  }

  /**
   * update all datas.
   */
  setUniformDatas() {
    let c;
    let max;
    let i;
    let imax;
    let param;
    let texunit = 0;
    for (c = 0, max = this.parameters.length; c < max; c += 1) {
      param = this.parameters[c];
      if (!param.data) {
        param = this.createParameter(c);
      }
      if (param.expired === undefined || param.expired) {
        param.expired = false;
        switch (param.type) {
          case 'sampler2D':
            if (param.array) {
              imax = param.data.length;
              for (i = 0; i < imax; i += 1) {
                param.data[i].bind(texunit);
                param.texArr[i] = texunit;
                texunit += 1;
              }
              this.shader.setIv(param.name, param.texArr);
              for (i = 0; i < imax; i += 1) {
                param.data[i].unbind();
              }
            } else {
              param.data.bind(texunit);
              this.shader.setInt(param.name, texunit);
              texunit += 1;
              param.data.unbind(texunit);
            }
            param.expired = true;
            break;
          case 'vec4':
            this.shader.setVec4(param.name, param.data);
            break;
          case 'vec3':
            this.shader.setVec3(param.name, param.data);
            break;
          case 'vec2':
            this.shader.setVec2(param.name, param.data);
            break;
          case 'mat2':
            this.shader.setMatrix2(param.name, param.data);
            break;
          case 'mat3':
            this.shader.setMatrix3(param.name, param.data);
            break;
          case 'mat4':
            this.shader.setMatrix4(param.name, param.data);
            break;
          case 'float':
          case 'double':
            if (param.array) this.shader.setFv(param.name, param.data);
            else this.shader.setFloat(param.name, param.data);
            break;
          case 'bool':
          case 'int':
            if (param.array) this.shader.Iv(param.name, param.data);
            else this.shader.setInt(param.name, param.data);
            break;
          default:
            break;
        }
        const err = gl.getError();
        if (err !== gl.NO_ERROR) {
          // eslint-disable-next-line no-console
          console.error(`error code : ${err}`);
          logger.oldLog(param);
        }
      }
    }
  }

  parseFromStr(text) {
    const str = text.replace('DEFINES', '').replace('UNIFORMS', '');

    let i = 0;
    let end;

    do {
      i = str.indexOf('#define', i);
      if (i >= 0) {
        i += 8;
        end = str.indexOf(' ', i);
        this.defines.push(str.substring(i, end));
        this.defineVals.push(parseFloat(str.substring(end, str.indexOf('\n', end))));
      }
    }
    while (i >= 0);

    const lines = str.split('\n');
    let type;
    let ifdef;
    let arg;
    let arrayVal;
    let words;
    let word;
    let line;
    let c;
    let d;
    let max;
    let dmax;
    let array = false;
    for (c = 0, max = lines.length; c <= max; c += 1) {
      line = lines[c];
      if (line.length !== 0) {
        if (line.includes('{')) break;
        if (line.includes('uniform') || line.includes('#ifdef')) {
          array = line.includes('[') || line.includes(']');
          words = line.split(' ');
          type = null;
          arg = null;
          ifdef = null;
          arrayVal = null;

          for (d = 0, dmax = words.length; d < dmax; d += 1) {
            word = words[d];
            switch (word) {
              case '':
              case 'uniform':
                break;
              case '#ifdef':
                if (word) ifdef = word;
                break;
              case 'sampler2D':
              case 'vec4':
              case 'vec3':
              case 'vec2':
              case 'mat2':
              case 'mat3':
              case 'mat4':
              case 'float':
              case 'double':
              case 'bool':
              case 'int':
                type = word;
                break;
              default:
                if (word) {
                  if (word.includes(';')) {
                    word = word.replace(';', '');
                  }
                  if (word.includes('[')) {
                    const ind = word.indexOf('[');
                    const defName = word.substring(ind + 1, word.indexOf(']'));
                    if (this.defines.includes(defName)) {
                      // console.log(`${line}:${word}[${arrayVal}]`);
                      arrayVal = this.defineVals[this.defines.indexOf(defName)];
                    } else if (typeof defName === 'string') {
                      arrayVal = 1;
                      // console.log(`${line}:${word}[?0] defines : ${this.defines}`);
                    } else {
                      // eslint-disable-next-line radix
                      arrayVal = parseInt(defName);
                      // console.log(`${line}:${word}[int ${defName}]`);
                    }
                    word = word.substring(0, ind);
                  }
                  arg = word;
                }
                break;
            }
            if (arg !== null) {
              if (type !== null) {
                this.parameters.push({
                  name: arg, type, array, arrayVal,
                });
                break;
              } else if (ifdef !== null) {
                this.ifdefines.push(arg);
              }
            }
          }
        }
      }
    }
  }
}

export { Material };
