const StringDelimiter = (() => {
  'use strict';

  class StringDelimiter {
    constructor(delim, returnable=true) {
      this.delim = delim;
      this.returnable = returnable;
    }

    setKind(kind) {
      this.kind = kind;
      return this;
    }

    split(source) {
      const {delim, returnable, kind} = this;
      const res = source.read(delim.length) === delim ? {
        value: delim,
        idx: source.idx,
        pos: {
          line: source.pos.line,
          column: source.pos.column
        },
        returnable: returnable
      } : null;
      if(kind) res.kind = kind;
      return res;
    }
  }

  return (...args) => new StringDelimiter(...args);
})();

if(!this.window) module.exports = StringDelimiter;
