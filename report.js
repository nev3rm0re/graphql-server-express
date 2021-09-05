const { config } = require('./config/phpbb.js');

const getEntityCount = async (connection, contentType) => {
  const selectPart = 'COUNT(*) AS count';

  const entity = ({ table, where } = config.entities.find(
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
const SITE_PREFIX = 'phpbb_';

const prefix = (strings, ...vars) => {
  let result = '';
  // glue string from parts first
  strings.forEach((str, i) => {
    result += `${str}${i === strings.length - 1 ? '' : vars[i]}`;
  });

  return result.replace(/`([^`]*)`/g, SITE_PREFIX + '$1');
};
const findMissing = async ({ source, target }, entity) => {
  if (!config.mapping[entity]) {
    return [];
  }
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
module.exports = {
  getEntityCount,
  prefix,
  findMissing,
  getSourceIDs,
  getTargetIDs,
};
