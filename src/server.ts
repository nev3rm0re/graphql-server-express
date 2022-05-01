import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
const _ = require('lodash');

const { graphqlHTTP } = require('express-graphql');
const { makeExecutableSchema } = require('@graphql-tools/schema');
const cors = require('cors');
const fs = require('fs');
import resolvers from './resolvers';
import { getConnection } from './database';

const Query = fs.readFileSync('./schema/schema.gql', 'utf8');
import {
  typeDefs as sites,
  resolvers as sitesResolvers,
} from './resolvers/sites';

import { typeDefs as dbserver, resolvers as dbresolvers } from './resolvers/db';

import {
  typeDefs as missings,
  resolvers as missingsResolvers,
} from './resolvers/missing';

const combinedResolvers = _.merge(
  resolvers,
  sitesResolvers,
  dbresolvers,
  missingsResolvers,
);

var schema = makeExecutableSchema({
  typeDefs: [Query, sites, dbserver, missings],
  resolvers: combinedResolvers,
});

const app: any = express();

export interface ResolverContext {
  connectionManager: typeof getConnection;
}

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

export default app;
