const mysql = require('mysql2/promise');
const pools = {};

const getConnection = async (databaseName = process.env.DEBUG_TARGET_NAME) => {
  if (!pools[databaseName]) {
    pools[databaseName] = mysql.createPool({
      host: 'localhost',
      user: 'root',
      password: '',
      port: 3307,
      database: databaseName,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });
  }
  return await pools[databaseName];
};

module.exports = getConnection;
