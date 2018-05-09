const {equal, expectError} = require('./lib/test');
const {Source, StringDelimiter, RegExpDelimiter, QuoteDelimiter, MultiDelimiter,
  Tokenizer, BufferedTokenizer, ParserGenerator, SQLTokenizerFactory, SQLReservedWords, SQLParser,
  Database, SQLDBDriver, SessionDriver, QueryCompiler, ExpressionCompiler, FieldList, SQLDB} = require('./require');

const init = () => {
  return SQLDB({
    Source, StringDelimiter, RegExpDelimiter, QuoteDelimiter, MultiDelimiter, Tokenizer, BufferedTokenizer,
    ParserGenerator, SQLTokenizerFactory, SQLReservedWords, SQLParser, Database,
    SQLDBDriver, SessionDriver, QueryCompiler, ExpressionCompiler, FieldList
  });
};

let db, res;

// test invalid argument error
db = init();
expectError(db.execute.bind(db), new Error('Invalid argument'));

// test invalid argument error
db = init();
expectError(db.execute.bind(db, 1234), new Error('Invalid argument'));

// test invalid argument error
db = init();
expectError(db.execute.bind(db, ''), new Error('Invalid argument'));

// test User statement
db = init();
res = db.execute('user;');
equal(res.text.indexOf('1 row selected') === 0, true);
equal(res.records, [{username: 'root', default_database: null}]);

// test Users statement
db = init();
res = db.execute('users;');
equal(res.text.indexOf('1 row selected') === 0, true);
equal(res.records, [{username: 'root', default_database: null}]);

// test Create User statement
db = init();
res = db.execute('create user test_user;');
equal(res.text, 'User \'test_user\' created');
res = db.execute('users;');
equal(res.text.indexOf('2 rows selected') === 0, true);
equal(res.records, [
  {username: 'root', default_database: null},
  {username: 'test_user', default_database: null}
]);

// test Drop User statement
db = init();
db.execute('create user test_user;');
res = db.execute('drop user test_user;');
equal(res.text, 'User \'test_user\' removed');
res = db.execute('users;');
equal(res.records, [{username: 'root', default_database: null}]);

// test Database statement
db = init();
res = db.execute('database;');
equal(res.text.indexOf('1 row selected') === 0, true);
equal(res.records, [{database_name: null}]);

// test Databases statement
db = init();
res = db.execute('databases;');
equal(res.text.indexOf('1 row selected') === 0, true);
equal(res.records, [{database_name: 'system'}]);

// test Use statement
db = init();
res = db.execute('use system;');
equal(res.text, 'Database changed');
res = db.execute('database;');
equal(res.records, [{database_name: 'system'}]);

// test SQLExecutionError in Use statement
db = init();
expectError(db.execute.bind(db, 'use abcd;'), new Error('SQLExecutionError: Database \'abcd\' does not exist'));

// test Create Database statement
db = init();
res = db.execute('create database abcd;');
equal(res.text, 'Database \'abcd\' created');
res = db.execute('databases;');
equal(res.records, [
  {database_name: 'abcd'},
  {database_name: 'system'}
]);
db.execute('use abcd;');
res = db.execute('database;');
equal(res.records, [{database_name: 'abcd'}]);

// test SQLExecutionError in Create Database statement
db = init();
db.execute('create database abcd;');
expectError(db.execute.bind(db, 'create database abcd;'), new Error('SQLExecutionError: Database \'abcd\' already exists'));

// test Drop Database statement
db = init();
db.execute('create database abcd;');
res = db.execute('drop database abcd;');
equal(res.text, 'Database \'abcd\' removed');
res = db.execute('databases;');
equal(res.records, [{database_name: 'system'}]);

// test SQLExecutionError in Drop Database statement
db = init();
expectError(db.execute.bind(db, 'drop database abcd;'), new Error('SQLExecutionError: Database \'abcd\' does not exist'));

// test Tables statement
db = init();
db.execute('use system;');
res = db.execute('tables;');
equal(res.text.indexOf('7 rows selected') === 0, true);
equal(res.records, [
  {table_name: 'columns'},
  {table_name: 'database_privileges'},
  {table_name: 'databases'},
  {table_name: 'global_privileges'},
  {table_name: 'table_privileges'},
  {table_name: 'tables'},
  {table_name: 'users'}
]);

// test SQLExecutionError in Tables statement
db = init();
expectError(db.execute.bind(db, 'tables;'), new Error('SQLExecutionError: No database selected'));

// test Columns statement
db = init();
db.execute('use system;');
res = db.execute('columns from users;');
equal(res.text.indexOf('4 rows selected') === 0, true);
equal(res.records, [
  {column_name: 'id',               data_type: 'number', column_id: 0},
  {column_name: 'username',         data_type: 'string', column_id: 1},
  {column_name: 'password',         data_type: 'string', column_id: 2},
  {column_name: 'default_database', data_type: 'string', column_id: 3}
]);

// test Describe statement
db = init();
db.execute('use system;');
res = db.execute('describe users;');
equal(res.text.indexOf('4 rows selected') === 0, true);
equal(res.records, [
  {column_name: 'id',               data_type: 'number', column_id: 0},
  {column_name: 'username',         data_type: 'string', column_id: 1},
  {column_name: 'password',         data_type: 'string', column_id: 2},
  {column_name: 'default_database', data_type: 'string', column_id: 3}
]);

