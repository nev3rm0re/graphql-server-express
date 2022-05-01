require('isomorphic-fetch');
import { getConnection } from '../src/database.ts';

const queryServer = (query, variables = {}) => {
  return fetch(
    // 'http://104.154.240.101/graphql',
    'http://localhost:4000/graphql',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        variables,
      }),
    },
  ).then((res) => res.json());
};
describe('Query sites', () => {
  jest.setTimeout(20000);

  test('query missing entities', async () => {
    const result = await queryServer(`query { missingEntities }`, {});
    expect(result.data).toMatchSnapshot();
  });

  test('what the heck mysql2.query returns', async () => {
    const conn = await getConnection('2008ownersclub.co.uk_target');
    try {
      const [result] = await conn.query('SHOW TABLES LIKE "%_migration"');
      const tables = result.map((row) => Object.values(row)[0]);
      console.debug(tables);
    } catch (err) {
      console.error(err);
    }
  });
  test('SITES query returns expected result', async () => {
    expect.assertions = 1;
    const query = `query {
        sites {
          env
          sitename
          migrated
          source
        }
    }`;

    const result = await queryServer(query);
    expect(result.data).toMatchSnapshot();

    console.log('done getting result', result.data);
    return result;
  });

  test('SITES parametrized query returns expected result', async () => {
    expect.assertions = 1;
    const query = `query($requireSource: Boolean) {
      sites(requireSource: $requireSource) {
        env
        sitename
        migrated
        source
        retroactive
      }
    }`;

    const result = await queryServer(query, { requireSource: true });

    expect(result.data).toMatchSnapshot();
  });
});
