const { promisify } = require('util');
const exec = promisify(require('child_process').exec);

const unserialize = async (input, outputFormat = 'json') => {
  return exec(
    'php ./util/unserialize.php ' + outputFormat + " '" + input + "'",
  );
};
module.exports = { unserialize };
