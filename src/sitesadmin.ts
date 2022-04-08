import axios from 'axios';
const sitesadminClient = axios.create({
  baseURL: process.env.SITESADMIN_URL,
});
const fetchSiteInfo = async (sitename: string) => {
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
export { fetchSiteInfo };
