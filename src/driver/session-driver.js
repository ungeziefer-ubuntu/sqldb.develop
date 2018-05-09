const SessionDriver = (() => {
  'use strict';

  class SessionDriver {
    constructor(driver) {
      this.driver = driver;
    }

    execute(stmt, context) {
      const {driver} = this;
      const {session:{id, db, dbs:{system}, transaction, processing, config}} = context;
      switch(stmt.type) {
        case 'database':
        case 'databases':
        case 'use_database':
          return promise(() => driver.execute(stmt, context));
        case 'create_database':
        case 'drop_database':
          return system.lockFor(() => driver.execute(stmt, context));
        case 'tables':
        case 'columns':
        case 'create_table':
        case 'drop_table':
          driver.isConnected(context);
          const database_name = db.name;
          const {name:table_name} = stmt;
          const name = `${database_name}.${table_name}`;
          return lockFor(
            () => {
              if(processing.ddl[name] || processing.dml[name] || processing.query[name]) return false;
              processing.ddl[name] = id;
              return true;
            },
            () => delete processing.ddl[name],
            () => driver.execute(stmt, context),
            config
          );
        default: this.fatal();
      }
    }
  }

  const sleep = (ms) => new Promise((resolve) => setTimeout(() => resolve(), ms));

  const promise = (callback) => {
    return new Promise((resolve, reject) => {
      try {
        const res = callback();
        resolve(res);
      }
      catch(e) {
        reject(e);
      }
    });
  };

  const lockFor = (lock, unlock, callback, config) => {
    return new Promise(async (resolve, reject) => {
      try {
        while(true) {
          const {timeout_ms, timeslice_ms} = config;
          const start_ms = new Date().getTime();
          if(lock()) {
            const res = callback();
            unlock();
            resolve(res);
            return;
          }
          await sleep(timeslice_ms);
          if(timeout_ms <= new Date().getTime() - start_ms) {
            driver.error('Timeout');
            return;
          }
        }
      }
      catch(e) {
        unlock();
        reject(e);
      }
    });
  };

  return (...args) => new SessionDriver(...args);
})();

if(!this.window) module.exports = SessionDriver;
