import type { IPrismHttpServer } from '@stoplight/prism-http-server/src/types';
import { CreateMockServerOptions } from './createServer';
import { getHttpOperationsFromSpec } from '@stoplight/prism-http';

export type CreatePrism = (options: CreateMockServerOptions) => Promise<IPrismHttpServer | void>;

export function runPrismAndSetupWatcher(
  createPrism: CreatePrism,
  options: CreateMockServerOptions
): Promise<IPrismHttpServer | void> {
  return createPrism(options).then(possibleServer => {
    if (possibleServer) {
      let server: IPrismHttpServer = possibleServer;

      server.logger.info('Restarting Prism...');

      return getHttpOperationsFromSpec(options.document)
        .then(operations => {
          if (operations.length === 0) {
            server.logger.info('No operations found in the current file, continuing with the previously loaded spec.');
          } else {
            return server
              .close()
              .then(() => {
                server.logger.info('Loading the updated operations...');

                return createPrism(options);
              })
              .then(newServer => {
                if (newServer) {
                  server = newServer;
                }
              });
          }
        })
        .catch(() => {
          server.logger.warn('Something went terribly wrong, trying to start Prism with the original document.');

          return server
            .close()
            .then(() => createPrism(options))
            .catch(() => process.exit(1));
        });
    }
  });
}
