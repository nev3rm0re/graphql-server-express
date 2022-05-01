import mysql from 'mysql2/promise';

const pools: { [dbName: string]: mysql.Pool } = {};

/**
 * Returns MySQL Connection pool configured for `databaseName`
 */
export const getConnection = async (
  databaseName: string = process.env.DEBUG_TARGET_NAME || '',
): Promise<mysql.Pool> => {
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
