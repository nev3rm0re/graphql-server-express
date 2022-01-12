const axios = require('axios');
const sitesadminClient = axios.create({
  baseURL: process.env.SITESADMIN_URL,
});
const fetchSiteInfo = async (sitename) => {
  console.log('running with ' + sitename);
  const { data } = await sitesadminClient.post(
    process.env.SITESADMIN_URL + '/api/fetchSite',
    'sitename=' + sitename.toLowerCase(),
    {
      headers: {
        apiKey: process.env.SITESADMIN_KEY,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    },
  );
  if (data.status) {
    return JSON.parse(data.message);
  } else {
    return new Error(data.message);
  }
};
module.exports = { fetchSiteInfo };
