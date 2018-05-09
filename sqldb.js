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

const SQLTokenizerFactory = (() => {
  'use strict';

  class SQLTokenizerFactory {
    constructor(components) {
      const {Source, StringDelimiter, RegExpDelimiter, QuoteDelimiter, MultiDelimiter,
        Tokenizer, BufferedTokenizer} = components;
      this.Source = Source;
      this.Tokenizer = Tokenizer;
      this.BufferedTokenizer = BufferedTokenizer;
      this.SQLDelimiter = MultiDelimiter()
        .extend(StringDelimiter(' ', false))
        .extend(StringDelimiter('\t', false))
        .extend(StringDelimiter('\n', false))
        .extend(StringDelimiter('('))
        .extend(StringDelimiter(')'))
        .extend(StringDelimiter(','))
        .extend(StringDelimiter(';'))
        .extend(StringDelimiter('.'))
        .extend(StringDelimiter('*'))
        .extend(QuoteDelimiter('\''))
        .extend(QuoteDelimiter('\"'))
        .extend(RegExpDelimiter(/^d+(\.\d*)?(?![a-z_])$/i).setKind('number'))
        .extend(RegExpDelimiter(/^\.\d+(?![a-z_])$/i).setKind('number'))
        .extend(RegExpDelimiter(/^[a-z]\w*/i).setKind('identifier'));
    }

    createTokenizer(str) {
      const {Source, Tokenizer, BufferedTokenizer, SQLDelimiter} = this;
      return BufferedTokenizer(Tokenizer(Source(str), SQLDelimiter));
    }
  }

  return (...args) => new SQLTokenizerFactory(...args);
})();

if(!this.window) module.exports = SQLTokenizerFactory;

const SQLReservedWords = [
  'use',
  'create',
  'drop',
  'select',
  'distinct',
  'from',
  'where',
  'group',
  'order',
  'having',
  'by',
  'as',
  'asc',
  'desc'
];

if(!this.window) module.exports = SQLReservedWords;