// test SQLExecutionError in Columns statement
db = init();
expectError(db.execute.bind(db, 'columns from users;'), new Error('SQLExecutionError: No database selected'));

// test SQLExecutionError in Columns statement
db = init();
db.execute('use system;');
expectError(db.execute.bind(db, 'columns from abcd;'), new Error('SQLExecutionError: Table \'abcd\' does not exist'));

// test SQLExecutionError in Describe statement
db = init();
expectError(db.execute.bind(db, 'describe users;'), new Error('SQLExecutionError: No database selected'));

// test SQLExecutionError in Describe statement
db = init();
db.execute('use system;');
expectError(db.execute.bind(db, 'describe abcd;'), new Error('SQLExecutionError: Table \'abcd\' does not exist'));
return;

db = init();
db.execute('create database db_name;');
db.execute('use db_name;');
res = db.execute('create table tbl_name(col_name);');
equal(res.text, 'Table \'tbl_name\' created');
res = db.execute('tables;');
equal(res.records, [{table_name: 'tbl_name'}]);
res = db.execute('columns from tbl_name;');
equal(res.records, [{column_name: 'col_name', data_type: null, column_id: 0}]);

db = init();
db.execute('create database db_name;');
db.execute('use db_name;');
res = db.execute('create table tbl_name(col_name1 string, col_name2 number, col_name3 boolean);');
equal(res.text, 'Table \'tbl_name\' created');
res = db.execute('tables;');
equal(res.records, [{table_name: 'tbl_name'}]);
res = db.execute('columns from tbl_name;');
equal(res.records, [
  {column_name: 'col_name1', data_type: 'string', column_id: 0},
  {column_name: 'col_name2', data_type: 'number', column_id: 1},
  {column_name: 'col_name3', data_type: 'boolean', column_id: 2}
]);

db = init();
db.execute('create database db_name;');
db.execute('use db_name;');
db.execute('create table tbl_name(col_name);');
res = db.execute('drop table tbl_name;');
equal(res.text, 'Table \'tbl_name\' removed');
res = db.execute('tables;');

db = init();
db.execute('create database db_name;');
db.execute('use system;');
res = db.execute('select * from users;');
equal(res.text.indexOf('1 row selected') === 0, true);
equal(res.records, [
  {username: 'root', password: null, default_database: null}
]);

db = init();
db.execute('create database db_name;');
db.execute('use system;');
res = db.execute('select users.* from users;');
equal(res.text.indexOf('1 row selected') === 0, true);
equal(res.records, [
  {username: 'root', password: null, default_database: null}
]);

db = init();
db.execute('create database db_name;');
db.execute('use system;');
res = db.execute('select username, password, default_database from users;');
equal(res.text.indexOf('1 row selected') === 0, true);
equal(res.records, [
  {username: 'root', password: null, default_database: null}
]);

db = init();
db.execute('create database db_name;');
db.execute('use db_name;');
db.execute('create table tbl_name(col_name);');
res = db.execute('insert into tbl_name(col_name) values(\'abcd\');');

{
  db = init();
  const session = db.createSession();
  session.execute('database;').then((res) => {
    equal(res.records, [{database_name: null}]);
  }).catch((e) => {
    console.error(e);
  });
}

{
  db = init();
  const session = db.createSession();
  session.execute('databases;').then((res) => {
    equal(res.records, [{database_name: 'system'}]);
  }).catch((e) => {
    console.error(e);
  });
}

{
  db = init();
  const session = db.createSession();
  session.execute('use system;').then((res) => {
    equal(res.text, 'Database changed');
    return session.execute('database;');
  }).then((res) => {
    equal(res.records, [{database_name: 'system'}]);
  }).catch((e) => {
    console.error(e);
  });
}

{
  db = init();
  const session = db.createSession();
  session.execute('use system;').then((res) => {
    return session.execute('tables;');
  }).then((res) => {
    equal(res.records, [
      {table_name: 'columns'},
      {table_name: 'database_privileges'},
      {table_name: 'databases'},
      {table_name: 'global_privileges'},
      {table_name: 'table_privileges'},
      {table_name: 'tables'},
      {table_name: 'users'}
    ]);
  }).catch((e) => {
    console.error(e);
  });
}

{
  db = init();
  const session = db.createSession();
  session.execute('use system;').then((res) => {
    return session.execute('columns from users;');
  }).then((res) => {
    equal(res.records, [
      {column_name: 'username',         data_type: 'string', column_id: 0},
      {column_name: 'password',         data_type: 'string', column_id: 1},
      {column_name: 'default_database', data_type: 'string', column_id: 2},
    ]);
  }).catch((e) => {
    console.error(e);
  });
}

{
  db = init();
  const session = db.createSession();
  session.execute('create database abcd;').then((res) => {
    equal(res.text, 'Database \'abcd\' created');
    return session.execute('databases;');
  }).then((res) => {
    equal(res.records, [
      {database_name: 'abcd'},
      {database_name: 'system'}
    ]);
  }).catch((e) => {
    console.error(e);
  });
}

{
  db = init();
  const session = db.createSession();
  session.execute('create database abcd;').then((res) => {
    return session.execute('drop database abcd;');
  }).then((res) => {
    equal(res.text, 'Database \'abcd\' removed');
    return session.execute('databases;');
  }).then((res) => {
    equal(res.records, [
      {database_name: 'system'}
    ]);
  }).catch((e) => {
    console.error(e);
  });
}
