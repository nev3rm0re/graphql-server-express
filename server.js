const dotenv = require('dotenv');
dotenv.config();

const express = require('express');

const { graphqlHTTP } = require('express-graphql');
const { makeExecutableSchema } = require('@graphql-tools/schema');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { resolvers } = require('./resolvers');
const getConnection = require('./database');

const Query = fs.readFileSync('./schema/schema.gql', 'utf8');
const {
  typeDefs: sites,
  resolvers: sitesResolvers,
} = require('./resolvers/sites');

var schema = makeExecutableSchema({
  typeDefs: [Query, sites],
  resolvers: Object.assign({}, resolvers, sitesResolvers),
});

const app = express();

app.use(cors());
app.use(
  '/graphql',
  graphqlHTTP({
    schema,
    graphiql: true,
    context: {
      connectionManager: getConnection,
    },
  }),
);

module.exports = { app };
