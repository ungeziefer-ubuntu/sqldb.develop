const {equal} = require('./lib/test');
const {Source, StringDelimiter, MultiDelimiter, Tokenizer, BufferedTokenizer,
  ParserGenerator, SQLTokenizerFactory, SQLReservedWords, SQLParser} = require('./require');

const factory = SQLTokenizerFactory(Source, StringDelimiter, MultiDelimiter, Tokenizer, BufferedTokenizer);
const parser = SQLParser(ParserGenerator, SQLReservedWords);

let tokenizer;

tokenizer = factory.createTokenizer('database;');
equal(parser.parse(tokenizer), {type: 'database'});

tokenizer = factory.createTokenizer('databases;');
equal(parser.parse(tokenizer), {type: 'databases'});

tokenizer = factory.createTokenizer('use db_name;');
equal(parser.parse(tokenizer), {type: 'use_database', name: 'db_name'});

tokenizer = factory.createTokenizer('create database db_name;');
equal(parser.parse(tokenizer), {type: 'create_database', name: 'db_name'});

tokenizer = factory.createTokenizer('drop database db_name;');
equal(parser.parse(tokenizer), {type: 'drop_database', name: 'db_name'});

tokenizer = factory.createTokenizer('tables;');
equal(parser.parse(tokenizer), {type: 'tables'});

tokenizer = factory.createTokenizer('columns from tbl_name;');
equal(parser.parse(tokenizer), {type: 'columns', name: 'tbl_name'});

tokenizer = factory.createTokenizer('describe tbl_name;');
equal(parser.parse(tokenizer), {type: 'columns', name: 'tbl_name'});
