const alignFields = (fields: string, space: string) => {
  return fields
    .split(/\s*,\s+/m)
    .join(',\n' + makeSpace(space.length) + '       ');
};

const makeSpace = (length: number) => {
  return ''.padStart(length, ' ');
};

interface Token {
  type: string;
  textWithPosition: string;
  text: string;
}

const alignTokens = (tokens: Token[]) => {
  const resultString = '';
  tokens.forEach((token) => {
    if (token.type === 'select') {
      resultString.concat(token.textWithPosition);
    }

    if (token.type === 'field') {
      resultString.concat(token.text);
    }
  });
  return resultString;
};

const sqlpretty = (string: string) => {
  const mainMatch = string.match(/\n?(\s*)(SELECT|UPDATE|DELETE)?/);
  const space = mainMatch![1] || '';
  const keyword = mainMatch![2] || null;

  let result;
  switch (keyword) {
    case 'SELECT':
      const matches = string.match(/SELECT (?<fields>.*)\s*(?<from>FROM .*)/s);
      const { fields, from } = matches?.groups!;

      result = [
        '\n' +
          makeSpace(space.length) +
          keyword +
          ' ' +
          alignFields(fields.trim(), space),
        '\n' + makeSpace(space.length) + makeSpace(2) + from.trim(),
      ].join('');
      break;
  }

  return result;
};

module.exports = {
  sqlpretty,
};
