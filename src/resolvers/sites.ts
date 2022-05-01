import fs from 'fs';
import util from 'util';
import dotenv from 'dotenv';
import { ResolverContext } from '../server';

const readFile = util.promisify(fs.readFile);

export const typeDefs = `
    extend type Query {
        sites(requireSource: Boolean = null): [Site]
    }

    type Site {
        env: String
        sitename: String
        migrated: [String]
        retroactive: Boolean
        source: Boolean
    }
`;

interface SiteInfo {
  env: string;
  sitename: string;
  migrated: [string];
  retroactive: boolean;
  source: boolean;
}

const getInfoForSite = async (
  sitename: string,
  getConnection: any,
): Promise<SiteInfo> => {
  const fullpath = process.env.SITES_CONFIG_FOLDER + '/.env.' + sitename;
  const contents = await readFile(fullpath);
  const vars = dotenv.parse(contents);

  const targetDbName =
    vars['TARGET_DATABASE_NAME'] || vars['MIGRATION_SITENAME'] + '_target';
  const sourceDbName =
    vars['SOURCE_DATABASE_NAME'] || vars['MIGRATION_SITENAME'] + '_source';

  let migrated = [];
  let source = false;
  let retro = false;

  try {
    const sourceDb = await getConnection(sourceDbName);
    const sourceTables = await sourceDb.query('SHOW TABLES');
    source = sourceTables.length > 0;

    const conn = await getConnection(targetDbName);
    const [resultSet] = await conn.query('SHOW TABLES LIKE "%_migration"');
    migrated = resultSet.map((row: string[]) => Object.values(row)[0]);

    const retroTables = await conn.query('SHOW TABLES LIKE "%retroactive%"');
    retro = retroTables.length > 0;
  } catch (e) {
    console.error('Got an expected error querying DB.', e);
  }

  return {
    env: sitename,
    sitename: vars['MIGRATION_SITENAME'],
    migrated,
    source,
    retroactive: retro,
  };
};

export const resolvers = {
  Query: {
    sites: async (
      parent: any,
      { requireSource = false },
      context: ResolverContext,
    ) => {
      const files = fs.readdirSync(process.env.SITES_CONFIG_FOLDER || '.');
      const siteNames = files.reduce((carry: Promise<SiteInfo>[], envFile) => {
        const matchSitename = envFile.match(/\.env\.(?<sitename>[a-z0-9_-]+)/);
        if (matchSitename && matchSitename.groups) {
          const sitename = matchSitename.groups.sitename;
          carry.push(getInfoForSite(sitename, context.connectionManager));
        }

        return carry;
      }, []);

      const ret = await Promise.all(siteNames);
      if (requireSource === true) {
        return ret.filter((el) => Boolean(el.source));
      }

      return ret;
    },
  },
};
