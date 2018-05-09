const Source = (() => {
  'use strict';

  class Source {
    constructor(str) {
      this.str = str;
      this.idx = 0;
      this.pos = {line: 0, column: 0};
    }

    available(off=this.idx) {
      return this.str.length - off;
    }

    read(len=1, off=this.idx) {
      return this.str.substr(off, len);
    }

    shift(len=1) {
      if(this.idx + len <= this.str.length) {
        this.idx += len;
        this.pos.column += len;
      }
      return this.available();
    }

    newline() {
      const {pos} = this;
      pos.line++;
      pos.column = 0;
      return this;
    }
  }

  return (...args) => new Source(...args);
})();

if(!this.window) module.exports = Source;
