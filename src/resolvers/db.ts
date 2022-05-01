import mysql from 'mysql2/promise';

export const typeDefs = `
        extend type Query {
            tables(database: String): [Table]
        }

        type Table {
            name: String
        }
    `;

interface ResolverContext {
  connectionManager(name: string): Promise<mysql.Pool>;
}

export const resolvers = {
  Query: {
    tables: async (
      _: any,
      { database }: { database: string },
      context: ResolverContext,
    ) => {
      const conn = await mysql.createPool({
        host: 'localhost',
        port: 3307,
        user: 'root',
        password: '',
        database,
      });

      const [rows, fields] = await conn.execute<mysql.RowDataPacket[]>(
        'SHOW TABLES',
      );
      console.log(
        'Got rows',
        rows[1]['Tables_in_coffeeforums.co.uk_source'],
        fields[0].name,
      );
      return rows.map((record) => ({ name: record[fields[0].name] }));
    },
  },
};
