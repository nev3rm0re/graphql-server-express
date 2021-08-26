const dotenv = require('dotenv');
dotenv.config();

const express = require('express');

const { graphqlHTTP } = require('express-graphql');
const { buildSchema } = require('graphql');
const { makeExecutableSchema } = require('@graphql-tools/schema');
const mysql = require('mysql2/promise');
const cors = require('cors');
const fs = require('fs');
const axios = require('axios');

const SITE_PREFIX = 'phpbb_';
const sitesadminClient = axios.create({
  baseURL: process.env.SITESADMIN_URL,
});

const getConnection = async (databaseName = process.env.DEBUG_TARGET_NAME) => {
  return mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    port: 3307,
    database: databaseName,
  });
};

const prefix = (strings, ...vars) => {
  let result = '';
  // glue string from parts first
  strings.forEach((str, i) => {
    result += `${str}${i === strings.length - 1 ? '' : vars[i]}`;
  });

  return result.replace(/`([^`]*)`/g, SITE_PREFIX + '$1');
};

var schema = makeExecutableSchema({
  typeDefs: fs.readFileSync('./schema/schema.gql', 'utf8'),
});

const { config: defaults } = require('./config/phpbb.js');

const getEntityCount = async (connection, contentType) => {
  const selectPart = 'COUNT(*) AS count';

  const entity = ({ name, table, where } = config.entities.find(
    (entity) => entity.name === contentType,
  ));

  const [rows, fields] = await connection.query(
    entity.count
      ? prefix`${entity.count}`
      : prefix`
     SELECT ${selectPart}
       FROM \`${table}\`
       WHERE ${where}
  `,
  );

  return {
    contentType,
    count: rows[0]['count'],
  };
};

const fetchSiteInfo = async (sitename) => {
  return await sitesadminClient.post(
    process.env.SITESADMIN_URL + '/api/fetchSite',
    'sitename=' + sitename.toLowerCase(),
    {
      headers: {
        apiKey: process.env.SITESADMIN_KEY,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    },
  );
};

const getMigratedCount = async (connection, entity) => {
  const [rows, fields] = await connection.query(
    `SELECT COUNT(import_log_id) AS count
       FROM \`PhpBb_migration\`
      WHERE content_type = "${entity}"
                `,
  );
  console.log(rows);

  return parseInt(rows[0]['count']);
};

const getSourceIDs = async (connection, entity) => {
  const [rows, fields] = await connection.query(
    prefix`
      SELECT pm.msg_id AS source_id FROM \`privmsgs\` AS pm
    `,
  );

  return rows.map(({ source_id }) => source_id);
};
const getTargetIDs = async (
  connection,
  { primaryKey, entityTable, migrationTable, contentType },
) => {
  try {
    const [rows, fields] = await connection.query(
      `
    SELECT ${primaryKey} AS target_id 
      FROM ${entityTable} AS cm
           INNER JOIN ${migrationTable} AS m
           ON (
              m.new_id = ${primaryKey}
              AND m.content_type = ?
              )`,
      [contentType],
    );
    return rows.map(({ target_id }) => target_id);
  } catch (err) {
    if (err.sql && err.sqlMessage) {
      throw new Error(`Error in query - ${err.sqlMessage}\n${err.sql}`);
    } else {
      throw err;
    }
  }
};

const findMissing = async ({ source, target }, entity) => {
  const sourceIDs = await getSourceIDs(source, entity);
  const targetIDs = await getTargetIDs(target, {
    migrationTable: 'PhpBb_migration',
    primaryKey: 'cm.conversation_id',
    entityTable: 'xf_conversation_master',
    contentType: 'conversation',
  });

  // This one takes 11 seconds
  // console.time('algo1');
  // const missingIDs = sourceIDs.filter((x) => !targetIDs.includes(x));
  // console.timeEnd('algo1');

  // This one took 17ms
  // console.time('algo2');
  const targetSet = new Set(targetIDs);
  const missingIDs = sourceIDs.filter((x) => !targetSet.has(x));
  // console.timeEnd('algo2');
  console.log('Counted ', missingIDs.length, 'missing IDs');

  const [sourceMissing, fields] = await source.query(
    prefix`
      SELECT * FROM \`privmsgs\` WHERE msg_id IN (?)
      `,
    [missingIDs],
  );

  return sourceMissing.map((x) => ({ id: x.msg_id, data: x }));
};

const root = {
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

const app = express();

app.use(cors());
app.use(
  '/graphql',
  graphqlHTTP({
    schema,
    rootValue: root,
    graphiql: true,
  }),
);

module.exports = { app };
