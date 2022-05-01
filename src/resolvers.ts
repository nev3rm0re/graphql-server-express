import mysql from 'mysql2/promise';
import fs from 'fs';
import dotenv from 'dotenv';
import { GraphQLJSON } from 'graphql-type-json';

import php from './php';

import { fetchSiteInfo } from './resolvers/sitesadmin';

const { config } = require('../config/phpbb.js');

import { getEntityCount, findMissing, getSourceIDs } from './report';

interface CountResult extends mysql.RowDataPacket {
  count: string;
}

const getMigratedCount = async (
  connection: mysql.Pool,
  entity: string,
): Promise<number> => {
  const [rows, fields] = await connection.query<CountResult[]>(
    `SELECT COUNT(import_log_id) AS count
       FROM \`PhpBb_migration\`
      WHERE content_type = "${entity}"
    `,
  );
  return parseInt(rows[0]['count']);
};

interface ResolverContext {
  connectionManager(name: string): Promise<mysql.Pool>;
}

interface SiteParameters {
  sitename: string;
}
interface UnserializeParameters {
  input: string;
  outputFormat: 'json' | 'php';
}

interface ContentTypeCount extends mysql.RowDataPacket {
  content_type: string;
  count: string;
}

const resolvers = {
  JSON: GraphQLJSON,
  Query: {
    echo: (parent: object, { message }: { message: string }): string => {
      return message;
    },
    site: (parent: object, { sitename }: SiteParameters) => {
      return fetchSiteInfo(sitename);
    },
    unserialize: async (
      _: any,
      { input, outputFormat = 'json' }: UnserializeParameters,
    ) => {
      try {
        const out = await php.unserialize(input, outputFormat);
        console.log('Returning out', out);
        return out.stdout;
      } catch (e: any) {
        console.log('Error', e);
        return new Error(e.stderr);
      }
    },
    migrationReport: async (
      _: any,
      { sitename }: SiteParameters,
      context: ResolverContext,
    ) => {
      const connection = await context.connectionManager(
        process.env.DEBUG_TARGET_NAME || '',
      );
      const [rows, fields] = await connection.query<ContentTypeCount[]>(
        `SELECT content_type,
                COUNT(import_log_id) AS count
           FROM \`PhpBb_migration\`
          GROUP BY content_type`,
      );

      return rows.map(({ content_type, count }: ContentTypeCount) => ({
        contentType: content_type.toString(),
        count: parseInt(count.toString()),
      }));
    },
    missingReport: async () => {
      return config
        .getEntities()
        .map((config: { title: string; name: string }) => {
          return {
            ...config,
            key: config.name,
            title: config.title || config.name,
          };
        });
    },
    entityConfiguration: (_: any, { contentType }: { contentType: string }) => {
      return (
        config.entities.find(
          (el: { name: string }) => el.name === contentType,
        ) ?? null
      );
    },
    sites: () => {
      const files = fs.readdirSync(process.env.SITES_CONFIG_FOLDER || '.');
      const siteNames = files.reduce((carry: string[], envFile: string) => {
        const matchSitename = envFile.match(/\.env\.(?<sitename>[a-z0-9_-]*)/);

        if (matchSitename) {
          console.log(matchSitename);
          const fullpath = process.env.SITES_CONFIG_FOLDER + envFile;
          const contents = fs.readFileSync(fullpath);
          const vars = dotenv.parse(contents);

          const sitename = matchSitename.groups!['sitename'] ?? 'N/A';

          carry.push(`${sitename}: ${vars['MIGRATION_SITENAME']}`);
        }

        return carry;
      }, []);

      return siteNames;
    },
  },
  MissingEntityReport: {
    sourceCount: async (
      parent: { name: string },
      args: any,
      context: ResolverContext,
    ) => {
      const sourceDB = await context.connectionManager(
        process.env.DEBUG_SOURCE_NAME || '',
      );
      const sourceCount = await getEntityCount(sourceDB, parent.name);
      return sourceCount.count;
    },
    migratedCount: async (
      parent: { logKey: string },
      args: any,
      context: ResolverContext,
    ) => {
      const targetDB = await context.connectionManager(
        process.env.DEBUG_TARGET_NAME || '',
      );
      const migratedCount = await getMigratedCount(targetDB, parent.logKey);
      return migratedCount;
    },
    missingCount: async (
      parent: { name: string; logKey: string },
      args: any,
      context: ResolverContext,
    ) => {
      const targetDB = await context.connectionManager(
        process.env.DEBUG_TARGET_NAME || '',
      );
      const migratedCount = await getMigratedCount(targetDB, parent.logKey);
      const sourceDB = await context.connectionManager(
        process.env.DEBUG_SOURCE_NAME || '',
      );
      const { count: sourceCount } = await getEntityCount(
        sourceDB,
        parent.name,
      );

      return sourceCount - migratedCount;
    },
    missing: async (
      parent: { name: string },
      args: any,
      context: ResolverContext,
    ) => {
      const sourceDB = await context.connectionManager(
        process.env.DEBUG_SOURCE_NAME || '',
      );
      const targetDB = await context.connectionManager(
        process.env.DEBUG_TARGET_NAME || '',
      );
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

export default resolvers;
