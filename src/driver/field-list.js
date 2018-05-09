const FieldList = (() => {
  'use strict';

  class FieldList {
    constructor(context) {
      const {session:{db, dbs:{system}}, driver} = context;
      this.system = system;
      this.db = db;
      this.driver = driver;
      this.columns = [];
      this.groupingColumns = [];
    }

    addAllTableColumns(name, alias) {
      const {system, db, columns} = this;
      const database_name = db.name;
      const table_name = name;
      const _columns = system.on('columns').filter({database_name, table_name}).order([{column_id:1}]).find();
      for(let {column_name, column_id} of _columns) {
        columns.push({
          table_name: alias || name,
          column_name,
          column_id
        });
      }
    }

    addGroupingColummns(grouping) {
      const {groupingColumns} = this;
      for(let i=0; i<grouping.length; i++) {
        const {table_name, column_name} = grouping[i];
        groupingColumns.push({
          table_name,
          column_name,
          column_id: `_g${i}`,
        });
      }
    }

    addDummyGroupingColumns() {
      this.groupingColumns.push({dummy: true});
    }

    addSelectItems(items) {
      const {columns} = this;
      for(let i=0; i<items.length; i++) {
        const {name:column_name} = items[i];
        columns.push({
          table_name: '_m',
          column_name,
          column_id: i
        });
      }
    }

    getColumn(...args) {
      return this._getColumn(this.columns, ...args);
    }

    getGroupingColumn(...args) {
      return this._getColumn(this.groupingColumns, ...args);
    }

    getAllColumns() {
      return this._getColumns(this.columns);
    }

    getAllGroupingColumns() {
      return this._getColumns(this.groupingColumns);
    }

    getAllTableColumns(...args) {
      return this._getColumns(this.columns, ...args);
    }

    getAllGroupingTableColumns(...args) {
      return this._getColumns(this.groupingColumns, ...args);
    }

    _getColumn(columns, ...args) {
      const [column_name, table_name] = args;
      const {driver} = this;
      const res = [];
      for(let column of columns) {
        if(!column.dummy && column.column_name === column_name && (!table_name || column.table_name === table_name)) {
          res.push(column);
        }
      }
      const name = (table_name, column_name) => (table_name ? `\'${table_name}\'.` : '') + `\'${column_name}\'`;
      if(res.length === 0) {
        driver.error(`Column ${name(table_name, column_name)} does not exist in field list`);
      }
      if(1 < res.length) {
        for(let column of res) {
          if(column.table_name === '_m') return column;
        }
        driver.error(`Ambiguous column name \'${name(table_name, column_name)}\'`);
      }
      return res[0];
    }

    _getColumns(columns, ...args) {
      const [table_name] = args;
      const {driver} = this;
      const res = [];
      for(let column of columns) {
        if(!column.dummy && (!table_name || column.table_name === table_name)) {
          res.push(column);
        }
      }
      res.sort((a, b) => {
        if(a.table_name < b.table_name)      return -1;
        else if(b.table_name < a.table_name) return 1;
        else if(a.column_id < b.column_id)   return -1;
        else if(a.column_id < b.column_id)   return 1;
        return 0;
      });
      if(table_name && res.length === 0) {
        driver.error(`Unknown table \'${table_name}\'`);
      }
      return res;
    }
  }

  return (context) => new FieldList(context);
})();

if(!this.window) module.exports = FieldList;
