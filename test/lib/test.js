const util = require('util');

const equal = (actual, expected) => {
  if(!eq(actual, expected)) error(actual, expected);
};

const expectError = (actual, expected) => {
  try {
    actual();
  }
  catch(e) {
    if(!(e.constructor === Error ? e.message === expected.message : eq(e, expected))) {
      error(e, expected);
    }
    return;
  }
  console.error('AssertionError');
  console.error(`  expected: ${expected}`);
  console.error('  actual:   No error thrown');
};

const eq = (a, b) => {
  if(a === b) return true;
  if(!(a instanceof Object) || !(b instanceof Object)) return false;
  if(a.constructor !== b.constructor) return false;
  for(let p in a) {
    if(!a.hasOwnProperty(p)) continue;
    if(!b.hasOwnProperty(p)) return false;
    if(!eq(a[p], b[p])) return false;
  }
  for(let p in b) {
    if(b.hasOwnProperty(p) && !a.hasOwnProperty(p)) return false;
  }
  return true;
};

const error = (actual, expected) => {
  console.error('AssertionError');
  console.error(`  expected: ${inspect(expected)}`);
  console.error(`  actual:   ${inspect(actual)}`);
  fail();
};

const inspect = (o) => {
  const arr = util.inspect(o, {depth: null}).split('\n');
  for(let i=1; i<arr.length; i++) arr[i] = `  ${arr[i]}`;
  return arr.join('\n');
};

const fail = (str) => {
  if(str) console.error(str);
  console.error(new Error('dummy').stack.split('\n').slice(1).join('\n'));
};

module.exports = {equal, expectError, fail};