const SQLParser = (() => {
  'use strict';

  const arr = [
    'User',
    'Users',
    'CreateUser',
    'DropUser',
    'Database',
    'Databases',
    'UseDatabase',
    'CreateDatabase',
    'DropDatabase',
    'Tables',
    'Columns',
    'CreateTable',
    'DropTable',
    'Select',
    'Insert',
    'ColumnDefinition',
    'DataType',
    'SelectBody',
    'AllColumns',
    'AllTableColumns',
    'SelectExpressionItem',
    'Table',
    'FromItem',
    'GroupByElement',
    'OrderByElement',
    'ItemsList',
    'StringValue',
    'NumberValue',
    'BooleanValue',
    'NullValue',
    'Column',
    'SignedExpression',
    'Function',
    'Parenthesis',
    'UnaryExpression',
    'Expression',
    'Identifier'
  ];

  for(let i=0; i<arr.length; i++) {
    const name = arr[i];
    arr[i] = `const ${name} = submodules.${name} = ParserGenerator(\'${name}\');`
  }

  const declare = arr.join('');

  const define = () => {
    const isDuplicateColumnName = (items, tokenizer, res) => {
      if(!res) return res;
      const name = res.name;
      const columns = items.columnDefinitions || items.columns;
      for(let i=columns.length-2; 0<=i; i--) {
        if(columns[i].name === name) return null;
      }
      return res;
    };

    const countItemsLists = (items, tokenizer, res) => {
      const {columns, itemsLists} = items;
      return !columns || itemsLists.length <= columns.length ? res : null;
    };

    const toString = function() {
      const e = this;
      switch(e.type) {
        case 'number':   return e.stringValue;
        case 'string':   return `\'${e.stringValue}\'`;
        case 'booolean': return e.stringValue;
        case 'null':     return 'null';
        case 'column':   return e.name;
        default: throw new Error('FatalError:');
      }
    };

    User
      .from('user').in(/^user$/i).error(false)
      .select(() => ({type: 'user'}));

    Users
      .from('users').in(/^users$/i).error(false)
      .select(() => ({type: 'users'}));

    CreateUser
      .from('create').in(/^create$/i).error(false)
      .from('user').in(/^user$/i).error(false)
      .from('name').in(Identifier)
      .select((items) => ({type: 'create_user', name: items.name}));

    DropUser
      .from('drop').in(/^drop$/i).error(false)
      .from('user').in(/^user$/i).error(false)
      .from('name').in(Identifier)
      .select((items) => ({type: 'drop_user', name: items.name}));

    Database
      .from('database').in(/^database$/i).error(false)
      .select(() => ({type: 'database'}));

    Databases
      .from('databases').in(/^databases$/i).error(false)
      .select(() => ({type: 'databases'}));

    UseDatabase
      .from('use').in(/^use$/i).error(false)
      .from('name').in(Identifier)
      .select((items) => ({type: 'use_database', name: items.name}));

    CreateDatabase
      .from('create').in(/^create$/i).error(false)
      .from('database').in(/^database$/i).error(false)
      .from('name').in(Identifier)
      .select((items) => ({type: 'create_database', name: items.name}));

    DropDatabase
      .from('drop').in(/^drop$/i).error(false)
      .from('database').in(/^database$/i).error(false)
      .from('name').in(Identifier)
      .select((items) => ({type: 'drop_database', name: items.name}));

    Tables
      .from('tables').in(/^tables$/i).error(false)
      .select(() => ({type: 'tables'}));

    Columns
      .from('columns').in(/^columns$/i).optional()
      .from('from').in(/^from$/i).premise('columns')
      .from('describe').in(/^describe$/i).for('columns').error(false)
      .from('name').in(Identifier)
      .select((items) => ({type: 'columns', name: items.name}));

    CreateTable
      .from('create').in(/^create$/i).error(false)
      .from('table').in(/^table$/i).error(false)
      .from('name').in(Identifier)
      .from('(').in('(')
      .from('columnDefinitions').in(ColumnDefinition).atLeastOnce().delim(',').filter(isDuplicateColumnName)
      .from(')').in(')')
      .select((items) => ({
        type: 'create_table',
        name: items.name,
        columnDefinitions: items.columnDefinitions
      }));

    DropTable
      .from('drop').in(/^drop/i).error(false)
      .from('table').in(/^table$/i).error(false)
      .from('name').in(Identifier)
      .select((items) => ({
        type: 'drop_table',
        name: items.name
      }));

    Select
      .from('mainQuery').assigning(true)
      .from('selectBody').in(SelectBody).error(false)
      .select((items) => ({
        type: 'main_query',
        selectBody: items.selectBody
      }));

    Insert
      .from('insert').in(/^insert$/i).error(false)
      .from('into').in(/^into$/i)
      .from('table').in(Table)
      .from('(').in('(').optional()
      .from('columns').in(Column).atLeastOnce().delim(',').filter(isDuplicateColumnName).premise('(')
      .from(')').in(')').premise('(')
      .from('values').in(/^values$/i).optional()
      .from('itemsLists').in(ItemsList).atLeastOnce().delim(',').filter(countItemsLists)
      .select((items) => ({
        type: 'insert',
        table: items.table,
        columns: items.columns,
        itemsLists: items.itemsLists
      }));

    ColumnDefinition
      .from('name').in(Identifier)
      .from('dataType').in(DataType).optional()
      .select((items) => ({
        type: 'column_definition',
        name: items.name,
        dataType: items.dataType
      }));

    DataType
      .from('dataType')
        .in(/^string$/i)
        .or(/^number$/i)
        .or(/^boolean$/i)
        .error(false)
      .select((items) => ({
        type: 'data_type',
        dataType: items.dataType
      }));

    SelectBody
      .from('select').in(/^select$/i).error(false)
      .from('distinct').in(/^distinct$/i).optional()
      .from('selectItems').in(AllColumns).or(AllTableColumns).or(SelectExpressionItem).atLeastOnce().delim(',')
      .from('from').in(/^from$/i)
      .from('fromItem').in(FromItem)
      .from('where').in(/^where$/i).optional()
      .from('whereCondition').in(Expression).premise('where')
      .from('group').in(/^group$/i).optional()
      .from('by').in(/^by$/i).premise('group')
      .from('groupByElements').in(GroupByElement).atLeastOnce().delim(',').premise('group')
      .from('having').in(/^having$/i).optional()
      .from('havingCondition').in(Expression).premise('having')
      .from('order').in(/^order$/i).optional()
      .from('by').in(/^by$/i).premise('order')
      .from('orderByElements').in(OrderByElement).atLeastOnce().delim(',').premise('group')
      .from('limit').in(/^limit$/i).optional()
      .from('rowCount').in(/^\d+$/).premise('limit')
      .select((items) => ({
        type: 'query_body',
        distinct: items.distinct !== void 0,
        selectItems: items.selectItems,
        fromItem: items.fromItem,
        whereCondition: items.whereCondition,
        groupByElements: items.groupByElements,
        havingCondition: items.havingCondition,
        orderByElements: items.orderByElements,
        rowCount: items.rowCount
      }));

    AllColumns
      .from('*').in('*').error(false)
      .select(() => ({type: 'all_columns'}));

    AllTableColumns
      .from('table').in(Table).error(false)
      .from('.').in('.').error(false)
      .from('*').in('*').error(false)
      .select((items) => ({
        type: 'all_table_columns',
        table: items.table
      }));

    SelectExpressionItem
      .from('expression').in(Expression).error(false)
      .from('as').in(/^as$/i).optional()
      .from('alias').in(Identifier).premise('as')
      .from('alias').in(Identifier).optional().for('as')
      .select((items) => ({
        type: 'select_expression_item',
        expression: items.expression,
        alias: items.alias
      }));

    Table
      .from('name').in(Identifier).error(false)
      .select((items) => ({
        type: 'table',
        name: items.name
      }));

    FromItem
      .from('table').in(Table).error(false)
      .from('as').in(/^as$/i).optional()
      .from('alias').in(Identifier).premise('as')
      .from('alias').in(Identifier).optional().for('as')
      .select((items) => ({
        type: 'from_item',
        table: items.table,
        alias: items.alias
      }));

    GroupByElement
      .from('expression').in(Expression).error(false)
      .select((items) => ({
        type: 'groupby_element',
        table: items.expression
      }));

    OrderByElement
      .from('expression').in(Expression).error(false)
      .from('direction').in(/^asc$/i).or(/^desc$/i).optional()
      .select((items) => ({
        type: 'orderby_element',
        expression: items.expression,
        direction: items.direction.toLowerCase()
      }));

    ItemsList
      .from('(').in('(')
      .from('expressionList').in(Expression).atLeastOnce().delim(',').error(false)
      .from(')').in(')')
      .select((items) => ({
        type: 'items_list',
        expressionList: items.expressionList
      }));

    StringValue
      .from('stringValue').in((items, tokenizer) => {
        if(!tokenizer.hasNext()) return null;
        const res = tokenizer.next();
        return res.isQuoted && res.isClosed ? res.content : null;
      }).error(false)
      .select((items) => ({
        type: 'string',
        stringValue: items.stringValue
      }));

    NumberValue
      .from('stringValue').in((items, tokenizer) => {
        if(!tokenizer.hasNext()) return null;
        const res = tokenizer.next();
        return res.kind === 'number' ? res.value : null;
      }).error(false)
      .select((items) => ({
        type: 'number',
        stringValue: items.stringValue
      }));

    BooleanValue
      .from('stringValue').in(/^true$/i).or(/^false$/i).error(false)
      .select((items) => ({
        type: 'boolean',
        stringValue: items.stringValue.toLowerCase()
      }));

    NullValue
      .from('stringValue').in(/^null$/i).error(false)
      .select((items) => ({
        type: 'null',
        stringValue: items.stringValue.toLowerCase()
      }));

    Column
      .from('column').in(
        ParserGenerator('Column')
          .from('table').in(Table).error(false)
          .from('.').in('.').premise('table').error(false)
          .from('name').in(Identifier).premise('table').error(false)
          .select()
      )
      .or(
        ParserGenerator('Column')
          .from('name').in(Identifier).error(false)
          .select()
      )
      .select((items) => ({
        type: 'column',
        table: items.column.table,
        name: items.column.name
      }));

    UnaryExpression
      .from('expression')
        .in(StringValue)
        .or(NumberValue)
        .or(BooleanValue)
        .or(NullValue)
        .or(Column)
      .select((items) => Object.assign(items.expression, {toString}));

    Expression
      .from('expression').in(UnaryExpression).error(false)
      .select('expression');

    Identifier
      .from('identifier').in((items, tokenizer) => {
        if(!tokenizer.hasNext()) return null;
        const res = tokenizer.next();
        return res.kind === 'identifier' ? res.value : null;
      }).error(false)
      .where((items) => !ReservedWords.includes(items.identifier.toLowerCase()))
      .select((items) => items.identifier.toLowerCase());

    const parser = ParserGenerator('SQLParser')
      .from('statement')
        .in(User)
        .or(Users)
        .or(CreateUser)
        .or(DropUser)
        .or(Database)
        .or(Databases)
        .or(UseDatabase)
        .or(CreateDatabase)
        .or(DropDatabase)
        .or(Tables)
        .or(Columns)
        .or(CreateTable)
        .or(DropTable)
        .or(Select)
        .or(Insert)
      .from(';').in(';')
      .select('statement');

    parser.submodules = submodules;

    return parser;
  };

  return eval(
    '(ParserGenerator, ReservedWords) => {' +
    '  const submodules = {};' +
    `  ${declare}` +
    `  return (${define.toString()})();` +
    '};'
  );
})();

if(!this.window) module.exports = SQLParser;

