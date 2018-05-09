const QuoteDelimiter = (() => {
  'use strict';

  class QuoteDelimiter {
    constructor(delim, returnable=true) {
      this.delim = delim;
      this.returnable = returnable;
      this.escapeCharacters = ['\\'];
    }

    split(source) {
      const {delim, returnable, escapeCharacters} = this;
      let str = source.read(source.available());
      if(!str.startsWith(delim)) return null;
      const dlen = delim.length;
      let i = dlen;
      let len = i;
      let isClosed = false;
      loop:
      while(i <= str.length - dlen) {
        for(let char of escapeCharacters) {
          if(str.startsWith(char + delim, i)) {
            str = str.substr(0, i) + str.substr(i + char.length);
            i += dlen;
            len += char.length + dlen;
            continue loop;
          }
        }
        for(let char of escapeCharacters) {
          if(str.startsWith(char + char, i)) {
            str = str.substr(0, i) + str.substr(i + char.length);
            i += char.length;
            len += char.length + char.length;
            continue loop;
          }
        }
        if(str.startsWith(delim, i)) {
          isClosed = true;
          i++;
          len++;
          break;
        }
        i++;
        len++;
      }
      return {
        value: str.substr(0, i),
        idx: source.idx,
        pos: {
          line: source.pos.line,
          column: source.pos.column
        },
        returnable: returnable,
        content: str.substr(dlen, i - dlen - dlen),
        length: len,
        isQuoted: true,
        isClosed
      };
    }
  }

  return (...args) => new QuoteDelimiter(...args);
})();

if(!this.window) module.exports = QuoteDelimiter;
