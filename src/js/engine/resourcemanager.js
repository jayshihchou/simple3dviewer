import ReadFile from './readFile.js';

export default class ResourceManager {
  constructor() {
    this.list = [];
    this.text_ids = [];
    this.texts = [];
  }

  add(...args) {
    let c; let
      max;
    const st = this.list.length;
    for (c = st, max = st + args.length; c < max; c += 1) {
      this.list.push(args[c - st]);
      this.text_ids.push(c);
    }
  }

  addData(name, data) {
    this.texts[this.list.length] = data;
    this.list.push(name);
  }

  load() {
    let c;
    for (c = this.list.length - 1; c >= 0; c -= 1) {
      ReadFile.read(this.list[c], this.onLoad, { _this: this, index: this.text_ids[c] });
    }
  }

  onLoad(t, token) {
    if (token === undefined) return null;
    let text = t;
    const { _this } = token;
    const { index } = token;
    text = text.replace(/(?:\\[rn]|[\r\n]+)+/g, '\n');
    _this.texts[index] = text;
    _this.text_ids.splice(0, 1);
    return this;
  }

  printAll() {
    let c;
    for (c = this.list.length - 1; c >= 0; c -= 1) {
      // eslint-disable-next-line no-console
      console.log(this.list[c]);
    }
  }

  get loadFinished() {
    return this.text_ids.length === 0;
  }

  clear() {
    this.text_ids.length = 0;
    this.list.length = 0;
  }

  getFile(file) {
    let c;
    for (c = this.list.length - 1; c >= 0; c -= 1) {
      if (this.list[c] === file) return { name: file, data: this.texts[c] };
    }
    return null;
  }
}

const resourceManager = new ResourceManager();
export { resourceManager };
