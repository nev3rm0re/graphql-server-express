require('isomorphic-fetch');

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
  test('SITES query returns expected result', async () => {
    jest.setTimeout(10 * 1000);
    expect.assertions = 1;
    const query = `query {
        sites
    }`;

    const result = await queryServer(query);
    expect(result.data).toMatchSnapshot();

    console.log('done getting result', result);
    return result;
  });
});
