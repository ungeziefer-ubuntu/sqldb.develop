const fs = require('fs');

const buffer = [];

[
  '../src/parser/lib/source.js',
  '../src/parser/lib/string-delimiter.js',
  '../src/parser/lib/regexp-delimiter.js',
  '../src/parser/lib/quote-delimiter.js',
  '../src/parser/lib/multi-delimiter.js',
  '../src/parser/lib/tokenizer.js',
  '../src/parser/lib/buffered-tokenizer.js',
  '../src/parser/lib/parser-generator.js',
  '../src/parser/sql-tokenizer-factory.js',
  '../src/parser/sql-reserved-words.js',
  '../src/parser/sql-parser.js',
  '../src/driver/sqldb-driver.js',
  '../src/driver/session-driver.js',
  '../src/driver/query-compiler.js',
  '../src/driver/expression-compiler.js',
  '../src/driver/field-list.js',
  '../src/engine/database.js',
  '../src/main/sqldb.js'
]
.forEach((path) => buffer.push(fs.readFileSync(path, 'utf8')));

const src = buffer.join('\n');

fs.writeFileSync('../sqldb.js', src);
