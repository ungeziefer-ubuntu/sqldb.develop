const MultiDelimiter = (() => {
  'use strict';

  class MultiDelimiter {
    constructor() {
      this.arr = [];
    }

    extend(delimiter) {
      this.arr.push(delimiter);
      return this;
    }

    split(source) {
      const {arr} = this;
      for(let d of arr) {
        const res = d.split(source);
        if(res) return res;
      }
      return null;
    }
  }

  return () => new MultiDelimiter();
})();

if(!this.window) module.exports = MultiDelimiter;
