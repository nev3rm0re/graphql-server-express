import { sqlpretty as testee } from '../src/resolvers/sqlpretty';
it('Should not modify already perfect string', () => {
  const input = `
SELECT field1,
       field2
  FROM sometable`;

  const result = testee(input);
  expect(result).toEqual(input);
});

it('Should not modify already perfect complex string', () => {
  const input = `
SELECT field1
  FROM thetable
       LEFT JOIN another ON (thetable.id = another.id)
 WHERE 1 = 1
   AND 2 = 2`;

  const result = testee(input);
  expect(result).toEqual(input);
});

it('Lines up fields with first SELECT', () => {
  const input = `
SELECT field1, field2 FROM sometable
        `;
  const expected = `
SELECT field1,
       field2
  FROM sometable`;

  const result = testee(input);
  expect(1).toEqual(1);
  expect(result).toEqual(expected);
});

it('Lines up fields with aliases', () => {
  const input = `
  SELECT field1 AS 'field', field2 AS 'field' FROM sometable AS table_alias`;

  const expected = `
  SELECT field1 AS 'field',
         field2 AS 'field'
    FROM sometable AS table_alias`;

  const result = testee(input);

  expect(result).toEqual(expected);
});

it('Lines up "where" fields', () => {
  const input = `
    SELECT *
      FROM mytable
     WHERE 1 = 1 AND 2 = 2 AND field_id = ?`;

  const expected = `
    SELECT *
      FROM mytable
     WHERE 1 = 1
           AND 2 = 2
           AND field_id = ?`;

  const result = testee(input);
  expect(result).toEqual(expected);
});