const SQLDBDriver = (() => {
  'use strict';

  const SQLDBDriver = {
    execute(stmt, context) {
      switch(stmt.type) {
        case 'user':            return this.execute_user(stmt, context);
        case 'users':           return this.execute_users(stmt, context);
        case 'create_user':     return this.execute_create_user(stmt, context);
        case 'drop_user':       return this.execute_drop_user(stmt, context);
        case 'database':        return this.execute_database(stmt, context);
        case 'databases':       return this.execute_databases(stmt, context);
        case 'use_database':    return this.execute_use_database(stmt, context);
        case 'create_database': return this.execute_create_database(stmt, context);
        case 'drop_database':   return this.execute_drop_database(stmt, context);
        case 'tables':          return this.execute_tables(stmt, context);
        case 'columns':         return this.execute_columns(stmt, context);
        case 'create_table':    return this.execute_create_table(stmt, context);
        case 'drop_table':      return this.execute_drop_table(stmt, context);
        case 'main_query':      return this.execute_main_query(stmt, context);
        case 'insert':          return this.execute_insert(stmt, context);
        default: this.fatal();
      }
    },

    execute_user(stmt, context) {
      const {session:{username, dbs:{system}}} = context;
      const records = system.on('users').filter({username}).select(['username', 'default_database']);
      return {
        text: this.res_text(1, context),
        records
      };
    },

    execute_users(stmt, context) {
      this.hasPrivilege(context, 'select', 'system', 'users');
      const {session:{username, dbs:{system}}} = context;
      const records = system.on('users').order([{id: 1}]).select(['username', 'default_database']);
      return {
        text: this.res_text(records.length, context),
        records
      };
    },

    execute_create_user(stmt, context) {
      this.hasPrivilege(context, 'create_user');
      const {session:{id, dbs:{system}, processing, promise}} = context;
      const name = 'system.users';
      if(!promise) {
        if(processing.dml[name]) {
          this.error(`Can not lock table \'${name}\'`);
        }
        processing.dml[name] = id;
      }
      const {name:username} = stmt;
      if(system.on('users').has({username})) {
        delete processing.dml[name];
        this.error(`User \'${username}\' already exists`);
      }
      const uid = system.on('users').order([{id: -1}]).first().id;
      system.on('users').insert({id:uid, username, password: null, default_database: null});
      delete processing.dml[name];
      return {
        text: `User \'${username}\' created`
      };
    },

    execute_drop_user(stmt, context) {
      this.hasPrivilege(context, 'drop_user');
      const {session:{id, dbs:{system}, processing, promise}} = context;
      const name = 'system.users';
      if(!promise) {
        if(processing.dml[name]) {
          this.error(`Can not lock table \'${name}\'`);
        }
        processing.dml[name] = id;
      }
      const {name:username} = stmt;
      if(!system.on('users').has({username})) {
        delete processing.dml[name];
        this.error(`User \'${username}\' does not exist`);
      }
      system.on('users').remove({username});
      delete processing.dml[name];
      return {
        text: `User \'${username}\' removed`
      };
    },

    execute_database(stmt, context) {
      const {session:{db}} = context;
      return {
        text: this.res_text(1, context),
        records: [{database_name: db ? db.name : null}]
      };
    },

    execute_databases(stmt, context) {
      this.hasPrivilege(context, 'select', 'system', 'databases');
      const {session:{dbs:{system}}} = context;
      const res = system.on('databases').order([{database_name: 1}]).select(['database_name']);
      return {
        text: this.res_text(res.length, context),
        records: res
      };
    },

    execute_use_database(stmt, context) {
      const {name} = stmt;
      if(!this.hasDatabase(context, name)) {
        this.error(`Database \'${name}\' does not exist`);
      }
      this.hasPrivilege(context, 'use_database', name);
      const {session, session:{dbs, promise}} = context;
      if(!dbs[name]) this.error(`Database \'${name}\' does not exist`);
      const db = session.db = dbs[name];
      if(promise) session.transaction = db.createTransaction();
      return {
        text: 'Database changed'
      };
    },

    execute_create_database(stmt, context) {
      this.hasPrivilege(context, 'create_database');
      const {name} = stmt;
      const {session:{id, dbs, dbs:{system}, processing, promise}} = context;
      const db = this.createDatabase(name);
      const _name = 'system.databases';
      if(!promise) {
        if(processing.dml[_name]) {
          this.error(`Can not lock table \'${_name}\'`);
        }
        processing.dml[_name] = id;
      }
      if(dbs[name]) {
        delete processing.dml[_name];
        this.error(`Database \'${name}\' already exists`);
      }
      dbs[name] = db;
      system.on('databases').insert({database_name: name});
      delete processing.dml[_name];
      return {
        text: `Database \'${name}\' created`
      };
    },

    execute_drop_database(stmt, context) {
      const {name} = stmt;
      if(name === 'system') {
        this.error('Can not remove \'system\' database');
      }
      this.hasPrivilege(context, 'drop_database');
      const {session:{id, dbs, dbs:{system}, processing, promise}} = context;
      const _name = 'system.databases';
      if(!promise) {
        if(processing.dml[_name]) {
          this.error(`Can not lock table \'${_name}\'`);
        }
        processing.dml[_name] = id;
      }
      if(!dbs[name]) {
        delete processing.dml[_name];
        this.error(`Database \'${name}\' does not exist`);
      }
      system.on('databases').remove({database_name: name});
      delete dbs[name];
      delete processing.dml[_name];
      return {
        text: `Database \'${name}\' removed`
      };
    },

    execute_tables(stmt, context) {
      this.isConnected(context);
      const {session:{db, dbs:{system}}} = context;
      const database_name = db.name;
      this.hasPrivilege(context, 'select', database_name);
      const res = system.on('tables').filter({database_name}).order([{table_name: 1}]).select(['table_name']);
      return {
        text: this.res_text(res.length, context),
        records: res
      };
    },

    execute_columns(stmt, context) {
      this.isConnected(context);
      const {name:table_name} = stmt;
      const {session:{db, dbs:{system}}} = context;
      const database_name = db.name;
      if(!this.hasTable(context, database_name, table_name)) {
        this.error(`Table \'${table_name}\' does not exist`);
      }
      this.hasPrivilege(context, 'select', database_name);
      const res = system.on('columns').filter({database_name, table_name})
        .order([{column_id: 1}]).select(['column_name', 'data_type', 'column_id']);
      if(!res.length) {
        this.error(`Table \'${table_name}\' does not exist`);
      }
      return {
        text: this.res_text(res.length, context),
        records: res
      };
    },

    execute_create_table(stmt, context) {
      this.isConnected(context);
      const {session:{db, dbs:{system}, transaction}} = context;
      const database_name = db.name;
      if(database_name === 'system') {
        this.error('Can not create table in \'system\' database');
      }
      const {name, columnDefinitions} = stmt;
      const table_name = name;
      if(this.hasTable(context, database_name, table_name)) {
        this.error(`Table \'${table_name}\' already exists`);
      }
      this.hasPrivilege(context, 'create_table', database_name);
      const columns = [];
      for(let i=0; i<columnDefinitions.length; i++) {
        const {name, dataType} = columnDefinitions[i];
        columns.push({
          database_name,
          table_name,
          column_name: name,
          data_type: dataType ? dataType.dataType : null,
          column_id: i
        });
      }
      if(transaction === void 0) {
        if(!system.lock()) {
          this.error('Can not lock database \'system\'');
        }
        if(this.hasTable(context, database_name, table_name)) {
          this.error(`Table \'${table_name}\' already exists`);
        }
      }
      system.on('tables').insert({database_name, table_name});
      system.on('columns').insert(columns);
      if(transaction === void 0) system.unlock();
      return {
        text: `Table \'${table_name}\' created`
      };
    },

    execute_drop_table(stmt, context) {
      this.isConnected(context);
      const {session:{db, dbs:{system}, transaction}} = context;
      const database_name = db.name;
      if(database_name === 'system') {
        this.error('Can not drop table in \'system\' database');
      }
      const {name, columnDefinitions} = stmt;
      const table_name = name;
      if(!this.hasTable(context, database_name, table_name)) {
        this.error(`Table \'${table_name}\' does not exist`);
      }
      this.hasPrivilege(context, 'drop_table', database_name);
      if(transaction === void 0) {
        if(!system.lock()) {
          this.error('Can not lock database \'system\'');
        }
        if(!this.hasTable(context, database_name, table_name)) {
          this.error(`Table \'${table_name}\' does not exist`);
        }
      }
      system.on('tables').remove({database_name, table_name});
      system.on('columns').remove({database_name, table_name});
      if(transaction === void 0) system.unlock();
      return {
        text: `Table \'${table_name}\' removed`
      };
    },

    execute_main_query(stmt, context) {
      this.isConnected(context);
      const res = this.compile_query(stmt, context)().find();
      return {
        text: this.res_text(res.length, context),
        records: res
      };
    },

    execute_insert(stmt, context) {
      this.isConnected(context);
      const {session:{db, dbs:{system}, transaction, processing}} = context;
      const database_name = db.name;
      if(database_name === 'system') {
        this.error('Can not modify data in \'system\' database');
      }
      const {table:{name:table_name}, columns, itemsLists} = stmt;
      if(!this.hasTable(context, database_name, table_name)) {
        this.error(`Table \'${table_name}\' does not exist`);
      }
      const fieldList = this.createFieldList(context);
      fieldList.addAllTableColumns(table_name);
      const _columns = [];
      if(columns) {
        for(let {name} of columns) {
          _columns.push(fieldList.getColumn(name));
        }
        for(let column of fieldList.getAllColumns()) {
          if(!columns.includes(column)) {
            _columns.push(column);
          }
        }
      }
      else {
        Array.prototype.push.apply(_columns, fieldList.getAllColumns());
        for(let {expressionList:e} of itemsLists) {
          if(_columns.length < e.length) {
            this.error('Column count does not match value count');
          }
        }
      }
      const records = [];
      for(let {expressionList:e} of itemsLists) {
        let record = {};
        for(let i=0; i<_columns.length; i++) {
          record[_columns[i]] = e[i] ? this.compile_expr(context, e[i], fieldList)() : null;
        }
        records.push(record);
      }
      const count = (transaction || db).on(table_name).insert(records).count();
      return {
        text: `${count} ${count <= 1 ? 'row' : 'rows'} created`
      };
    },

    isConnected(context) {
      if(!context.session.db) this.error('No database selected');
    },

    hasDatabase(context, database_name) {
      const {session:{dbs:{system}}} = context;
      return system.on('databases').has({database_name});
    },

    hasTable(context, database_name, table_name) {
      const {session:{dbs:{system}}} = context;
      return system.on('tables').has({database_name, table_name});
    },

    hasPrivilege(context, priv_type, database_name, table_name) {
      const {session:{username, dbs:{system}}} = context;
      if(table_name) {
        const res = system.on('table_privileges').filter({username, database_name, table_name});
        if(res.has()) {
          if(!res.select([priv_type])) this.error('Privilege not granted');
        }
      }
      if(database_name) {
        const res = system.on('database_privileges').filter({username, database_name});
        if(res.has()) {
          if(!res.select([priv_type])) this.error('Privilege not granted');
        }
      }
      const res = system.on('global_privileges').filter({username});
      if(res.has()) {
        if(!res.select([priv_type])) this.error('Privilege not granted');
      }
      else {
        this.error('Privilege not granted');
      }
    },

    getTableName(table) {
      return table ? table.name : null;
    },

    fatal() {
      throw new Error('FatalError:');
    },

    error(str) {
      throw new Error(`SQLExecutionError: ${str}`);
    },

    res_text(count, context) {
      return `${count} ${count <= 1 ? 'row' : 'rows'} selected (finished in ${(new Date().getTime() - context.start_ms)/1000}s)`;
    }
  };

  return SQLDBDriver;
})();

