import mysql, { Field, RowDataPacket } from 'mysql2/promise';

export const typeDefs = `
  extend type Query {
    tables(database: String): [Table]
    items(database: String, query: String): [ItemInfo]
    # Lists all of databases on the server
    databases: [String]
    tableAnalysis(database: String, table: String): [Field]
    multiQuery(databases: [String], query: String): [MultiQueryResult]
  }

  type Table {
    name: String
  }

  type Field {
    name: String
    count: Int
    isNullable: Boolean
    distinctCount: String
    distinctPercentage: String
    distincts(limit:Int = 7): [JSON]
    emptyCount: Int 
    comment: String
    totalCount: Int
  }

  type ItemInfo {
    name: String
    type: String
  }

  type DBResult {
    rows: JSON
    rowCount: Int
  }

  type MultiQueryResult {
    database: String
    isError: Boolean
    result: DBResult
  }
`;

interface ResolverContext {
  connectionManager(name: string): Promise<mysql.Pool>;
  getDatabases(like?: string): Promise<string[]>;
}

async function createConnection(database: string): Promise<mysql.Pool> {
  return await mysql.createPool({
    host: 'localhost',
    port: 3307,
    user: 'root',
    password: '',
    database,
  });
}

declare interface FieldPacket2 extends mysql.FieldPacket {
  columnType: string;
  columnLength: number;
}

const fieldMap: { [key: string]: string } = {
  '1': 'tinyint',
  '3': 'integer unsigned',
  '4': 'float',
  '252': 'blob',
  '254': 'enum',
  '253': 'varchar',
};

async function items(
  _: any,
  { database, query }: { database: string; query: string },
  context: ResolverContext,
) {
  const conn = await context.connectionManager(database);

  const results = await conn.execute<mysql.RowDataPacket[]>(
    'SELECT * FROM ' + query + ' LIMIT 1',
  );

  const fields = <FieldPacket2[]>results[1];

  return fields.map((field) => {
    return {
      name: field['name'],
      type:
        (fieldMap[field['columnType']] || field['columnType']) +
        '(' +
        field['columnLength'] +
        ')', // <mysql.FieldPacket>field['columnType'],
    };
  });
}

const fetchAll = async (db: mysql.Pool, query: string) => {
  const [rows] = await db.query(query);
  return Object.values(rows);
};
const fetchColumn = async (db: mysql.Pool, query: string) => {
  const [rows] = await db.query(query);
  return Object.values(rows).map((row) => {
    return Object.values(row)[0];
  });
};

const fetchOne = async (db: mysql.Pool, query: string) => {
  const [rows] = await db.query(query);
  return Object.values(Object.values(rows)[0])[0];
};

const tableAnalysis = async (
  _: any,
  {
    database,
    table,
    distinctsLimits = 7,
  }: {
    database: string;
    table: string;
    distinctsLimits: number;
  },
  context: ResolverContext,
) => {
  const db = await context.connectionManager(database);
  const [rows] = await db.query(
    `
    SELECT * 
      FROM information_schema.columns 
     WHERE table_schema = ? 
       AND table_name = ?
    `,
    [database, table],
  );
  const fields = Object.values(rows).map((el) => {
    return {
      name: el.COLUMN_NAME,
      isNullable: el.IS_NULLABLE === 'YES',
      comment: el.COLUMN_COMMENT,
    };
  });
  // now collect distinct counts
  const countPromises = fields.map(async ({ name, isNullable, comment }) => {
    const emptyCount = await fetchOne(
      db,
      `SELECT COUNT(*) FROM ${table} WHERE ${name} = ""`,
    );

    return {
      database,
      table,
      name,
      comment,
      distincts: { database, table },
      isNullable,
      emptyCount,
    };
  });
  const result = await Promise.all(countPromises);
  return result;
};

const multiQuery = async (
  _: any,
  {
    databases,
    query,
    like = '%_source',
  }: { databases: string[]; query: string; like: string },
  context: ResolverContext,
) => {
  const dbs = databases.length ? databases : await context.getDatabases(like);
  const promises = dbs.map(async (database) => {
    const dbCon = await context.connectionManager(database);
    try {
      const [result] = await dbCon.query(query);
      return {
        database,
        isError: false,
        result: {
          rowCount: Object.values(result).length,
          rows: result,
        },
      };
    } catch (e) {
      if (e instanceof Error) {
        return {
          database,
          isError: true,
          result: {
            rowCount: null,
            message: e.message,
          },
        };
      }

      return {
        database,
        isError: true,
        result: {
          rowCount: null,
          message: e,
        },
      };
    }
  });
  const results = await Promise.all(promises);
  return results;
};

const distinctCount = async (
  parent: any,
  args: any,
  context: ResolverContext,
): Promise<number> => {
  const db = await context.connectionManager(parent.database);
  const result: any = await fetchOne(
    db,
    `SELECT COUNT(DISTINCT ${parent.name}) AS c FROM ${parent.table}`,
  );
  return parseInt(result);
};

const totalCount = async (
  db: mysql.Pool,
  database: string,
  table: string,
): Promise<number> => {
  const result: any = await fetchOne(db, 'SELECT COUNT(*) FROM ' + table);
  return parseInt(result);
};

export const resolvers = {
  Query: {
    items,
    databases: async (_: any, _2: any, context: ResolverContext) => {
      return context.getDatabases();
    },
    tableAnalysis,
    multiQuery,
    tables: async (
      _: any,
      { database }: { database: string },
      context: ResolverContext,
    ) => {
      const conn = await context.connectionManager(database);
      const [rows, fields] = await conn.execute<mysql.RowDataPacket[]>(
        'SHOW TABLES',
      );
      return rows.map((record) => ({ name: record[fields[0].name] }));
    },
  },
  Field: {
    distincts: async (parent: any, args: any, context: ResolverContext) => {
      const db = await context.connectionManager(parent.distincts.database);
      const countDistincts = await distinctCount(parent, args, context);

      const distincts =
        countDistincts > (args.limit || 7)
          ? null
          : await fetchAll(
              db,
              `
            SELECT ${parent.name} AS value, 
                   COUNT(*) AS records
              FROM ${parent.distincts.table} 
             GROUP BY ${parent.name}
            `,
            );
      return distincts;
      console.log('Getting distincts', parent, args);
    },
    distinctCount,
    totalCount: async (parent: any, args: any, context: ResolverContext) => {
      return totalCount(
        await context.connectionManager(parent.database),
        parent.database,
        parent.table,
      );
    },
    distinctPercentage: async (
      parent: { database: string; table: string },
      args: any,
      context: ResolverContext,
    ) => {
      const { database, table } = parent;
      const db = await context.connectionManager(database);
      const countDistincts: number = await distinctCount(parent, args, context);
      const countTotal: number = await totalCount(db, database, table);
      return (Math.round(countDistincts / countTotal) * 10000) / 100 + '%';
    },
  },
};
