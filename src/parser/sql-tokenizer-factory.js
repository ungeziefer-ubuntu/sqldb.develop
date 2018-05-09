const SQLTokenizerFactory = (() => {
  'use strict';

  class SQLTokenizerFactory {
    constructor(components) {
      const {Source, StringDelimiter, RegExpDelimiter, QuoteDelimiter, MultiDelimiter,
        Tokenizer, BufferedTokenizer} = components;
      this.Source = Source;
      this.Tokenizer = Tokenizer;
      this.BufferedTokenizer = BufferedTokenizer;
      this.SQLDelimiter = MultiDelimiter()
        .extend(StringDelimiter(' ', false))
        .extend(StringDelimiter('\t', false))
        .extend(StringDelimiter('\n', false))
        .extend(StringDelimiter('('))
        .extend(StringDelimiter(')'))
        .extend(StringDelimiter(','))
        .extend(StringDelimiter(';'))
        .extend(StringDelimiter('.'))
        .extend(StringDelimiter('*'))
        .extend(QuoteDelimiter('\''))
        .extend(QuoteDelimiter('\"'))
        .extend(RegExpDelimiter(/^d+(\.\d*)?(?![a-z_])$/i).setKind('number'))
        .extend(RegExpDelimiter(/^\.\d+(?![a-z_])$/i).setKind('number'))
        .extend(RegExpDelimiter(/^[a-z]\w*/i).setKind('identifier'));
    }

    createTokenizer(str) {
      const {Source, Tokenizer, BufferedTokenizer, SQLDelimiter} = this;
      return BufferedTokenizer(Tokenizer(Source(str), SQLDelimiter));
    }
  }

  return (...args) => new SQLTokenizerFactory(...args);
})();

if(!this.window) module.exports = SQLTokenizerFactory;
