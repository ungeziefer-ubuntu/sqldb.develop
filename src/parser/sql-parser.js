const SQLParser = (() => {
  'use strict';

  const arr = [
    'User',
    'Users',
    'CreateUser',
    'DropUser',
    'Database',
    'Databases',
    'UseDatabase',
    'CreateDatabase',
    'DropDatabase',
    'Tables',
    'Columns',
    'CreateTable',
    'DropTable',
    'Select',
    'Insert',
    'ColumnDefinition',
    'DataType',
    'SelectBody',
    'AllColumns',
    'AllTableColumns',
    'SelectExpressionItem',
    'Table',
    'FromItem',
    'GroupByElement',
    'OrderByElement',
    'ItemsList',
    'StringValue',
    'NumberValue',
    'BooleanValue',
    'NullValue',
    'Column',
    'SignedExpression',
    'Function',
    'Parenthesis',
    'UnaryExpression',
    'Expression',
    'Identifier'
  ];

  for(let i=0; i<arr.length; i++) {
    const name = arr[i];
    arr[i] = `const ${name} = submodules.${name} = ParserGenerator(\'${name}\');`
  }

  const declare = arr.join('');

  const define = () => {
    const isDuplicateColumnName = (items, tokenizer, res) => {
      if(!res) return res;
      const name = res.name;
      const columns = items.columnDefinitions || items.columns;
      for(let i=columns.length-2; 0<=i; i--) {
        if(columns[i].name === name) return null;
      }
      return res;
    };

    const countItemsLists = (items, tokenizer, res) => {
      const {columns, itemsLists} = items;
      return !columns || itemsLists.length <= columns.length ? res : null;
    };

    const toString = function() {
      const e = this;
      switch(e.type) {
        case 'number':   return e.stringValue;
        case 'string':   return `\'${e.stringValue}\'`;
        case 'booolean': return e.stringValue;
        case 'null':     return 'null';
        case 'column':   return e.name;
        default: throw new Error('FatalError:');
      }
    };

    User
      .from('user').in(/^user$/i).error(false)
      .select(() => ({type: 'user'}));

    Users
      .from('users').in(/^users$/i).error(false)
      .select(() => ({type: 'users'}));

    CreateUser
      .from('create').in(/^create$/i).error(false)
      .from('user').in(/^user$/i).error(false)
      .from('name').in(Identifier)
      .select((items) => ({type: 'create_user', name: items.name}));

    DropUser
      .from('drop').in(/^drop$/i).error(false)
      .from('user').in(/^user$/i).error(false)
      .from('name').in(Identifier)
      .select((items) => ({type: 'drop_user', name: items.name}));

    Database
      .from('database').in(/^database$/i).error(false)
      .select(() => ({type: 'database'}));

    Databases
      .from('databases').in(/^databases$/i).error(false)
      .select(() => ({type: 'databases'}));

    UseDatabase
      .from('use').in(/^use$/i).error(false)
      .from('name').in(Identifier)
      .select((items) => ({type: 'use_database', name: items.name}));

    CreateDatabase
      .from('create').in(/^create$/i).error(false)
      .from('database').in(/^database$/i).error(false)
      .from('name').in(Identifier)
      .select((items) => ({type: 'create_database', name: items.name}));

    DropDatabase
      .from('drop').in(/^drop$/i).error(false)
      .from('database').in(/^database$/i).error(false)
      .from('name').in(Identifier)
      .select((items) => ({type: 'drop_database', name: items.name}));

    Tables
      .from('tables').in(/^tables$/i).error(false)
      .select(() => ({type: 'tables'}));

    Columns
      .from('columns').in(/^columns$/i).optional()
      .from('from').in(/^from$/i).premise('columns')
      .from('describe').in(/^describe$/i).for('columns').error(false)
      .from('name').in(Identifier)
      .select((items) => ({type: 'columns', name: items.name}));

    CreateTable
      .from('create').in(/^create$/i).error(false)
      .from('table').in(/^table$/i).error(false)
      .from('name').in(Identifier)
      .from('(').in('(')
      .from('columnDefinitions').in(ColumnDefinition).atLeastOnce().delim(',').filter(isDuplicateColumnName)
      .from(')').in(')')
      .select((items) => ({
        type: 'create_table',
        name: items.name,
        columnDefinitions: items.columnDefinitions
      }));

    DropTable
      .from('drop').in(/^drop/i).error(false)
      .from('table').in(/^table$/i).error(false)
      .from('name').in(Identifier)
      .select((items) => ({
        type: 'drop_table',
        name: items.name
      }));

    Select
      .from('mainQuery').assigning(true)
      .from('selectBody').in(SelectBody).error(false)
      .select((items) => ({
        type: 'main_query',
        selectBody: items.selectBody
      }));

    Insert
      .from('insert').in(/^insert$/i).error(false)
      .from('into').in(/^into$/i)
      .from('table').in(Table)
      .from('(').in('(').optional()
      .from('columns').in(Column).atLeastOnce().delim(',').filter(isDuplicateColumnName).premise('(')
      .from(')').in(')').premise('(')
      .from('values').in(/^values$/i).optional()
      .from('itemsLists').in(ItemsList).atLeastOnce().delim(',').filter(countItemsLists)
      .select((items) => ({
        type: 'insert',
        table: items.table,
        columns: items.columns,
        itemsLists: items.itemsLists
      }));

    ColumnDefinition
      .from('name').in(Identifier)
      .from('dataType').in(DataType).optional()
      .select((items) => ({
        type: 'column_definition',
        name: items.name,
        dataType: items.dataType
      }));

    DataType
      .from('dataType')
        .in(/^string$/i)
        .or(/^number$/i)
        .or(/^boolean$/i)
        .error(false)
      .select((items) => ({
        type: 'data_type',
        dataType: items.dataType
      }));

    SelectBody
      .from('select').in(/^select$/i).error(false)
      .from('distinct').in(/^distinct$/i).optional()
      .from('selectItems').in(AllColumns).or(AllTableColumns).or(SelectExpressionItem).atLeastOnce().delim(',')
      .from('from').in(/^from$/i)
      .from('fromItem').in(FromItem)
      .from('where').in(/^where$/i).optional()
      .from('whereCondition').in(Expression).premise('where')
      .from('group').in(/^group$/i).optional()
      .from('by').in(/^by$/i).premise('group')
      .from('groupByElements').in(GroupByElement).atLeastOnce().delim(',').premise('group')
      .from('having').in(/^having$/i).optional()
      .from('havingCondition').in(Expression).premise('having')
      .from('order').in(/^order$/i).optional()
      .from('by').in(/^by$/i).premise('order')
      .from('orderByElements').in(OrderByElement).atLeastOnce().delim(',').premise('group')
      .from('limit').in(/^limit$/i).optional()
      .from('rowCount').in(/^\d+$/).premise('limit')
      .select((items) => ({
        type: 'query_body',
        distinct: items.distinct !== void 0,
        selectItems: items.selectItems,
        fromItem: items.fromItem,
        whereCondition: items.whereCondition,
        groupByElements: items.groupByElements,
        havingCondition: items.havingCondition,
        orderByElements: items.orderByElements,
        rowCount: items.rowCount
      }));

    AllColumns
      .from('*').in('*').error(false)
      .select(() => ({type: 'all_columns'}));

    AllTableColumns
      .from('table').in(Table).error(false)
      .from('.').in('.').error(false)
      .from('*').in('*').error(false)
      .select((items) => ({
        type: 'all_table_columns',
        table: items.table
      }));

    SelectExpressionItem
      .from('expression').in(Expression).error(false)
      .from('as').in(/^as$/i).optional()
      .from('alias').in(Identifier).premise('as')
      .from('alias').in(Identifier).optional().for('as')
      .select((items) => ({
        type: 'select_expression_item',
        expression: items.expression,
        alias: items.alias
      }));

    Table
      .from('name').in(Identifier).error(false)
      .select((items) => ({
        type: 'table',
        name: items.name
      }));

    FromItem
      .from('table').in(Table).error(false)
      .from('as').in(/^as$/i).optional()
      .from('alias').in(Identifier).premise('as')
      .from('alias').in(Identifier).optional().for('as')
      .select((items) => ({
        type: 'from_item',
        table: items.table,
        alias: items.alias
      }));

    GroupByElement
      .from('expression').in(Expression).error(false)
      .select((items) => ({
        type: 'groupby_element',
        table: items.expression
      }));

    OrderByElement
      .from('expression').in(Expression).error(false)
      .from('direction').in(/^asc$/i).or(/^desc$/i).optional()
      .select((items) => ({
        type: 'orderby_element',
        expression: items.expression,
        direction: items.direction.toLowerCase()
      }));

    ItemsList
      .from('(').in('(')
      .from('expressionList').in(Expression).atLeastOnce().delim(',').error(false)
      .from(')').in(')')
      .select((items) => ({
        type: 'items_list',
        expressionList: items.expressionList
      }));

    StringValue
      .from('stringValue').in((items, tokenizer) => {
        if(!tokenizer.hasNext()) return null;
        const res = tokenizer.next();
        return res.isQuoted && res.isClosed ? res.content : null;
      }).error(false)
      .select((items) => ({
        type: 'string',
        stringValue: items.stringValue
      }));

    NumberValue
      .from('stringValue').in((items, tokenizer) => {
        if(!tokenizer.hasNext()) return null;
        const res = tokenizer.next();
        return res.kind === 'number' ? res.value : null;
      }).error(false)
      .select((items) => ({
        type: 'number',
        stringValue: items.stringValue
      }));

    BooleanValue
      .from('stringValue').in(/^true$/i).or(/^false$/i).error(false)
      .select((items) => ({
        type: 'boolean',
        stringValue: items.stringValue.toLowerCase()
      }));

    NullValue
      .from('stringValue').in(/^null$/i).error(false)
      .select((items) => ({
        type: 'null',
        stringValue: items.stringValue.toLowerCase()
      }));

    Column
      .from('column').in(
        ParserGenerator('Column')
          .from('table').in(Table).error(false)
          .from('.').in('.').premise('table').error(false)
          .from('name').in(Identifier).premise('table').error(false)
          .select()
      )
      .or(
        ParserGenerator('Column')
          .from('name').in(Identifier).error(false)
          .select()
      )
      .select((items) => ({
        type: 'column',
        table: items.column.table,
        name: items.column.name
      }));

    UnaryExpression
      .from('expression')
        .in(StringValue)
        .or(NumberValue)
        .or(BooleanValue)
        .or(NullValue)
        .or(Column)
      .select((items) => Object.assign(items.expression, {toString}));

    Expression
      .from('expression').in(UnaryExpression).error(false)
      .select('expression');

    Identifier
      .from('identifier').in((items, tokenizer) => {
        if(!tokenizer.hasNext()) return null;
        const res = tokenizer.next();
        return res.kind === 'identifier' ? res.value : null;
      }).error(false)
      .where((items) => !ReservedWords.includes(items.identifier.toLowerCase()))
      .select((items) => items.identifier.toLowerCase());

    const parser = ParserGenerator('SQLParser')
      .from('statement')
        .in(User)
        .or(Users)
        .or(CreateUser)
        .or(DropUser)
        .or(Database)
        .or(Databases)
        .or(UseDatabase)
        .or(CreateDatabase)
        .or(DropDatabase)
        .or(Tables)
        .or(Columns)
        .or(CreateTable)
        .or(DropTable)
        .or(Select)
        .or(Insert)
      .from(';').in(';')
      .select('statement');

    parser.submodules = submodules;

    return parser;
  };

  return eval(
    '(ParserGenerator, ReservedWords) => {' +
    '  const submodules = {};' +
    `  ${declare}` +
    `  return (${define.toString()})();` +
    '};'
  );
})();

if(!this.window) module.exports = SQLParser;
