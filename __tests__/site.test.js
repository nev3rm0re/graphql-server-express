import { fetchSiteInfo } from '../src/sitesadmin';

describe('fetchSiteInfo', () => {
  it('returns information on Site', async () => {
    const result = await fetchSiteInfo(
      'stratolinerdeluxe.net',
      process.env.SITESADMIN_KEY,
    );
    expect(result).toMatchSnapshot();
  });
});
