const RegExpDelimiter = (() => {
  'use strict';

  class RegExpDelimiter {
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
      const res = source.read(source.available()).match(delim);
      if(!res || res.index !== 0) return null;
      const r = {
        value: res[0],
        idx: source.idx,
        pos: {
          line: source.pos.line,
          column: source.pos.column
        },
        returnable: returnable
      };
      if(kind) r.kind = kind;
      return r;
    }
  }

  return (...args) => new RegExpDelimiter(...args);
})();

if(!this.window) module.exports = RegExpDelimiter;
