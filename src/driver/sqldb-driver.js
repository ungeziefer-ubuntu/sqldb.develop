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
