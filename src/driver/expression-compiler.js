const ExpressionCompiler = (() => {
  'use strict';

  const ExpressionCompiler = {
    compile_expr(...args) {
      const expr = this.expr(...args);
      return this.isFunction(expr) ? expr : () => expr;
    },

    expr(...args) {
      const [context, expression, fieldList, groupby] = args;
      const e = expression;
      switch(e.type) {
        case 'string':  return e.stringValue;
        case 'number':  return Number(e.stringValue);
        case 'boolean': return e.stringValue === 'true';
        case 'null':    return null;
        case 'column':  return this.column_expr(...args);
        default: this.fatal();
      }
    },

    column_expr(...args) {
      const [context, expression, fieldList, groupby] = args;
      const {table, name} = expression;
      const {table_name, column_id} = fieldList[groupby ? 'getGroupingColumn' : 'getColumn'](name, this.getTableName(table));
      const column_name = groupby ? column_id : name;
      return groupby ? (record) => (record ? record[column_name] : null)
        : (record) => (record && record[table_name] ? record[table_name][column_name] : null);
    }
  };

  return ExpressionCompiler;
})();

if(!this.window) module.exports = ExpressionCompiler;
