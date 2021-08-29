const dotenv = require('dotenv');
dotenv.config();

const express = require('express');

const { graphqlHTTP } = require('express-graphql');
const { makeExecutableSchema } = require('@graphql-tools/schema');
const cors = require('cors');
const fs = require('fs');
const root = require('./resolvers');

var schema = makeExecutableSchema({
  typeDefs: fs.readFileSync('./schema/schema.gql', 'utf8'),
  resolvers: root.resolvers,
});

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
