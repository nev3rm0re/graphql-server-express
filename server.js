const dotenv = require('dotenv');
dotenv.config();

const express = require('express');

const { graphqlHTTP } = require('express-graphql');
const { makeExecutableSchema } = require('@graphql-tools/schema');
const cors = require('cors');
const fs = require('fs');

var schema = makeExecutableSchema({
  typeDefs: fs.readFileSync('./schema/schema.gql', 'utf8'),
});

const root = require('./resolvers');

const app = express();

app.use(cors());
app.use(
  '/graphql',
  graphqlHTTP({
    schema,
    rootValue: root,
    graphiql: true,
  }),
);

module.exports = { app };
