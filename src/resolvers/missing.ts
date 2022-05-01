import mysql from 'mysql2/promise';
const getConnection = require('../database');
const report = require('../report');

const ATTACHMENT = {
  primaryKey: 'attachment_id',
  entityTable: 'xf_attachment',
  migrationTable: 'VbClassifieds_migration',
  contentType: 'attachment',
};

const getSourceIDs = async (
  connection: mysql.PoolConnection,
  { query, primaryKey }: { query: string; primaryKey: string },
): Promise<string[]> => {
  const [rows] = await connection.query<mysql.RowDataPacket[]>(query);
  return rows.map((record: any) => record[primaryKey]);
};

const VbClassifieds = {
  IMAGES: {
    query: `
SELECT imageid
  FROM vbclassified_uploads AS uploads
 ORDER BY imageid ASC`,
    primaryKey: 'imageid',
  },
};

export const typeDefs = `
    extend type Query {
        missingEntities: [JSON]
    }
`;

export const resolvers = {
  Query: {
    missingEntities: async () => {
      const source = await getConnection('rimfirecentral.com_source');
      const target = await getConnection('rimfirecentral.com_target');

      const sourceIds = await getSourceIDs(source, VbClassifieds.IMAGES);
      const targetIds = await report.getTargetIDs(target, ATTACHMENT, 'old_id');
      const targetSet = new Set(targetIds);
      const missingIds = sourceIds.filter((x) => !targetSet.has(x));

      console.log('Missing ID count', missingIds.length);

      const inClause = "'" + missingIds.join("','") + "'";
      const [reasons] = await target.query(
        `
SELECT CAST(old_id AS integer) AS old_id,
       message,
       class_method,
       class_line,
       context 
  FROM vs_migration_logs
WHERE content_type = 'attachment'
  AND old_id IN (${inClause})`,
      );

      const reasonsById = reasons.reduce(
        (acc: any, record: { old_id: string }) => {
          acc[record.old_id] = record;
          return acc;
        },
        {},
      );
      console.log('Reasons', reasonsById);

      const getSourceImages = async (
        target: mysql.PoolConnection,
        ids: string[],
      ): Promise<any[]> => {
        const idsJoined = ids.join(',');
        const sql = `
SELECT uploads.*,
       classifieds.dateline,
       classifieds.views,
       classifieds.userid,
       IF(classifieds.image = uploads.image, true, false) AS isThumbnail
  FROM vbclassified_uploads AS uploads
       INNER JOIN vbclassified AS classifieds
               ON classifieds.classifiedid = uploads.classifiedid
 WHERE uploads.imageid IN (${idsJoined})
 ORDER BY uploads.imageid`;
        const [rows] = await target.query<mysql.RowDataPacket[]>(sql);
        return [rows, sql];
      };

      const [sourceImages, query] = await getSourceImages(source, missingIds);

      return sourceImages.map((image: any) => {
        const id = image[VbClassifieds.IMAGES.primaryKey];
        return {
          ...image,
          reason: reasonsById[id] ? reasonsById[id].message : null,
        };
      });
    },
  },
};
