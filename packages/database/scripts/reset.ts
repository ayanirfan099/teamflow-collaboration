import { main } from '../src/cli/reset';

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
