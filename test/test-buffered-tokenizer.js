const {equal} = require('./lib/test');
const {Source, StringDelimiter, MultiDelimiter, Tokenizer, BufferedTokenizer} = require('./require');

let delimiter, tokenizer;

delimiter = MultiDelimiter()
.extend(StringDelimiter(' ', false))
.extend(StringDelimiter('\n', false))
.extend(StringDelimiter('(', true))
.extend(StringDelimiter(')', true))
.extend(StringDelimiter(',', true))
.extend(StringDelimiter(';', true));

tokenizer = BufferedTokenizer(Tokenizer(Source('create table tbl_name\n (col_name1, col_name2);'), delimiter));

equal(tokenizer.next(), {value: 'create', idx: 0, pos: {line: 0, column: 0}, returnable: true});
equal(tokenizer.next(), {value: 'table', idx: 7, pos: {line: 0, column: 7}, returnable: true});
equal(tokenizer.next(), {value: 'tbl_name', idx: 13, pos: {line: 0, column: 13}, returnable: true});
equal(tokenizer.next(), {value: '(', idx: 23, pos: {line: 1, column: 1}, returnable: true});
equal(tokenizer.next(), {value: 'col_name1', idx: 24, pos: {line: 1, column: 2}, returnable: true});
equal(tokenizer.next(), {value: ',', idx: 33, pos: {line: 1, column: 11}, returnable: true});
equal(tokenizer.next(), {value: 'col_name2', idx: 35, pos: {line: 1, column: 13}, returnable: true});
equal(tokenizer.next(), {value: ')', idx: 44, pos: {line: 1, column: 22}, returnable: true});
equal(tokenizer.next(), {value: ';', idx: 45, pos: {line: 1, column: 23}, returnable: true});
