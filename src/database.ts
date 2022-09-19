import mysql, { RowDataPacket } from 'mysql2/promise';
import Pool from 'mysql2/typings/mysql/lib/Pool';

const pools: { [dbName: string]: mysql.Pool } = {};

const createPool = async (database: string): Promise<mysql.Pool> => {
  return await mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '',
    database,
    port: 3307,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });
};

/**
 * Returns MySQL Connection pool configured for `databaseName`
 */
export const getConnection = async (
  databaseName: string = process.env.DEBUG_TARGET_NAME || '',
): Promise<mysql.Pool> => {
  if (!pools[databaseName]) {
    pools[databaseName] = await createPool(databaseName);
  }
  return pools[databaseName];
};

export const getDatabases = async (like: string = '%'): Promise<string[]> => {
  const pool = await mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '',
    port: 3307,
    connectionLimit: 10,
  });

  let databaseQuery = 'SHOW DATABASES';
  if (like !== '%') {
    databaseQuery += ` LIKE '${like}'`;
  }

  console.log('Running query', databaseQuery);
  const [result] = await pool.query(databaseQuery);
  const results = Object.values(result).map(
    (textRow: RowDataPacket): string => {
      console.log('textRow', textRow);
      return Object.values(textRow)[0];
    },
  );
  console.log('Results', results);
  return results;
};
