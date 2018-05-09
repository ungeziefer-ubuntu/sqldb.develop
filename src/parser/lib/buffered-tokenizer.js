const BufferedTokenizer = (() => {
  'use strict';

  class BufferedTokenizer {
    constructor(tokenizer) {
      this.tokenizer = tokenizer;
      this.buffer = []
      this.idx = -1;
    }

    hasNext() {
      const {tokenizer, buffer} = this;
      if(this.idx + 1 < buffer.length) {
        return true;
      }
      else {
        const res = tokenizer.tokenize();
        if(res) {
          this.buffer.push(res);
          return true;
        }
        else {
          return false;
        }
      }
    }

    next() {
      return this.hasNext() ? this.buffer[++this.idx] : null;
    }

    current() {
      return 0 <= this.idx ? this.buffer[this.idx] : null;
    }

    mark() {
      return this._mark = this.idx;
    }

    reset(idx=this._mark) {
      return this.idx = idx;
    }

    get(idx) {
      return this.buffer[idx];
    }

    toString() {
      const {tokenizer:{cache, source}, buffer, idx} = this;
      const _buffer = [];
      for(let i=idx+1; i<buffer.length; i++) _buffer.push(`\'${buffer[i].value}\'`);
      if(cache) _buffer.push(`\'${cache.value}\'`);
      if(source.available()) _buffer.push(`\'${source.read(source.available())}\'`);
      return `[${_buffer.join(',')}]`;
    }
  }

  return (...args) => new BufferedTokenizer(...args);
})();

if(!this.window) module.exports = BufferedTokenizer;
