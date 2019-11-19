import { Duplex } from "stream";

import * as AWS from "aws-sdk";

// config
import * as config from "../config";

// creating a instance of the S3 handler
export default new AWS.S3({
  accessKeyId: config.AWS_ACCESS_KEY_ID,
  secretAccessKey: config.AWS_SECERT_ACCESS_KEY
});

export const TransformBufferToStream = (buffer: Buffer | any): Duplex => {
  const stream = new Duplex();
  stream.push(buffer);
  stream.push(null);
  return stream;
};
