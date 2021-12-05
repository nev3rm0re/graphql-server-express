const fs = require('fs');
const util = require('util');
const dotenv = require('dotenv');

const readFile = util.promisify(fs.readFile);

module.exports = {};
module.exports.typeDefs = `
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

const getInfoForSite = async (sitename, getConnection) => {
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
    const tables = await conn.query('SHOW TABLES LIKE "%_migration"');
    migrated = tables;

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

module.exports.resolvers = {
  Query: {
    sites: async (_, { requireSource = false }, context) => {
      const files = fs.readdirSync(process.env.SITES_CONFIG_FOLDER);
      const siteNames = files.reduce((carry, envFile) => {
        const matchSitename = envFile.match(/\.env\.(?<sitename>[a-z0-9_-]*)/);
        if (matchSitename) {
          carry.push(
            getInfoForSite(
              matchSitename.groups['sitename'],
              context.connectionManager,
            ),
          );
        }

        return carry;
      }, []);

      const ret = await Promise.all(siteNames);
      if (requireSource === true) {
        return ret.filter((el) => Boolean(el.source));
      }
    },
  },
};
