const {equal} = require('./lib/test');
const {Source, StringDelimiter} = require('./require');

let source, delimiter;

source = Source('abcd');
delimiter = StringDelimiter('a', true);
equal(delimiter.split(source), {value: 'a', idx: 0, pos: {line: 0, column: 0}, returnable: true});
source.shift();
equal(delimiter.split(source), null);
delimiter = StringDelimiter('bcd', false);
equal(delimiter.split(source), {value: 'bcd', idx: 1, pos: {line: 0, column: 1}, returnable: false});
