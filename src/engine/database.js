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
