import { main } from '../src/cli/migrate';

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