if(!this.window) module.exports = SQLDBDriver;

const SessionDriver = (() => {
  'use strict';

  class SessionDriver {
    constructor(driver) {
      this.driver = driver;
    }

    execute(stmt, context) {
      const {driver} = this;
      const {session:{id, db, dbs:{system}, transaction, processing, config}} = context;
      switch(stmt.type) {
        case 'database':
        case 'databases':
        case 'use_database':
          return promise(() => driver.execute(stmt, context));
        case 'create_database':
        case 'drop_database':
          return system.lockFor(() => driver.execute(stmt, context));
        case 'tables':
        case 'columns':
        case 'create_table':
        case 'drop_table':
          driver.isConnected(context);
          const database_name = db.name;
          const {name:table_name} = stmt;
          const name = `${database_name}.${table_name}`;
          return lockFor(
            () => {
              if(processing.ddl[name] || processing.dml[name] || processing.query[name]) return false;
              processing.ddl[name] = id;
              return true;
            },
            () => delete processing.ddl[name],
            () => driver.execute(stmt, context),
            config
          );
        default: this.fatal();
      }
    }
  }

  const sleep = (ms) => new Promise((resolve) => setTimeout(() => resolve(), ms));

  const promise = (callback) => {
    return new Promise((resolve, reject) => {
      try {
        const res = callback();
        resolve(res);
      }
      catch(e) {
        reject(e);
      }
    });
  };

  const lockFor = (lock, unlock, callback, config) => {
    return new Promise(async (resolve, reject) => {
      try {
        while(true) {
          const {timeout_ms, timeslice_ms} = config;
          const start_ms = new Date().getTime();
          if(lock()) {
            const res = callback();
            unlock();
            resolve(res);
            return;
          }
          await sleep(timeslice_ms);
          if(timeout_ms <= new Date().getTime() - start_ms) {
            driver.error('Timeout');
            return;
          }
        }
      }
      catch(e) {
        unlock();
        reject(e);
      }
    });
  };

  return (...args) => new SessionDriver(...args);
})();

if(!this.window) module.exports = SessionDriver;

