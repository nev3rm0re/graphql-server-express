const dotenv = require('dotenv');
dotenv.config();

import app from './server';

app.listen(4000);
console.log('Running a GraphQL server at http://localhost:4000/graphql');
