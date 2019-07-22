import * as http from "http";

import * as express from "express";

// utils
import logger from "../../common/logger";
import { URL } from "url";

/**
 * This function returns a new object of the filtered
 * headers that was sent to the server.
 */
const headerFilter = (
  filteredHeaders: string[],
  headers: http.OutgoingHttpHeaders | http.IncomingHttpHeaders
): http.OutgoingHttpHeaders | http.IncomingHttpHeaders => {
  // making a copy of the http request header
  const newHeaders = Object.assign({}, headers);

  filteredHeaders.forEach(i => {
    delete newHeaders[i];
  });

  return newHeaders;
};

// the list of headers we want to filter in the logs
const headerFilters: string[] = [
  "authorization",
  "x-api-key",
  "x-token",
  "cookie"
];

/**
 * This is the express http logger. This logs all incoming http
 * requests and out going http response on the server
 */
export default (): express.RequestHandler => {
  return (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    const startTime = Date.now();

    // making a clone of the logger util library
    const log = logger.child({});

    function onFinished(error) {
      // removing the event listeners that were set
      this.removeListener("error", onFinished);
      this.removeListener("finish", onFinished);

      const responseTime = Date.now() - startTime;

      const fields = [
        // logging the filtered http response headers
        headerFilter(headerFilters, res.getHeaders()),
        // logging the filtered request headers received
        headerFilter(headerFilters, req.headers),
        {
          responseTime: `${responseTime} ms`,
          status: this.statusCode,
          protocol: req.protocol,
          method: req.method,
          path: req.url
        }
      ];

      if (error || this.statusCode >= 500) {
        // if a error was not given then create a default error
        const err = error || new Error("request failed");

        log.error(
          "express bubbled up an error up its event listener",
          ...fields,
          err
        );
        return;
      }

      // will not log if test are running
      if (process.env.NODE_ENV !== "test") {
        log.info("request handled", ...fields);
      }
    }

    // adding event listeners on the response
    res.on("error", onFinished);
    res.on("finish", onFinished);

    // this will not show logs when running test
    if (process.env.NODE_ENV !== "test") {
      const cleanUrl = new URL(req.url);
      cleanUrl.searchParams.delete("token");

      const fields = [
        // logging the filtered request headers received
        headerFilter(headerFilters, req.headers),
        {
          protocol: req.protocol,
          path: cleanUrl.href,
          method: req.method
        }
      ];

      // this logs the incomming http request
      log.info("request received", ...fields);
    }

    return next();
  };
};
