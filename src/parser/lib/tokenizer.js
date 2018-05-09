const Tokenizer = (() => {
  'use strict';

  class Tokenizer {
    constructor(source, delimiter) {
      this.source = source;
      this.delimiter = delimiter;
      this.newline = ['\n'];
      this.UnexpectedTokenError = UnexpectedTokenError;
    }

    available() {
      return this.cache || this.source.available() !== 0;
    }

    tokenize() {
      if(!this.available()) return null;
      const {cache} = this;
      if(cache) {
        delete this.cache;
        return cache;
      }
      const {source, delimiter, newline, UnexpectedTokenError} = this;
      let res, len;
      let mark = source.idx;
      let pos = Object.assign({}, source.pos);
      while(source.available()) {
        if(res = delimiter.split(source)) {
          source.shift(res.length || res.value.length);
          if(newline.includes(res.value)) source.newline();
          if((len = res.idx - mark) || res.returnable) break;
          mark = source.idx;
          Object.assign(pos, source.pos);
        }
        else {
          if(UnexpectedTokenError) {
            throw new UnexpectedTokenError(source);
          }
          source.shift();
        }
      }
      if(res) {
        if(len) {
          if(res.returnable) this.cache = res;
          res = {
            value: source.read(len, mark),
            idx: mark,
            pos,
            returnable: true
          };
        }
      }
      else {
        res = {
          value: source.read(source.available(mark), mark),
          idx: mark,
          pos,
          returnable: true
        };
      }
      return res;
    }
  }

  class UnexpectedTokenError {
    constructor(source) {
      const {pos:{line, column}} = source;
      const char = source.read();
      const message = `UnexpectedTokenError at \'${char}\' line ${line} column ${column}`;
      this.message = message;
      this.stack = new Error(message).stack;
    }
  }

  return (...args) => new Tokenizer(...args);
})();

if(!this.window) module.exports = Tokenizer;
