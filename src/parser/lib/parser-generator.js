const ParserGenerator = (() => {
  'use strict';

  const typeOf = (o) => Object.prototype.toString.call(o).slice(8, -1);

  const isString = (o) => typeOf(o) === 'String';
  const isRegExp = (o) => typeOf(o) === 'RegExp';
  const isFunction = (o) => typeOf(o) === 'Function';
  const isParser = (o) => Object.getPrototypeOf(o.constructor) === ParserGenerator;

  const methods = {
    and:         0,
    or:          0,
    optional:    1,
    atLeastOnce: 1,
    many:        1,
    delim:       2,
    setup:       3,
    filter:      4,
    end:         5,
    on:          6,
    premise:     7,
    for:         8,
    error:       9
  };

  class ParserGenerator {
    constructor(name='Parser') {
      this.name = name;
      this.root = this;
      this.grammer = {fromItems: []};
      this.debugging = false;
    }

    from(id) {
      const from = new From(id, this.root);
      this.root.grammer.fromItems.push(from);
      return from;
    }

    where(whereCondition) {
      this.root.grammer.whereCondition = whereCondition;
      return this.root;
    }

    select(select) {
      this.root.grammer.select = select;
      return this.root;
    }

    parse(tokenizer, items={}, debugging=this.debugging) {
      items = {super: items};
      const {grammer:{fromItems, whereCondition, select}} = this;
      if(debugging) this.debug(`parse: ${tokenizer}`);
      for(let from of fromItems) {
        const {id, grammer:{assigning, max, min, delim, setup, filter, end, on, premise, for:for_, error}} = from;
        if(assigning !== void 0) {
          items[id] = assigning;
          continue;
        }
        if(on && !on(items, tokenizer) || premise && items[premise] === void 0
        || for_ && items[for_] !== void 0) {
          continue;
        }
        if(debugging) this.debug(`parse: id=${id}`);
        if(setup) setup(items, tokenizer);
        const arr = [];
        let _arr = [];
        let i = 0;
        let isError = false;
        if(max !== 1) items[id] = _arr;
        while(max === void 0 || i < max) {
          const mark = tokenizer.mark();
          const res = this._parse(items, tokenizer, from, debugging);
          if(res !== null) {
            _arr.push(res);
            if(max === 1) items[id] = _arr[0];
          }
          const _res = filter ? filter(items, tokenizer, res) : res;
          if(debugging) this.debug(`parse: res=${isString(_res) ? `\'${_res}\'` : _res}`);
          if(_res === null) {
            if(1 <= i && delim) {
              isError = true;
            }
            else if(min <= i) {
              tokenizer.reset(mark);
            }
            break;
          }
          arr.push(_res);
          _arr = arr.slice();
          items[id] = max === 1 ? _arr[0] : _arr;
          i++;
          if(delim && !this._hasDelim(items, tokenizer, delim)) break;
        }
        if(end && !end(items, tokenizer) || isError || i < min) {
          delete items[id];
          if(error !== false) isFunction(error) ? error(items, tokenizer) : this.error(items, tokenizer, error);
          if(debugging) this.debug('parse: return null');
          return null;
        }
      }
      const res = !whereCondition || whereCondition(items, tokenizer) ?
        isString(select) ? items[select] : isFunction(select) ? select(items, tokenizer) : items : null;
      if(debugging) this.debug(`parse: return ${isString(res) ? `\'${res}\'` : res}`);
      return res;
    }

    debug(str) {
      console.log(`DEBUG: ${this.name}.${str}`);
    }

    _parse(items, tokenizer, from, debugging) {
      const {grammer:{expectedItems, and, or}} = from;
      const mark = tokenizer.mark();
      if(debugging) this.debug(`parse: next=\'${tokenizer.hasNext() ? tokenizer.get(mark + 1).value : null}\'`);
      let res = null;
      for(let expected of expectedItems) {
        if(debugging) {
          this.debug(`parse: expected=${isString(expected) ? `\'${expected}\'`
            : isRegExp(expected) ? expected : isFunction(expected) ? 'Function'
            : isParser(expected) ? expected.name : null}`);
        }
        let value;
        res = isString(expected) && tokenizer.hasNext() && tokenizer.next().value === expected ? expected
          : isRegExp(expected) && tokenizer.hasNext() && expected.test(value = tokenizer.next().value) ? value
          : isFunction(expected) ? expected(items, tokenizer)
          : isParser(expected) ? expected.parse(tokenizer, items, debugging)
          : null;
        if(and && res !== null || or && res === null) {
          tokenizer.reset(mark);
          tokenizer.mark();
          continue;
        }
        if((or || !and && !or) && res !== null) {
          return res;
        }
        return null;
      }
      if(or) {
        tokenizer.reset(mark);
        if(tokenizer.hasNext()) tokenizer.next();
      }
      else {
        tokenizer.reset();
      }
      return res;
    }

    error(items, tokenizer, error) {
      const str = error || 'SyntaxError';
      const current = tokenizer.current() || tokenizer.next();
      if(current === null) {
        throw new Error(`${str} at line 0 column 0`);
      }
      const {value, pos:{line, column}} = current;
      throw new Error(`${str} at or near \'${value}\' line ${line} column ${column}`);
    }

    _hasDelim(items, tokenizer, delim) {
      const mark = tokenizer.mark();
      if(isString(delim) && tokenizer.hasNext() && tokenizer.next().value === delim
      || isRegExp(delim) && tokenizer.hasNext() && delim.test(tokenizer.next().value)) {
        return true;
      }
      else {
        tokenizer.reset(mark);
        return false;
      }
    }
  }

  class From {
    constructor(id, root) {
      this.id = id;
      this.root = root;
      this.grammer = {expectedItems: []};
    }

    in(expected) {
      this.grammer.expectedItems.push(expected);
      this.grammer.max = 1;
      this.grammer.min = 1;
      return new Option(this);
    }

    assigning(value) {
      this.grammer.assigning = value;
      return this.root;
    }
  }

  class Option {
    constructor(from) {
      this._from = from;
      this.root = from.root;
    }

    optional() {
      return this.many(0, 1);
    }

    atLeastOnce() {
      return this.many(1);
    }

    many(min=0, max) {
      this._from.grammer.min = min;
      this._from.grammer.max = max;
      if(max === void 0 || 1 < max) {
        this.delim = (delim) => {
          this._from.grammer.delim = delim;
          this.removeMethods('delim');
          return this;
        };
      }
      this.removeMethods('many');
      return this;
    }

    removeMethods(name) {
      const num = methods[name];
      for(let _name in methods) {
        if(this[_name] && methods[_name] <= num) this[_name] = void 0;
      }
    }
  }

  for(let name of Object.getOwnPropertyNames(ParserGenerator.prototype)) {
    if(name !== 'constructor') Option.prototype[name] = ParserGenerator.prototype[name];
  }

  for(let {name, _name} of [{name: 'and', _name: 'or'}, {name: 'or', _name: 'and'}]) {
    eval(
      `Option.prototype.${name} = function(expected) {` +
      '  this._from.grammer.expectedItems.push(expected);' +
      `  if(!this._from.grammer.${name}) {` +
      `    this._from.grammer.${name} = true;` +
      `    this._from.grammer.${_name} = void 0;` +
      '  }' +
      '  return this;' +
      '};'
    );
  }

  for(let name of ['setup', 'filter', 'end', 'on', 'premise', 'for', 'error']) {
    eval(
      `Option.prototype.${name} = function(arg) {` +
      `  this._from.grammer.${name} = arg;` +
      `  this.removeMethods(\'${name}\');` +
      '  return this;' +
      '};'
    );
  }

  return (name) => {
    let init;
    eval(`class ${name} extends ParserGenerator {}; init = (name) => new ${name}(name);`);
    return init(name);
  };
})();

if(!this.window) module.exports = ParserGenerator;