const QueryCompiler = (() => {
  'use strict';

  const QueryCompiler = {
    compile_query(stmt, context, fieldList) {
      const {type, selectBody:{fromItem, whereCondition, groupByElements, havingCondition, selectItems,
        distinct, orderByElements, rowCount}} = stmt;

      fieldList = this.createFieldList(context);

      const param = {};

      param.type = type;

      param.fromItems = this.prepareFromItems(context, fromItem, fieldList);

      param.where = whereCondition ? this.compile_expr(context, whereCondition, fieldList) : null;

      const groupby = param.groupby = groupByElements !== void 0;
      const grouping = param.grouping = groupby ? this.prepareGroupByElements(context, groupByElements, fieldList) : null;
      param.groupByColumns = groupby ? this.prepareGroupByColumns(fieldList) : null;

      param.having = havingCondition ? this.compile_expr(context, havingCondition, fieldList, true) : null;

      param.items = this.prepareSelectItems(context, selectItems, fieldList, groupby);

      param.distinct = distinct;
      param.distinctColumns = distinct ? this.prepareDistinctColumns(items) : null;

      const order = param.order = orderByElements ? this.prepareOrderByElements(items, fieldList) : null;
      param.orderByColumns = order ? this.prepareOrderByColumns(order) : null;

      param.limit = rowCount !== void 0 ? Number(rowCount) : null;

      return () => this.execute_query(context, param, fieldList);
    },

    execute_query(context, param, fieldList) {
      const {fromItems, where, groupby, grouping, groupByColumns, having, items,
        distinct, distinctColumns, order, orderByColumns, limit} = param;

      const {session} = context;
      const db = session.transaction || session.db;

      let query;

      query = db.on(fromItems[0].name);

      let count = 0;
      const collect = function(record) {
        if(groupby || distinct) {
          if(count === limit) return this.EXIT;
          count++;
        }
        const _record = {};
        for(let i=0; i<items.length; i++) {
          let item = items[i];
          _record[item.name] = distinct ? record[distinctColumns[i]] : item.expr(record);
        }
        record._items = _record;
        if(order) {
          for(let i=0; i<order.length; i++) {
            _record[orderByColumns[i]] = order[i].expr(record);
          }
        }
        return _record;
      };

      query = query.map(function(record) {
        if(!(groupby || distinct)) {
          if(count === limit) return this.EXIT;
        }
        const _record = fromItems.length === 1 ? {[fromItems[0].alias]: record} : record;
        if(where) {
          if(!where(_record)) return null;
        }
        if(groupby) {
          for(let i=0; i<groupByColumns.length; i++) {
            _record[groupByColumns[i]] = grouping[i].expr(_record);
          }
        }
        if(!(groupby || distinct)) {
          count++;
        }
        return (groupby || distinct) ? _record : collect.call(this, _record);
      });

      query = groupby ? query.group(groupByColumns).map(function(record) {
        return !having || having(record) ? distinct ? record : collect.call(this, record) : null;
      }) : query;

      query = distinct ? query.map((record) => {
        const _record = {};
        for(let i=0; i<items.length; i++) {
          const item = items[i];
          _record[item.name] = _record[distinctColumns[i]] = item.expr(record);
        }
        return _record;
      }).group(distinctColumns).map(function(record) {
        return collect.call(this, record);
      }) : query;

      query = order ? query.order(orderByColumns).each((record) => {
        for(let i=0; i<orderByColumns.length; i++) {
          delete record[orderByColumns[i]];
        }
      }) : query;

      return query;
    },

    prepareFromItems(context, fromItem, fieldList) {
      const {session:{db}} = context;
      const {table, alias} = fromItem;
      const name = table.name;
      const fromItems = [];
      if(!this.hasTable(context, db.name, name)) {
        this.error(`Table \'${name}\' does not exist`);
      }
      fieldList.addAllTableColumns(name, alias);
      fromItems.push({
        name,
        alias: alias || name
      });
      return fromItems;
    },

    prepareGroupByElements(context, groupByElements, fieldList) {
      const grouping = [];
      for(let {expression:e} of groupByElements) {
        grouping.push({
          expr: this.compile_expr(context, e, fieldList),
          table_name: e.type === 'column' ? this.getTableName(e.table) : null,
          column_name: e.type === 'column' ? e.name : null
        });
      }
      fieldList.addGroupingColumns(grouping);
      return grouing;
    },

    prepareGroupByColumns(fieldList) {
      const groupByColumns = [];
      for(let {column_id} of fieldList.getAllGroupingColumns()) groupByColumns.push(column_id);
      return groupByColumns;
    },

    prepareSelectItems(context, selectItems, fieldList, groupby) {
      if(!groupby) {
        for(let selectItem of selectItems) {
          if(selectItem.type === 'select_expression_item') {
            if(this.hasAggregateFunction(selectItem.expression)) {
              fieldList.addDummyGroupingColumns();
              groupby = true;
              break;
            }
          }
        }
      }
      const items = [];
      const names = [];
      for(let selectItem of selectItems) {
        const {type, table, expression, alias} = selectItem;
        switch(type) {
          case 'all_columns':
          case 'all_table_columns':
            const columns = groupby ? type === 'all_columns' ? fieldList.getAllGroupingColumns()
              : fieldList.getAllGroupingTableColumns(table.name)
              : type === 'all_columns' ? fieldList.getAllColumns()
              : fieldList.getAllTableColumns(table.name);
            for(let column of columns) {
              const {table_name, column_name} = column;
              const name = column_name;
              if(names.includes(name)) {
                this.error(`Duplicate column name \'${name}\'`);
              }
              names.push(name);
              items.push({
                name,
                expr: this.column_expr(context, {table: {name: table_name}, name: column_name}, fieldList, groupby)
              });
            }
            break;
          case 'select_expression_item':
            const name = alias || expression.toString();
            if(names.includes(name)) {
              this.error(`Duplicate column name \'${name}\'`);
            }
            names.push(name);
            items.push({
              name,
              expr: this.compile_expr(context, expression, fieldList, groupby)
            });
            break;
          default:
            this.fatal();
        }
      }
      fieldList.addSelectItems(items);
      return items;
    },

    hasAggregateFunction() {
    },

    typeOf(o) {
      return Object.prototype.toString.call(o).slice(8, -1);
    },

    isFunction(o) {
      return this.typeOf(o) === 'Function';
    }
  };

  return QueryCompiler;
})();

if(!this.window) module.exports = QueryCompiler;

const ExpressionCompiler = (() => {
  'use strict';

  const ExpressionCompiler = {
    compile_expr(...args) {
      const expr = this.expr(...args);
      return this.isFunction(expr) ? expr : () => expr;
    },

    expr(...args) {
      const [context, expression, fieldList, groupby] = args;
      const e = expression;
      switch(e.type) {
        case 'string':  return e.stringValue;
        case 'number':  return Number(e.stringValue);
        case 'boolean': return e.stringValue === 'true';
        case 'null':    return null;
        case 'column':  return this.column_expr(...args);
        default: this.fatal();
      }
    },

    column_expr(...args) {
      const [context, expression, fieldList, groupby] = args;
      const {table, name} = expression;
      const {table_name, column_id} = fieldList[groupby ? 'getGroupingColumn' : 'getColumn'](name, this.getTableName(table));
      const column_name = groupby ? column_id : name;
      return groupby ? (record) => (record ? record[column_name] : null)
        : (record) => (record && record[table_name] ? record[table_name][column_name] : null);
    }
  };

  return ExpressionCompiler;
})();

if(!this.window) module.exports = ExpressionCompiler;

const FieldList = (() => {
  'use strict';

  class FieldList {
    constructor(context) {
      const {session:{db, dbs:{system}}, driver} = context;
      this.system = system;
      this.db = db;
      this.driver = driver;
      this.columns = [];
      this.groupingColumns = [];
    }

    addAllTableColumns(name, alias) {
      const {system, db, columns} = this;
      const database_name = db.name;
      const table_name = name;
      const _columns = system.on('columns').filter({database_name, table_name}).order([{column_id:1}]).find();
      for(let {column_name, column_id} of _columns) {
        columns.push({
          table_name: alias || name,
          column_name,
          column_id
        });
      }
    }

    addGroupingColummns(grouping) {
      const {groupingColumns} = this;
      for(let i=0; i<grouping.length; i++) {
        const {table_name, column_name} = grouping[i];
        groupingColumns.push({
          table_name,
          column_name,
          column_id: `_g${i}`,
        });
      }
    }

    addDummyGroupingColumns() {
      this.groupingColumns.push({dummy: true});
    }

    addSelectItems(items) {
      const {columns} = this;
      for(let i=0; i<items.length; i++) {
        const {name:column_name} = items[i];
        columns.push({
          table_name: '_m',
          column_name,
          column_id: i
        });
      }
    }

    getColumn(...args) {
      return this._getColumn(this.columns, ...args);
    }

    getGroupingColumn(...args) {
      return this._getColumn(this.groupingColumns, ...args);
    }

    getAllColumns() {
      return this._getColumns(this.columns);
    }

    getAllGroupingColumns() {
      return this._getColumns(this.groupingColumns);
    }

    getAllTableColumns(...args) {
      return this._getColumns(this.columns, ...args);
    }

    getAllGroupingTableColumns(...args) {
      return this._getColumns(this.groupingColumns, ...args);
    }

    _getColumn(columns, ...args) {
      const [column_name, table_name] = args;
      const {driver} = this;
      const res = [];
      for(let column of columns) {
        if(!column.dummy && column.column_name === column_name && (!table_name || column.table_name === table_name)) {
          res.push(column);
        }
      }
      const name = (table_name, column_name) => (table_name ? `\'${table_name}\'.` : '') + `\'${column_name}\'`;
      if(res.length === 0) {
        driver.error(`Column ${name(table_name, column_name)} does not exist in field list`);
      }
      if(1 < res.length) {
        for(let column of res) {
          if(column.table_name === '_m') return column;
        }
        driver.error(`Ambiguous column name \'${name(table_name, column_name)}\'`);
      }
      return res[0];
    }

    _getColumns(columns, ...args) {
      const [table_name] = args;
      const {driver} = this;
      const res = [];
      for(let column of columns) {
        if(!column.dummy && (!table_name || column.table_name === table_name)) {
          res.push(column);
        }
      }
      res.sort((a, b) => {
        if(a.table_name < b.table_name)      return -1;
        else if(b.table_name < a.table_name) return 1;
        else if(a.column_id < b.column_id)   return -1;
        else if(a.column_id < b.column_id)   return 1;
        return 0;
      });
      if(table_name && res.length === 0) {
        driver.error(`Unknown table \'${table_name}\'`);
      }
      return res;
    }
  }

  return (context) => new FieldList(context);
})();

