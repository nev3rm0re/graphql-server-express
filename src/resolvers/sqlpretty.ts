const alignFields = (fields, space) => {
  return fields
    .split(/\s*,\s+/m)
    .join(',\n' + makeSpace(space.length) + '       ');
};

const makeSpace = (length) => {
  return ''.padStart(length, ' ');
};

const alignTokens = (tokens) => {
  const resultString = '';
  tokens.each((token) => {
    if (token.type === 'select') {
      resultString.concat(token.textWithPosition);
    }

    if (token.type === 'field') {
      resultString.concat(statement.column + token.text);
    }
  });
  return resultString;
};

const GENERAL_FORM = (input) => {
  return alignTokens(tokenizeInput(input), rules);
};

const sqlpretty = (string) => {
  const mainMatch = string.match(/\n?(\s*)(SELECT|UPDATE|DELETE)?/);
  const [_, space, keyword] = mainMatch;
  let result;
  switch (keyword) {
    case 'SELECT':
      const matches = string.match(/SELECT (?<fields>.*)\s*(?<from>FROM .*)/s);

      {
        /* console.log('Got matches?', matches); */
      }
      const { fields, from } = matches.groups;
      console.debug(fields, from);

      result = [
        '\n' +
          makeSpace(space.length) +
          keyword +
          ' ' +
          alignFields(fields.trim('\n '), space),
        '\n' + makeSpace(space.length) + makeSpace(2) + from.trim('\n '),
      ].join('');
      break;
  }

  return result;
};

module.exports = {
  sqlpretty,
};
