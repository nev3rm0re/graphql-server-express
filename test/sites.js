const dotenv = require('dotenv');
dotenv.config();

process.env.NODE_ENV = 'test';

const chai = require('chai');
const chaiHttp = require('chai-http');
const { app: server } = require('../server.js');
const should = chai.should();

chai.use(chaiHttp);

const SITES_QUERY = `{ sites {
  env
  migrated
  sitename
  source
}}`;
const SITE_INFO_QUERY = `{
    site(sitename: "crxcommunity.com")
}`;
const MISSING_REPORT_QUERY = `{
 missingReport {
   title
   key
   sourceCount
   migratedCount
   skippedCount
 }
}`;
const MISSING_REPORT_WITH_MISSING_COUNTS_QUERY = `{
    missingReport {
        title
        missingCount
    }
}`;

const MISSING_REPORT_WITH_MISSING_ITEMS_QUERY = `{
    missingReport {
        title
        missing {
            id
            data
        }
    }
}`;
const CONFIGURATION_QUERY = `{
    entityConfiguration(contentType: "attachment") {
        name
        select
        count
    }
}`;

const WRONG_CONFIGURATION_QUERY = `{
    entityConfiguration(contentType: "non-existent") {
        name
        select
        count
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
    if (errors.length) {
      console.log('Got unexpected errors at', errors);
      console.debug(errors[0].locations);
    }
    errors.should.be.empty;

    console.debug(res.body.data);

    done();
  };
};

describe('GraphQL Server returns', () => {
  it('list of sites configured on the server', (done) => {
    createClient(chai).send(SITES_QUERY).end(expectSuccessfulResponse(done));
  });

  it('Missing report', (done) => {
    createClient(chai)
      .send(MISSING_REPORT_QUERY)
      .end((err, res) => {
        expectSuccessfulResponse(done)(err, res);
      });
  }).timeout(3000);

  it('Missing report with missing counts', (done) => {
    createClient(chai)
      .send(MISSING_REPORT_WITH_MISSING_COUNTS_QUERY)
      .end(expectSuccessfulResponse(done));
  }).timeout(20000);

  it('Missing report with missing items', (done) => {
    createClient(chai)
      .send(MISSING_REPORT_WITH_MISSING_ITEMS_QUERY)
      .end(expectSuccessfulResponse(done));
  }).timeout(30000);

  it('Entity Configuration', (done) => {
    createClient(chai)
      .send(CONFIGURATION_QUERY)
      .end(expectSuccessfulResponse(done));
  }).timeout(1000);

  it('Null when asked for non-existent configuration', (done) => {
    createClient(chai)
      .send(WRONG_CONFIGURATION_QUERY)
      .end((err, res) => {
        expectSuccessfulResponse(done)(err, res);
        res.body.should.have.deep.nested.property('data.entityConfiguration');
        should.equal(res.body.data.entityConfiguration, null);
      });
  });
  it('SitesAdmin info for the site', (done) => {
    createClient(chai)
      .send(SITE_INFO_QUERY)
      .end((err, res) => {
        expectSuccessfulResponse(done)(err, res);
        should.not.equal(res.body.data.site, null);
      });
  });
});
