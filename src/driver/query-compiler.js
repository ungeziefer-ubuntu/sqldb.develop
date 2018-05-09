const QueryCompiler = (() => {
  'use strict';

  const QueryCompiler = {
    compile_query(stmt, context, fieldList) {
      const {type, selectBody:{fromItem, whereCondition, groupByElements, havingCondition, selectItems,
        distinct, orderByElements, rowCount}} = stmt;

      fieldList = this.createFieldList(context);

      const param = {};

      param.type = type;

      param.fromItems = this.prepareFromItems(context, fromItem, fieldList);

      param.where = whereCondition ? this.compile_expr(context, whereCondition, fieldList) : null;

      const groupby = param.groupby = groupByElements !== void 0;
      const grouping = param.grouping = groupby ? this.prepareGroupByElements(context, groupByElements, fieldList) : null;
      param.groupByColumns = groupby ? this.prepareGroupByColumns(fieldList) : null;

      param.having = havingCondition ? this.compile_expr(context, havingCondition, fieldList, true) : null;

      param.items = this.prepareSelectItems(context, selectItems, fieldList, groupby);

      param.distinct = distinct;
      param.distinctColumns = distinct ? this.prepareDistinctColumns(items) : null;

      const order = param.order = orderByElements ? this.prepareOrderByElements(items, fieldList) : null;
      param.orderByColumns = order ? this.prepareOrderByColumns(order) : null;

      param.limit = rowCount !== void 0 ? Number(rowCount) : null;

      return () => this.execute_query(context, param, fieldList);
    },

    execute_query(context, param, fieldList) {
      const {fromItems, where, groupby, grouping, groupByColumns, having, items,
        distinct, distinctColumns, order, orderByColumns, limit} = param;

      const {session} = context;
      const db = session.transaction || session.db;

      let query;

      query = db.on(fromItems[0].name);

      let count = 0;
      const collect = function(record) {
        if(groupby || distinct) {
          if(count === limit) return this.EXIT;
          count++;
        }
        const _record = {};
        for(let i=0; i<items.length; i++) {
          let item = items[i];
          _record[item.name] = distinct ? record[distinctColumns[i]] : item.expr(record);
        }
        record._items = _record;
        if(order) {
          for(let i=0; i<order.length; i++) {
            _record[orderByColumns[i]] = order[i].expr(record);
          }
        }
        return _record;
      };

      query = query.map(function(record) {
        if(!(groupby || distinct)) {
          if(count === limit) return this.EXIT;
        }
        const _record = fromItems.length === 1 ? {[fromItems[0].alias]: record} : record;
        if(where) {
          if(!where(_record)) return null;
        }
        if(groupby) {
          for(let i=0; i<groupByColumns.length; i++) {
            _record[groupByColumns[i]] = grouping[i].expr(_record);
          }
        }
        if(!(groupby || distinct)) {
          count++;
        }
        return (groupby || distinct) ? _record : collect.call(this, _record);
      });

      query = groupby ? query.group(groupByColumns).map(function(record) {
        return !having || having(record) ? distinct ? record : collect.call(this, record) : null;
      }) : query;

      query = distinct ? query.map((record) => {
        const _record = {};
        for(let i=0; i<items.length; i++) {
          const item = items[i];
          _record[item.name] = _record[distinctColumns[i]] = item.expr(record);
        }
        return _record;
      }).group(distinctColumns).map(function(record) {
        return collect.call(this, record);
      }) : query;

      query = order ? query.order(orderByColumns).each((record) => {
        for(let i=0; i<orderByColumns.length; i++) {
          delete record[orderByColumns[i]];
        }
      }) : query;

      return query;
    },

    prepareFromItems(context, fromItem, fieldList) {
      const {session:{db}} = context;
      const {table, alias} = fromItem;
      const name = table.name;
      const fromItems = [];
      if(!this.hasTable(context, db.name, name)) {
        this.error(`Table \'${name}\' does not exist`);
      }
      fieldList.addAllTableColumns(name, alias);
      fromItems.push({
        name,
        alias: alias || name
      });
      return fromItems;
    },

    prepareGroupByElements(context, groupByElements, fieldList) {
      const grouping = [];
      for(let {expression:e} of groupByElements) {
        grouping.push({
          expr: this.compile_expr(context, e, fieldList),
          table_name: e.type === 'column' ? this.getTableName(e.table) : null,
          column_name: e.type === 'column' ? e.name : null
        });
      }
      fieldList.addGroupingColumns(grouping);
      return grouing;
    },

    prepareGroupByColumns(fieldList) {
      const groupByColumns = [];
      for(let {column_id} of fieldList.getAllGroupingColumns()) groupByColumns.push(column_id);
      return groupByColumns;
    },

    prepareSelectItems(context, selectItems, fieldList, groupby) {
      if(!groupby) {
        for(let selectItem of selectItems) {
          if(selectItem.type === 'select_expression_item') {
            if(this.hasAggregateFunction(selectItem.expression)) {
              fieldList.addDummyGroupingColumns();
              groupby = true;
              break;
            }
          }
        }
      }
      const items = [];
      const names = [];
      for(let selectItem of selectItems) {
        const {type, table, expression, alias} = selectItem;
        switch(type) {
          case 'all_columns':
          case 'all_table_columns':
            const columns = groupby ? type === 'all_columns' ? fieldList.getAllGroupingColumns()
              : fieldList.getAllGroupingTableColumns(table.name)
              : type === 'all_columns' ? fieldList.getAllColumns()
              : fieldList.getAllTableColumns(table.name);
            for(let column of columns) {
              const {table_name, column_name} = column;
              const name = column_name;
              if(names.includes(name)) {
                this.error(`Duplicate column name \'${name}\'`);
              }
              names.push(name);
              items.push({
                name,
                expr: this.column_expr(context, {table: {name: table_name}, name: column_name}, fieldList, groupby)
              });
            }
            break;
          case 'select_expression_item':
            const name = alias || expression.toString();
            if(names.includes(name)) {
              this.error(`Duplicate column name \'${name}\'`);
            }
            names.push(name);
            items.push({
              name,
              expr: this.compile_expr(context, expression, fieldList, groupby)
            });
            break;
          default:
            this.fatal();
        }
      }
      fieldList.addSelectItems(items);
      return items;
    },

    hasAggregateFunction() {
    },

    typeOf(o) {
      return Object.prototype.toString.call(o).slice(8, -1);
    },

    isFunction(o) {
      return this.typeOf(o) === 'Function';
    }
  };

  return QueryCompiler;
})();

if(!this.window) module.exports = QueryCompiler;
