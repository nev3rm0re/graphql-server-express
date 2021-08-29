const mysql = require('mysql2/promise');
const fs = require('fs');
const dotenv = require('dotenv');

const { fetchSiteInfo } = require('./sitesadmin.js');

const { config } = require('./config/phpbb.js');

const { getEntityCount, findMissing, getSourceIDs } = require('./report.js');

const getConnection = async (databaseName = process.env.DEBUG_TARGET_NAME) => {
  return mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    port: 3307,
    database: databaseName,
  });
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
  Query: {},
  MissingEntityReport: {},
  SkippedEntry: {},
  MissingEntry: {},
  EntityReport: {},
  EntityConfiguration: {},
};

module.exports = {
  site: async ({ sitename }) => {
    const { data } = await fetchSiteInfo(sitename);
    if (data.status) {
      const siteInfo = JSON.parse(data.message);
      return siteInfo;
    } else {
      throw new Error(data.message);
    }
  },
  missingReport: async () => {
    const entity = 'private_message';
    const entityConfig = config.entities.find((value) => value.name === entity);
    const sourceDB = await getConnection(process.env.DEBUG_SOURCE_NAME);
    const targetDB = await getConnection(process.env.DEBUG_TARGET_NAME);

    const [migratedCount, { count: sourceCount }] = await Promise.all([
      getMigratedCount(targetDB, entityConfig.logKey),
      getEntityCount(sourceDB, entity),
    ]);
    const missingCount = sourceCount - migratedCount;

    const missing = await findMissing(
      { source: sourceDB, target: targetDB },
      'private_message',
    );
    return [
      {
        title: entityConfig.title,
        key: entityConfig.name,
        sourceCount,
        migratedCount,
        missingCount,
        skippedCount: 1,
        skipped: [
          {
            reason: 'File was not found on source',
            count: 1,
          },
        ],
        missing,
      },
    ];
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
  migrationReport: async () => {
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
  entityConfiguration: ({ contentType }) => {
    return config.entities.find((el) => el.name === contentType) ?? null;
  },
  sourceReport: async () => {
    const connection = await getConnection(process.env.DEBUG_SOURCE_NAME);
    const promises = config.entities.reduce((carry, entity) => {
      carry.push(getEntityCount(connection, entity.name));
      return carry;
    }, []);

    // const columns = ['attach_id'].join(', ');
    // const attachmentReport = await getEntityCount(connection, 'attachment');
    // const categoryReport = await getEntityCount(connection, 'category');
    // const forumReport = await getEntityCount(connection, 'forum');
    // const pollReport = await getEntityCount(connection, 'poll');

    return await Promise.all(promises);

    return [attachmentReport, categoryReport, forumReport, pollReport];
  },
};
