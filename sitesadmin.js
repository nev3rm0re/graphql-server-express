const axios = require('axios');
const sitesadminClient = axios.create({
  baseURL: process.env.SITESADMIN_URL,
});
const fetchSiteInfo = async (sitename) => {
  return await sitesadminClient.post(
    process.env.SITESADMIN_URL + '/api/fetchSite',
    'sitename=' + sitename.toLowerCase(),
    {
      headers: {
        apiKey: process.env.SITESADMIN_KEY,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    },
  );
};
module.exports = { fetchSiteInfo };
