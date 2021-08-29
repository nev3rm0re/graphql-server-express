const mysql = require('mysql2/promise');
const fs = require('fs');
const dotenv = require('dotenv');

const { fetchSiteInfo } = require('./sitesadmin.js');

const { config } = require('./config/phpbb.js');

const { getEntityCount, findMissing, getSourceIDs } = require('./report.js');

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
  return await pools[databaseName].getConnection();
};
const getMigratedCount = async (connection, entity) => {
  const [rows, fields] = await connection.query(
    `SELECT COUNT(import_log_id) AS count
       FROM \`PhpBb_migration\`
      WHERE content_type = "${entity}"
    `,
  );
  return parseInt(rows[0]['count']);
};

const resolvers = {
  Query: {
    site: async (parent, { sitename }) => {
      return await fetchSiteInfo(sitename);
    },
    migrationReport: async (_, { sitename }) => {
      const connection = await getConnection();
      const [rows, fields] = await connection.query(
        `SELECT 
                    content_type,
                    COUNT(import_log_id) AS count
                   FROM \`PhpBb_migration\`
                   GROUP BY content_type
                `,
      );

      return rows.map(({ content_type, count }) => ({
        contentType: content_type.toString(),
        count: parseInt(count.toString()),
      }));
    },
    missingReport: async (_, params) => {
      return config.entities.map((config) => {
        return {
          ...config,
          key: config.name,
          title: config.title || config.name,
        };
      });
    },
    entityConfiguration: (_, { contentType }) => {
      return config.entities.find((el) => el.name === contentType) ?? null;
    },
    sites: () => {
      const files = fs.readdirSync(process.env.SITES_CONFIG_FOLDER);
      const siteNames = files.reduce((carry, envFile) => {
        const matchSitename = envFile.match(/\.env\.(?<sitename>[a-z0-9_-]*)/);

        if (matchSitename) {
          console.log(matchSitename);
          const fullpath = process.env.SITES_CONFIG_FOLDER + envFile;
          const contents = fs.readFileSync(fullpath);
          const vars = dotenv.parse(contents);
          carry.push(
            `${matchSitename.groups['sitename'] ?? 'N/A'}: ${
              vars['MIGRATION_SITENAME']
            }`,
          );
        }

        return carry;
      }, []);

      return siteNames;
    },
  },
  MissingEntityReport: {
    sourceCount: async (parent, args, context) => {
      const sourceDB = await getConnection(process.env.DEBUG_SOURCE_NAME);
      const sourceCount = await getEntityCount(sourceDB, parent.name);
      return sourceCount.count;
    },
    migratedCount: async (parent, args, context) => {
      const targetDB = await getConnection(process.env.DEBUG_TARGET_NAME);
      const migratedCount = await getMigratedCount(targetDB, parent.logKey);
      return migratedCount;
    },
    missingCount: async (parent, args, context) => {
      const targetDB = await getConnection(process.env.DEBUG_TARGET_NAME);
      const { count: migratedCount } = await getMigratedCount(
        targetDB,
        parent.logKey,
      );
      const sourceDB = await getConnection(process.env.DEBUG_SOURCE_NAME);
      const { count: sourceCount } = await getEntityCount(
        sourceDB,
        parent.name,
      );

      return sourceCount - migratedCount;
    },
    missing: async (parent, args, context) => {
      const sourceDB = await getConnection(process.env.DEBUG_SOURCE_NAME);
      const targetDB = await getConnection(process.env.DEBUG_TARGET_NAME);
      return await findMissing(
        { source: sourceDB, target: targetDB },
        parent.name,
      );
    },
  },
  SkippedEntry: {},
  MissingEntry: {},
  EntityReport: {},
  EntityConfiguration: {},
};

module.exports = {
  resolvers,
};