if(!this.window) module.exports = FieldList;

const Database = (() => {
  'use strict';

  class Database {
    constructor(name) {
      this.name = name;
      this.config = {timeout_ms: 60000, timeslice_ms: 500};
      this._collections = {};
      this._locked = false;
    }

    lock() {
      return lock(this);
    }

    unlock() {
      return unlock(this);
    }

    lockFor(callback) {
      return lockFor(this, callback, this.config);
    }

    has(name) {
      return this._collections[name] !== void 0;
    }

    createCollection(name) {
      return this._collections[name] = new Collection(this, name);
    }

    dropCollection(name) {
      if(this.has(name)) {
        delete this._collections[name];
        return true;
      }
      return false;
    }

    on(name) {
      return this.has(name) ? this._collections[name] : this.createCollection(name);
    }

    createTransaction() {
      return new Transaction(this);
    }
  }

  class Collection {
    constructor(db, name) {
      this.db = db;
      this.config = db.config;
      this.name = name;
      this.root = this;
      this._records = [];
      this._locked = false;
      this._xid = 0;
    }

    lock() {
      return lock(this);
    }

    unlock() {
      return unlock(this);
    }

    lockFor(callback) {
      return lockFor(this, callback, this.config);
    }

    rename(name) {
      const {db, name:_name} = this;
      this.name = name;
      db.dropCollection(_name);
      return db._collections[name] = this;
    }

    insert(records) {
      records = isArray(records) ? records : [records];
      const res = [];
      this._xid++;
      const {_xid, _records} = this;
      for(let record of records) {
        record._xmin = _xid;
        res.push(record);
      }
      Array.prototype.push.apply(_records, res);
      return new Query(this, res, _xid);
    }

    remove(filter, hard) {
      return this.filter(filter)._remove(hard);
    }

    _removeCommit() {
      const {_records} = this;
      for(let i=_records.length-1; 0<=i; i--) {
        if(_records[i]._d) _records.splice(i, 1);
      }
    }

    update(changes, hard) {
      return this.filter()._update(changes, hard);
    }

    filter(filter) {
      const {root, _records, _xid} = this;
      return new Query(root, _filter(_records, filter, _xid), _xid);
    }

    find(filter) {
      return this.filter(filter)._find();
    }

    first(filter) {
      const records = this.find(filter);
      return records.length ? records[0] : null;
    }

    last(filter) {
      const records = this.find(filter);
      return records.length ? records[records.length - 1] : null;
    }

    count(filter) {
      return this.filter(filter)._records.length;
    }

    has(filter) {
      return 0 < this.count(filter);
    }

    select(columns) {
      const records = this.find();
      const res = [];
      for(let record of records) {
        const _record = {};
        for(let column of columns) _record[column] = record[column];
        res.push(_record);
      }
      return res;
    }

    limit(num) {
      return this._query(this.find().slice(0, num));
    }

    each(callback) {
      const records = this.find();
      const dummy = {EXIT: {}, callback};
      for(let record of records) {
        if(dummy.callback(record) === dummy.EXIT) break;
      }
      return this;
    }

    map(callback) {
      const records = this.find();
      const dummy = {EXIT: {}, callback};
      const res = [];
      for(let record of records) {
        if((record = dummy.callback(record)) === dummy.EXIT) break;
        if(isObject(record)) res.push(record);
      }
      return this._query(res);
    }

    order(columns) {
      const _columns = [];
      for(let column of columns) {
        const p = Object.keys(column)[0];
        if(p) _columns.push({p, dir: column[p]});
      }
      const records = this.find();
      const _records = records.sort((a, b) => {
        let res = 0;
        for(let {p, dir} of _columns) {
          if(a[p] < b[p]) res = -1;
          else if(b[p] < a[p]) res = 1;
          else continue;
          dir === 1 ? res : dir === -1 ? -res : 0;
          break;
        }
        return res;
      });
      return this._query(_records);
    }

    group(columns, callback) {
      const records = this.find();
      const res = [];
      for(let record of records) {
        let dup = false;
        for(let _record of res) {
          dup = true;
          for(let column of columns) {
            if(record[column] !== _record[column]) {
              dup = false;
              break;
            }
          }
        }
        if(dup) {
          _record._group.push(record);
          if(isFunction(callback)) callback(_record, record);
          break;
        }
      }
      if(!dup) {
        const record_ = {};
        res.push(record_);
        record_._group = [record];
        for(let column of columns) record_[column] = record[column];
        if(isFunction(callback)) callback(record_, record);
      }
      return this._query(res);
    }

    _query(records) {
      return new Query(this.root, records, this._xid);
    }
  }

  class Query {
    constructor(root, records, xid) {
      this.root = root;
      this._records = records;
      this._xid = xid;
    }

    _remove(hard) {
      const {root, _records} = this;
      if(hard) {
        for(let record of _records) record._d = true;
        root._removeCommit();
      }
      else {
        const {_xid} = root;
        root._xid++;
        for(let record of _records) record._xmax = _xid;
      }
      return _records.length;
    }

    _update(changes, hard) {
      const {root, _records} = this;
      if(hard) {
        for(let record of _records) {
          for(let p in changes) record[p] = changes[p];
        }
        return this._query(_records);
      }
      else {
        const records = [];
        const {_xid} = root;
        for(let record of _records) {
          record._xmax = xid;
          const _record = {...record};
          for(let p in changes) _record[p] = changes[p];
          records.push(_record);
        }
        return root.insert(records);
      }
    }

    _find() {
      return this._records;
    }

    find() {
      return this._find();
    }
  }

  const ofCollection = [
    'remove',
    'update',
    'filter',
    'first',
    'last',
    'count',
    'has',
    'select',
    'limit',
    'each',
    'map',
    'order',
    '_query'
  ];

  for(let p of ofCollection) Query.prototype[p] = Collection.prototype[p];

  class Transaction {
    constructor(db) {
      this.db = db;
      this.config = db.config;
      this._caches = {};
      this._locked = false;
    }

    lock() {
      return lock(this);
    }

    unlock() {
      return unlock(this);
    }

    lockFor(callback) {
      return lockFor(this, callback, this.config);
    }

    commit() {
      return new Promise(async (resolve, reject) => {
        try {
          const {config:{timeout_ms, timeslice_ms}, _caches} = this;
          const start_ms = new Date().getTime();
          while(true) {
            if(!this._locked) {
              this._locked = true;
              break;
            }
            await sleep(timeout_ms);
            if(timeout_ms <= new Date().getTime() - start_ms) {
              reject();
              return;
            }
          }
          const caches = Object.keys(_caches).map((p) => _caches[p]);
          let caches_ = caches;
          while(true) {
            const _caches = [];
            for(let cache of caches_) {
              if(!cache.lock()) _caches.push(cache);
            }
            if(_caches.length) {
              await sleep(timeslice_ms);
              caches_ = _caches;
            }
            else {
              break;
            }
            if(timeout_ms <= new Date().getTime() - start_ms) {
              for(cache of caches_) {
                cache.unlock();
                reject();
                return;
              }
            }
          }
          for(let cache of caches) {
            cache._commit();
            cache.unlock();
          }
          this._locked = false;
          resolve();
        }
        catch(e) {
          reject(e);
        }
      });
    }

    rollback() {
      return this.lockFor(() => {
        this.caches = {};
      });
    }

    on(name) {
      return this._caches[name] = new Cache(this, this.db.on(name));
    }
  }

  class Cache {
    constructor(transaction, collection) {
      this.transaction = transaction;
      this.collection = collection;
      this.config = transaction.config;
      this.root = this;
      this._records = {_in: [], _out: []};
      this._locked = false;
    }

    lock() {
      const {collection} = this;
      if(collection.lock()) {
        if(!this._locked) {
          this._locked = true;
          return true;
        }
        collection.unlock();
      }
      return false;
    }

    unlock() {
      if(this._locked) {
        this._locked = false;
        return this.collection.unlock();
      }
      return false;
    }

    lockFor(callback) {
      return lockFor(this, callback, this.config);
    }

    _commit() {
      const {collection, _records:{_in, _out}} = this;
      const {_xid} = collection;
      collection._xid++;
      collection.insert(_in);
      for(let record of _out) record._xmax = _xid;
      this._records = {_in: [], _out: []};
    }

    insert(records) {
      records = isArray(records) ? records : [records];
      const res = [];
      const {_records:{_in}} = this;
      for(let record of records) {
        if(isObject(record)) res.push(record);
      }
      Array.prototype.push.apply(_in, res);
      return this._query(res);
    }

    remove(filter) {
      return this.filter(filter)._remove();
    }

    update(changes) {
      return this.filter()._update(changes);
    }

    filter(filter) {
      const {collection:{_xid}} = this;
      return new CacheQuery(this, this._filter(filter, _xid), _xid);
    }

    _filter(filter, _xid) {
      const {collection:{_records}, _records:{_in, _out}} = this;
      const res = _records.slice();
      Array.prototype.push.apply(res, _in);
      const _res = [];
      for(let record of res) {
        if(!_out.includes(record)) _res.push(record);
      }
      return _filter(_res, filter, _xid);
    }

    find(filter) {
      return this.filter(filter)._find();
    }

    _query(records) {
      return new CacheQuery(this, records, this.collection._xid);
    }
  }

  class CacheQuery {
    constructor(root, records, xid) {
      this.root = root;
      this._records = records;
      this._xid = xid;
    }

    _remove() {
      const {root:{_records:{_out}}, _records} = this;
      Array.prototype.push.apply(_out, _records);
      return _records.length;
    }

    _update(changes) {
      const {root:{_records:{_in, _out}}, _records} = this;
      const out_ = _records.slice();
      const in_ = [];
      for(let record of _records) {
        out_.push(record);
        const _record = Object.assign({}, record);
        for(let p in changes) _record[p] = changes[p];
        in_.push(_record);
      }
      Array.prototype.push.apply(_out, out_);
      Array.prototype.push.apply(_in, in_);
      return this._query(in_);
    }
  }

  const _ofCollection = [
    'first',
    'last',
    'count',
    'has',
    'select',
    'limit',
    'each',
    'map',
    'order'
  ];

  for(let p of _ofCollection) Cache.prototype[p] = CacheQuery.prototype[p] = Collection.prototype[p];

  const ofCache = [
    'remove',
    'update',
  ];

  for(let p of ofCache) CacheQuery.prototype[p] = Cache.prototype[p];

  const lock = (o) => {
    if(!o._locked) {
      o._locked = true;
      return true;
    }
    return false;
  };

  const unlock = (o) => {
    if(o._locked) {
      o._locked = false;
      return true;
    }
    return false;
  };

  const lockFor = (o, callback, config) => {
    return new Promise(async (resolve, reject) => {
      try {
        const {timeout_ms, timeslice_ms} = config;
        const start_ms = new Date().getTime();
        while(true) {
          if(o.lock()) {
            const res = callback();
            o.unlock();
            resolve(res);
            return;
          }
          await sleep(timeslice_ms);
          if(timeout_ms < new Date().getTime() - start_ms) break;
        }
        reject();
      }
      catch(e) {
        o.unlock();
        reject(e);
      }
    });
  };

  const sleep = (ms) => new Promise((resolve) => setTimeout(() => resolve(), ms));

  const typeOf = (o) => Object.prototype.toString.call(o).slice(8, -1);

  const isArray = (o) => typeOf(o) === 'Array';

  const isObject = (o) => typeOf(o) === 'Object';

  const isFunction = (o) => typeOf(o) === 'Function';

  const _filter = (_records, filter, _xid) => {
    const res = [];
    for(let record of _records) {
      let r = true;
      if(_xid < record._xmin || record._xmax < _xid) continue;
      if(isObject(filter)) {
        for(let p in filter) {
          if(record[p] !== filter[p]) {
            r = false;
            break;
          }
        }
      }
      else if(isFunction(filter)) {
        r = filter(record);
      }
      if(r) res.push(record);
    }
    return res;
  };

  return (name) => new Database(name);
})();

