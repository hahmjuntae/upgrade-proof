const chalk = require("chalk");

function statusLine(name, ok) {
  return ok ? chalk.green(`PASS ${name}`) : chalk.red(`FAIL ${name}`);
}

module.exports = { statusLine };
