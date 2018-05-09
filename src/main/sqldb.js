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
