const fs = require('fs');
const dotenv = require('dotenv');

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

module.exports.resolvers = {
  Query: {
    sites: () => {
      const files = fs.readdirSync(process.env.SITES_CONFIG_FOLDER);
      const siteNames = files.reduce((carry, envFile) => {
        const matchSitename = envFile.match(/\.env\.(?<sitename>[a-z0-9_-]*)/);

        if (matchSitename) {
          const fullpath = process.env.SITES_CONFIG_FOLDER + envFile;
          const contents = fs.readFileSync(fullpath);
          const vars = dotenv.parse(contents);
          carry.push({
            env: matchSitename.groups['sitename'],
            sitename: vars['MIGRATION_SITENAME'],
          });
        }

        return carry;
      }, []);

      return siteNames;
    },
  },
};
