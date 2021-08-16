const dotenv = require('dotenv');
dotenv.config();

const express = require('express');
const { graphqlHTTP } = require('express-graphql');
const { buildSchema } = require('graphql');
const mysql = require('mysql2/promise');
const cors = require('cors');
const fs = require('fs');

const SITE_PREFIX = 'phpbb_';

const getConnection = async (databaseName = 'crxcommunity.com_target') => {
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

var schema = buildSchema(`
    type Query {
        sites: [String]
        migrationReport: [EntityReport]
        sourceReport(software: String! = "phpbb" ): [EntityReport]
        entityConfiguration(contentType: String!): EntityConfiguration
    }
    
    type EntityReport {
        contentType: String
        count: Int
    }

    type EntityConfiguration {
      name: String
      table: String
      select: String
      count: String
    }
    `);

const config = {
  entities: [
    {
      name: 'attachment',
      table: 'attachments',
      where: `is_orphan = 0
				AND post_msg_id > 0
				AND in_message IN (0,1)`,
    },
    {
      name: 'category',
      table: 'forums',
      where: 'forum_type NOT IN (1, 2)',
    },
    {
      name: 'forum',
      table: 'forums',
      where: 'forum_type = 1',
    },
    {
      name: 'poll',
      table: 'polls',
      select: `SELECT DISTINCT(polls.topic_id),
				topics.poll_title, topics.poll_start, topics.poll_length,
				topics.poll_max_options, topics.poll_last_vote, topics.poll_vote_change
			FROM \`poll_options\` AS polls
			INNER JOIN \`topics\` AS topics ON (topics.topic_id = polls.topic_id)
			WHERE topics.poll_title != ''
			ORDER BY polls.topic_id`,
      count: `SELECT COUNT(DISTINCT(polls.topic_id)) AS count
			FROM \`poll_options\` AS polls
			INNER JOIN \`topics\` AS topics ON (topics.topic_id = polls.topic_id)
			WHERE topics.poll_title != ''
			`,
    },
    {
      name: 'thread',
      table: 'topics',
      select: `
        SELECT topics.*, 
               topic_posts_approved AS topic_replies, 
               topic_visibility AS topic_approved,
				       IF(users.username IS NOT NULL, users.username, topics.topic_first_poster_name) AS username
			    FROM topics AS topics FORCE INDEX (PRIMARY)
			         LEFT JOIN users AS users ON (topics.topic_poster = users.user_id)
			         INNER JOIN forums AS forums ON (topics.forum_id = forums.forum_id)
			   ORDER BY topics.topic_id
      `,
      count: `
        SELECT COUNT(*) AS count
			    FROM \`topics\` AS topics FORCE INDEX (PRIMARY)
			         LEFT JOIN \`users\` AS users ON (topics.topic_poster = users.user_id)
			         INNER JOIN \`forums\` AS forums ON (topics.forum_id = forums.forum_id)
			   ORDER BY topics.topic_id
      `,
    },
    {
      name: 'post',
      table: 'posts',
      select: `
        SELECT posts.*, 
               post_visibility AS post_approved,
				       IF(users.username IS NOT NULL, users.username, posts.post_username) AS username
          FROM posts AS posts
               LEFT JOIN users AS users ON (posts.poster_id = users.user_id)
         WHERE posts.topic_id = ?
               AND posts.post_time > ?
         ORDER BY posts.post_time
      `,
      count: `
        SELECT COUNT(*) AS count
          FROM \`posts\` AS posts
               LEFT JOIN \`users\` AS users ON (posts.poster_id = users.user_id)
         WHERE posts.topic_id IN (
               SELECT topic_id
			           FROM \`topics\` AS topics FORCE INDEX (PRIMARY)
			                LEFT JOIN \`users\` AS users ON (topics.topic_poster = users.user_id)
			                INNER JOIN \`forums\` AS forums ON (topics.forum_id = forums.forum_id)
			          ORDER BY topics.topic_id
               )
         ORDER BY posts.post_time
      `,
    },
    {
      name: 'user',
      table: 'users',
      select: `
        SELECT users.*, 
               pfd.*,
               ban.*, 
               users.user_id, 
               1 AS user_dst,
               {$websiteColSql} AS user_website,
               {$interestsColSql} AS user_interests,
               {$locationColSql} AS user_from
          FROM users AS users
               LEFT JOIN profile_fields_data AS pfd ON (pfd.user_id = users.user_id)
               LEFT JOIN banlist AS ban ON (ban.ban_userid = users.user_id AND (ban.ban_end = 0 OR ban.ban_end > NOW()))
			   WHERE users.user_type <> 2
			   ORDER BY users.user_id
      `,
      count: `
        SELECT COUNT(*) AS count
          FROM \`users\` AS users
               LEFT JOIN \`profile_fields_data\` AS pfd ON (pfd.user_id = users.user_id)
               LEFT JOIN \`banlist\` AS ban ON (ban.ban_userid = users.user_id AND (ban.ban_end = 0 OR ban.ban_end > NOW()))
			   WHERE users.user_type <> 2
			   ORDER BY users.user_id
      `,
    },
    {
      name: 'private_message',
      table: 'privmsgs',
      select: `
        SELECT pms.*, users.username
			    FROM \`privmsgs\` AS pms
               LEFT JOIN \`users\` AS users ON (pms.author_id = users.user_id)
         ORDER BY pms.msg_id

      `,
      count: `
        SELECT COUNT(*) AS count
			    FROM \`privmsgs\` AS pms
               LEFT JOIN \`users\` AS users ON (pms.author_id = users.user_id)
         ORDER BY pms.msg_id
      `,
    },
  ],
};

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

const root = {
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
    const connection = await getConnection('crxcommunity.com_source');
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

app.listen(4000);
console.log('Running a GraphQL server at http://localhost:4000/graphql');
