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

var schema = makeExecutableSchema({
  typeDefs: fs.readFileSync('./schema/schema.gql', 'utf8'),
  resolvers,
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