if(!this.window) module.exports = Database;

const SQLDB = (() => {
  'use strict';

  class SQLDB {
    constructor(components) {

      const {Source, StringDelimiter, RegExpDelimiter, QuoteDelimiter, MultiDelimiter, Tokenizer, BufferedTokenizer,
        ParserGenerator, SQLTokenizerFactory, SQLReservedWords, SQLParser, Database,
        SQLDBDriver, SessionDriver, QueryCompiler, ExpressionCompiler, FieldList} = components;

      const factory = SQLTokenizerFactory({
        Source, StringDelimiter, RegExpDelimiter, QuoteDelimiter, MultiDelimiter, Tokenizer, BufferedTokenizer
      });

      const parser = SQLParser(ParserGenerator, SQLReservedWords);

      const dbs = {};

      const system = Database('system');
      init(system);
      dbs.system = system;

      const env = typeof window === undefined ? 'node' : 'window';

      const processing = {ddl:{}, dml:{}, query:{}};

      const config = {timeout_ms: 60000, timeslice_ms: 500};

      let sid = 0;
      const sessions = [];

      const root = system.on('users').first({username: 'root'});

      const session = {
        id: sid++,
        username: root.username,
        db: dbs[root.default_database] || null,
        dbs,
        env,
        sessions,
        processing,
        config
      };

      sessions.push(session);

      const createDatabase = (name) => Database(name);
      const createFieldList = (context) => FieldList(context);

      const driver = {};
      Object.assign(driver, SQLDBDriver);
      Object.assign(driver, QueryCompiler);
      Object.assign(driver, ExpressionCompiler);
      driver.createDatabase = createDatabase;
      driver.createFieldList = createFieldList;

      const sessionDriver = SessionDriver(driver);

      const prepare = (context, str) => {
        if(typeof str !== 'string' || str === '') throw new Error('Invalid argument');
        const debugging = context.debugging = this.debugging;
        if(debugging) this.debug(context, 'execute: start');
        const start_ms = context.start_ms = new Date().getTime();
        const tokenizer = factory.createTokenizer(str);
        const stmt = parser.parse(tokenizer, {}, debugging);
        if(debugging) this.debug(context, `execute: parser.parse: finished in ${(new Date().getTime() - start_ms)/1000}s`);
        return stmt;
      };

      this.execute = (str) => {
        const context = {session, driver};
        const stmt = prepare(context, str);
        return driver.execute(stmt, context);
      };

      this.createSession = (username='root', password) => {
        if(typeof username !== 'string' || username === ''
        || !(typeof password === 'string' || password === void 0) || password === '') {
          throw new Error('Invalid argument');
        }
        password = password || null;
        const user = system.on('users').first({username, password});
        if(!user) SQLDBDriver.error(`Access denied for user \'${username}\'`);
        const db = dbs[user.default_database] || null;
        const session = {
          id: sid++,
          username: user.username,
          db,
          dbs,
          env,
          sessions,
          processing,
          config,
          transaction: db ? db.createTransaction() : null,
          promise: true
        };
        sessions.push(session);
        return new Session(session);
      };

      class Session {
        constructor(session) {
          this.execute = (str) => {
            if(typeof str !== 'string' || str === '') throw new Error('Invalid argument');
            const context = {session, driver};
            const stmt = prepare(context, str);
            return sessionDriver.execute(stmt, context);
          };
        }
      }

      this.debugging = false;
    }

    debug(context, str) {
      const {session:{id}} = context;
      console.log(`DEBUG:sid=${id}:SQLDB.${str}`);
    }
  }

  const init = (system) => {
    system.createCollection('tables');
    system.on('tables').insert([
      {database_name: 'system', table_name: 'users'},
      {database_name: 'system', table_name: 'global_privileges'},
      {database_name: 'system', table_name: 'database_privileges'},
      {database_name: 'system', table_name: 'table_privileges'},
      {database_name: 'system', table_name: 'databases'},
      {database_name: 'system', table_name: 'tables'},
      {database_name: 'system', table_name: 'columns'}
    ]);

    system.createCollection('columns');
    system.on('columns').insert([
      {database_name: 'system', table_name: 'users', column_name: 'id',               data_type: 'number', column_id: 0},
      {database_name: 'system', table_name: 'users', column_name: 'username',         data_type: 'string', column_id: 1},
      {database_name: 'system', table_name: 'users', column_name: 'password',         data_type: 'string', column_id: 2},
      {database_name: 'system', table_name: 'users', column_name: 'default_database', data_type: 'string', column_id: 3}
    ]);
    system.on('columns').insert([
      {database_name: 'system', table_name: 'global_privileges', column_name: 'username',        data_type: 'string',  column_id: 0},
      {database_name: 'system', table_name: 'global_privileges', column_name: 'create_user',     data_type: 'boolean', column_id: 1},
      {database_name: 'system', table_name: 'global_privileges', column_name: 'grant',           data_type: 'boolean', column_id: 2},
      {database_name: 'system', table_name: 'global_privileges', column_name: 'create_database', data_type: 'boolean', column_id: 3},
      {database_name: 'system', table_name: 'global_privileges', column_name: 'drop_database',   data_type: 'boolean', column_id: 4},
      {database_name: 'system', table_name: 'global_privileges', column_name: 'use_database',    data_type: 'boolean', column_id: 5},
      {database_name: 'system', table_name: 'global_privileges', column_name: 'create_table',    data_type: 'boolean', column_id: 6},
      {database_name: 'system', table_name: 'global_privileges', column_name: 'drop_table',      data_type: 'boolean', column_id: 7},
      {database_name: 'system', table_name: 'global_privileges', column_name: 'alter_table',     data_type: 'boolean', column_id: 8},
      {database_name: 'system', table_name: 'global_privileges', column_name: 'insert',          data_type: 'boolean', column_id: 9},
      {database_name: 'system', table_name: 'global_privileges', column_name: 'update',          data_type: 'boolean', column_id: 10},
      {database_name: 'system', table_name: 'global_privileges', column_name: 'delete',          data_type: 'boolean', column_id: 11},
      {database_name: 'system', table_name: 'global_privileges', column_name: 'select',          data_type: 'boolean', column_id: 12},
      {database_name: 'system', table_name: 'global_privileges', column_name: 'lock_table',      data_type: 'boolean', column_id: 13},
      {database_name: 'system', table_name: 'global_privileges', column_name: 'shutdown',        data_type: 'boolean', column_id: 14}
    ]);
    system.on('columns').insert([
      {database_name: 'system', table_name: 'database_privileges', column_name: 'username',      data_type: 'string',  column_id: 0},
      {database_name: 'system', table_name: 'database_privileges', column_name: 'database_name', data_type: 'string',  column_id: 1},
      {database_name: 'system', table_name: 'database_privileges', column_name: 'use_database',  data_type: 'boolean', column_id: 2},
      {database_name: 'system', table_name: 'database_privileges', column_name: 'create_table',  data_type: 'boolean', column_id: 3},
      {database_name: 'system', table_name: 'database_privileges', column_name: 'drop_table',    data_type: 'boolean', column_id: 4},
      {database_name: 'system', table_name: 'database_privileges', column_name: 'alter_table',   data_type: 'boolean', column_id: 5},
      {database_name: 'system', table_name: 'database_privileges', column_name: 'insert',        data_type: 'boolean', column_id: 6},
      {database_name: 'system', table_name: 'database_privileges', column_name: 'update',        data_type: 'boolean', column_id: 7},
      {database_name: 'system', table_name: 'database_privileges', column_name: 'delete',        data_type: 'boolean', column_id: 8},
      {database_name: 'system', table_name: 'database_privileges', column_name: 'select',        data_type: 'boolean', column_id: 9},
      {database_name: 'system', table_name: 'database_privileges', column_name: 'lock_table',    data_type: 'boolean', column_id: 10}
    ]);
    system.on('columns').insert([
      {database_name: 'system', table_name: 'table_privileges', column_name: 'username',      data_type: 'string',  column_id: 0},
      {database_name: 'system', table_name: 'table_privileges', column_name: 'database_name', data_type: 'string',  column_id: 1},
      {database_name: 'system', table_name: 'table_privileges', column_name: 'table_name',    data_type: 'string',  column_id: 2},
      {database_name: 'system', table_name: 'table_privileges', column_name: 'insert',        data_type: 'boolean', column_id: 3},
      {database_name: 'system', table_name: 'table_privileges', column_name: 'update',        data_type: 'boolean', column_id: 4},
      {database_name: 'system', table_name: 'table_privileges', column_name: 'delete',        data_type: 'boolean', column_id: 5},
      {database_name: 'system', table_name: 'table_privileges', column_name: 'select',        data_type: 'boolean', column_id: 6},
      {database_name: 'system', table_name: 'table_privileges', column_name: 'lock_table',    data_type: 'boolean', column_id: 7}
    ]);
    system.on('columns').insert([
      {database_name: 'system', table_name: 'databases', column_name: 'database_name', data_type: 'string', column_id: 0}
    ]);
    system.on('columns').insert([
      {database_name: 'system', table_name: 'tables', column_name: 'database_name', data_type: 'string', column_id: 0},
      {database_name: 'system', table_name: 'tables', column_name: 'table_name',    data_type: 'string', column_id: 1}
    ]);
    system.on('columns').insert([
      {database_name: 'system', table_name: 'columns', column_name: 'database_name', data_type: 'string', column_id: 0},
      {database_name: 'system', table_name: 'columns', column_name: 'table_name',    data_type: 'string', column_id: 1},
      {database_name: 'system', table_name: 'columns', column_name: 'column_name',   data_type: 'string', column_id: 2},
      {database_name: 'system', table_name: 'columns', column_name: 'data_type',     data_type: 'string', column_id: 3},
      {database_name: 'system', table_name: 'columns', column_name: 'column_id',     data_type: 'number', column_id: 4}
    ]);

    system.createCollection('users');
    system.on('users').insert({id: 0, username: 'root', password: null, default_database: null});

    system.createCollection('global_privileges');
    system.on('global_privileges').insert({
      username: 'root',
      create_user: true,
      grant: true,
      create_database: true,
      drop_database: true,
      use_database: true,
      create_table: true,
      drop_table: true,
      alter_table: true,
      insert: true,
      update: true,
      delete: true,
      select: true,
      lock_table: true,
      shutdown: true
    });

    system.createCollection('database_privileges');
    system.createCollection('table_privileges');

    system.createCollection('databases');
    system.on('databases').insert({database_name: 'system'});
  }

  return (...args) => new SQLDB(...args);
})();

if(!this.window) module.exports = SQLDB;
