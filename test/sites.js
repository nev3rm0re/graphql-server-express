const dotenv = require('dotenv');
dotenv.config();

process.env.NODE_ENV = 'test';

const chai = require('chai');
const chaiHttp = require('chai-http');
const { app: server } = require('../server.js');
const should = chai.should();

chai.use(chaiHttp);

const SITES_QUERY = `{ sites }`;
const SITE_INFO_QUERY = `{
    site(sitename: "crxcommunity.com")
}`;
const MISSING_REPORT_QUERY = `{
 missingReport {
   title
   key
   sourceCount
   migratedCount
   missingCount
   skippedCount
 }
}`;
const createClient = (chai) => {
  return chai
    .request(server)
    .post('/graphql')
    .set('Content-Type', 'application/graphql');
};

const expectSuccessfulResponse = (done) => {
  return (err, res) => {
    res.should.have.status(200);

    res.body.should.have.property('data');

    const errors = res.body.errors || [];
    if (errors) console.log('Got unexpected errors', errors);
    errors.should.be.empty;

    done();
  };
};

describe('GraphQL Server', () => {
  it('Successfully returns a list of sites configured on the server', (done) => {
    createClient(chai).send(SITES_QUERY).end(expectSuccessfulResponse(done));
  });

  it('Successfully fetches site information from SitesAdmin', (done) => {
    createClient(chai)
      .send(SITE_INFO_QUERY)
      .end(expectSuccessfulResponse(done));
  }).timeout(2000);

  it('Successfully fetches missing report', (done) => {
    createClient(chai)
      .send(MISSING_REPORT_QUERY)
      .end(expectSuccessfulResponse(done));
  }).timeout(10000);
});
