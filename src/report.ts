const { config } = require('../config/phpbb.js');
import mysql from 'mysql2/promise';

interface CountResult extends mysql.RowDataPacket {
  count: string;
}

const getEntityCount = async (
  connection: mysql.Pool,
  contentType: string,
): Promise<{
  contentType: string;
  count: number;
}> => {
  const selectPart = 'COUNT(*) AS count';

  const entity = config.entities.find(
    (entity: any) => entity.name === contentType,
  );

  const [rows, fields] = await connection.query<CountResult[]>(
    entity.count
      ? prefix`${entity.count}`
      : prefix`
     SELECT ${selectPart}
       FROM \`${entity.table}\`
       WHERE ${entity.where}
  `,
  );

  return {
    contentType,
    count: parseInt(rows[0]['count']),
  };
};
const SITE_PREFIX = 'phpbb_';

const prefix = (strings: any, ...vars: any[]) => {
  let result = '';
  // glue string from parts first
  strings.forEach((str: string, i: number) => {
    result += `${str}${i === strings.length - 1 ? '' : vars[i]}`;
  });

  return result.replace(/`([^`]*)`/g, SITE_PREFIX + '$1');
};
const findMissing = async (
  { source, target }: { source: mysql.Pool; target: mysql.Pool },
  entity: any,
) => {
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
  const missingIDs = sourceIDs.filter((x: number) => !targetSet.has(x));
  // console.timeEnd('algo2');
  console.log('Counted ', missingIDs.length, 'missing IDs');

  const [sourceMissing, fields] = await source.query<mysql.RowDataPacket[]>(
    prefix`
      SELECT * FROM \`privmsgs\` WHERE msg_id IN (?)
      `,
    [missingIDs],
  );

  return sourceMissing.map((x) => ({ id: x.msg_id, data: x }));
};

const getSourceIDs = async (connection: mysql.Pool, entity: any) => {
  const [rows, fields] = await connection.query<mysql.RowDataPacket[]>(
    prefix`
      SELECT pm.msg_id AS source_id FROM \`privmsgs\` AS pm
    `,
  );

  return rows.map(({ source_id }) => source_id);
};
/**
 * Gets list of IDs from the target DB
 * Expects a parameter defining parameters needed to look them up
 */
const getTargetIDs = async (
  connection: mysql.Pool,
  { primaryKey, entityTable, migrationTable, contentType }: any,
  field = 'target_id',
) => {
  try {
    const query = `
    SELECT ${primaryKey} AS target_id,
           m.old_id
      FROM ${entityTable} AS cm
           INNER JOIN ${migrationTable} AS m
                   ON (m.new_id = ${primaryKey} 
                  AND m.content_type = ?)`;
    const [rows, fields] = await connection.query<mysql.RowDataPacket[]>(
      query,
      [contentType],
    );
    return rows.map((record) => parseInt(record[field]));
  } catch (err: any) {
    if (err.sql && err.sqlMessage) {
      throw new Error(`Error in query - ${err.sqlMessage}\n${err.sql}`);
    } else {
      throw err;
    }
  }
};
export { getEntityCount, prefix, findMissing, getSourceIDs, getTargetIDs };
