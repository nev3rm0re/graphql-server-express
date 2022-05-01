import regexfinder from '../src/resolvers/regexfinder';

describe('Regexp Finder', () => {
  // test stuff
  test('it should find shortest possible regexp for a number of string', () => {
    const input = [
      '/viewpost.php?postnum=123',
      '/viewpost.php?postnum=124',
      '/viewpost.php?postnum=125',
    ];

    const regexp = regexfinder(input);
    expect(regexp).toEqual('/viewpost.php?postnum=12[3-5]');
  });
});
