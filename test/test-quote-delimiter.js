const {equal} = require('./lib/test');
const {Source, QuoteDelimiter} = require('./require');

let source, delimiter;

source = Source('\'abcd\'');
delimiter = QuoteDelimiter('\'', true);
equal(delimiter.split(source), {
  value: '\'abcd\'',
  idx: 0,
  pos: {line: 0, column: 0},
  returnable: true,
  content: 'abcd',
  length: 6,
  isQuoted: true,
  isClosed: true
});

source = Source('"abcd"');
delimiter = QuoteDelimiter('"', true);
equal(delimiter.split(source), {
  value: '"abcd"',
  idx: 0,
  pos: {line: 0, column: 0},
  returnable: true,
  content: 'abcd',
  length: 6,
  isQuoted: true,
  isClosed: true
});

source = Source('\'ab\\\'cd\'');
delimiter = QuoteDelimiter('\'', true);
equal(delimiter.split(source), {
  value: '\'ab\'cd\'',
  idx: 0,
  pos: {line: 0, column: 0},
  returnable: true,
  content: 'ab\'cd',
  length: 8,
  isQuoted: true,
  isClosed: true
});

source = Source('\'ab\\\\cd\'');
delimiter = QuoteDelimiter('\'', true);
equal(delimiter.split(source), {
  value: '\'ab\\cd\'',
  idx: 0,
  pos: {line: 0, column: 0},
  returnable: true,
  content: 'ab\\cd',
  length: 8,
  isQuoted: true,
  isClosed: true
});

source = Source('\'\\\\\'');
delimiter = QuoteDelimiter('\'', true);
equal(delimiter.split(source), {
  value: '\'\\\'',
  idx: 0,
  pos: {line: 0, column: 0},
  returnable: true,
  content: '\\',
  length: 4,
  isQuoted: true,
  isClosed: true
});

source = Source('\'\\\\\\\'\'');
delimiter = QuoteDelimiter('\'', true);
equal(delimiter.split(source), {
  value: '\'\\\'\'',
  idx: 0,
  pos: {line: 0, column: 0},
  returnable: true,
  content: '\\\'',
  length: 6,
  isQuoted: true,
  isClosed: true
});
