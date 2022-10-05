import { Resolver } from 'dns';
import { promisify } from 'util';

const exec = promisify(require('child_process').exec);

export const typeDefs = `
  extend type Query {
    xenforoEntity(entityName: String): EntityData
  }

  type EntityData {
    shortName: String
    contentType: String
    table: String
    primaryKey: String
    columns: [XenforoColumn]
  }

  type XenforoColumn {
    columnName: String
    type: String
    autoIncrement: Boolean
    nullable: Boolean
    default: JSON
    api: Boolean
    maxLength: String
    required: JSON
    censor: Boolean
    allowedValues: [String]
  }
`;
interface XenforoEntityBase {
  entityName: string;
  shortName: string;
  contentType: string;
}

interface XenforoEntity {
  type?: number;
  autoIncrement?: boolean;
  nullable?: boolean;
  default?: string;
  api?: boolean;
  maxLength?: string;
  required?: boolean;
  censor?: boolean;
  allowedValues?: string[];
}

const XenforoTypes: { [key: number]: string } = {
  0x0001: 'INT',
  0x0002: 'UINT',
  0x0003: 'FLOAT',
  0x10004: 'BOOL',
  0x0005: 'STR',
  0x0006: 'BINARY',
  0x10007: 'SERIALIZED',
  0x10009: 'JSON',
  0x10010: 'JSON_ARRAY',
  0x10011: 'LIST_LINES',
  0x10012: 'LIST_COMMA',
};

const xenforoEntity = async (entityName: string) => {
  try {
    const { stdout: entityJson } = await exec(
      'php ./util/queryEntity.php ' + entityName,
    );
    return JSON.parse(entityJson);
  } catch (e: any) {
    console.log(e);
  }
  return null;
};

export const resolvers = {
  Query: {
    xenforoEntity: async (
      _: any,
      { entityName }: { entityName: string },
      context: Resolver,
    ) => {
      const entityDetails = await xenforoEntity(entityName);
      console.log('entityDetails', entityDetails.columns);
      const columns = Object.entries(entityDetails.columns).map(
        (value: [string, unknown | object]) => {
          const [key, el] = value as [string, any];
          const type: string = XenforoTypes[parseInt(el.type)];
          console.log('Mapping columns. El:', el, '; Key:', key);
          return {
            ...el,
            columnName: key,
            type,
          };
        },
      );
      return { ...entityDetails, columns };
    },
  },
};
