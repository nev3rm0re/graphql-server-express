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

const getInfoForSite = async (sitename) => {
  const fullpath = process.env.SITES_CONFIG_FOLDER + '/.env.' + sitename;
  const contents = await readFile(fullpath);
  const vars = dotenv.parse(contents);
  return {
    env: sitename,
    sitename: vars['MIGRATION_SITENAME'],
  };
};

module.exports.resolvers = {
  Query: {
    sites: async () => {
      const files = fs.readdirSync(process.env.SITES_CONFIG_FOLDER);
      const siteNames = files.reduce((carry, envFile) => {
        const matchSitename = envFile.match(/\.env\.(?<sitename>[a-z0-9_-]*)/);
        if (matchSitename) {
          carry.push(getInfoForSite(matchSitename.groups['sitename']));
        }

        return carry;
      }, []);

      return await Promise.all(siteNames);
    },
  },
};
