import { Global, Module } from '@nestjs/common';
import { createPrismaClient, PrismaClient } from '@teamflow/database';

/**
 * Provides the Prisma client to the whole API.
 *
 * The client uses the `pg` driver adapter, so no native engine has to be downloaded and the
 * same client works in tests, in CI and in production.
 */
@Global()
@Module({
  providers: [
    {
      provide: PrismaClient,
      useFactory: () => createPrismaClient(),
    },
  ],
  exports: [PrismaClient],
})
export class DatabaseModule {}
