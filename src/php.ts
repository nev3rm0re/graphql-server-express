import { promisify } from 'util';
const exec = promisify(require('child_process').exec);

const unserialize = async (
  input: string,
  outputFormat: 'json' | 'php' = 'json',
) => {
  return exec(
    'php ./util/unserialize.php ' + outputFormat + " '" + input + "'",
  );
};
export default { unserialize };
