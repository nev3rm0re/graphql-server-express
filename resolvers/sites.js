const fs = require('fs');
const util = require('util');
const dotenv = require('dotenv');

const readFile = util.promisify(fs.readFile);

module.exports = {};
module.exports.typeDefs = `
    extend type Query {
        sites: [Site]
    }

    type Site {
        env: String
        sitename: String
        migrated: Boolean
        retroactive: Boolean
    }
`;

const getInfoForSite = async (sitename, getConnection) => {
  const fullpath = process.env.SITES_CONFIG_FOLDER + '/.env.' + sitename;
  const contents = await readFile(fullpath);
  const vars = dotenv.parse(contents);

  const targetDbName =
    vars['TARGET_DATABASE_NAME'] || vars['MIGRATION_SITENAME'] + '_target';

  let migrated = false;
  try {
    const conn = await getConnection(targetDbName);
    const tables = await conn.query('SHOW TABLES LIKE "%_migration"');
    migrated = tables.length > 0;
  } catch (e) {
    migrated = false;
  }

  return {
    env: sitename,
    sitename: vars['MIGRATION_SITENAME'],
    migrated,
  };
};

module.exports.resolvers = {
  Query: {
    sites: async (_, args, context) => {
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

      return await Promise.all(siteNames);
    },
  },
};
