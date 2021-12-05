require('isomorphic-fetch');
const getConnection = require('../database.js');

const queryServer = (query) => {
  return fetch('http://104.154.240.101/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query,
    }),
  }).then((res) => res.json());
};
describe('Query sites', () => {
  jest.setTimeout(20000);
  test('what the heck mysql2.query returns', async () => {
    const conn = await getConnection('2008ownersclub.co.uk_target');
    const [result] = await conn.query('SHOW TABLES LIKE "%_migration"');

    const tables = result.map((row) => Object.values(row)[0]);
    console.debug(tables);
  });
  test('SITES query returns expected result', async () => {
    jest.setTimeout(10 * 1000);
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
});
