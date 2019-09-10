import * as csvParser from "csv-parse";

// utils
import logger from "../../../../common/logger";

// error codes
import { FileError } from "../../../../common/error-codes";

// types
import { NewMember } from "../types";

// csv error code
export const CSV_FILE_EXCEPTION = "CSV_FILE_EXCEPTION";

function parseCsv(csvBuffer): Promise<NewMember[]> {
  return new Promise((resolve, reject) => {
    const CsvStream = csvParser(csvBuffer, {
      trim: true,
      delimiter: ",",
      skip_empty_lines: true
    });

    const collection = [];
    CsvStream.on("data", member => {
      const [email, admin = "false"] = member.filter(
        column => column.trim() !== ""
      );

      collection.push({ email, admin: admin.toLowerCase() === "true" });
    })
      .on("error", err => {
        reject(err);
      })
      .on("end", () => {
        resolve(collection);
      });
  });
}

/* csv middleware for parsing csv upload of members to add to a workspace
  and attaching them to the req body for /api/workspacemember/bulk */
const csvParserMiddleware = (req, res, next) => {
  if (req.file) {
    // getting the csv data
    const csvContent = req.file.buffer.toString();

    return parseCsv(csvContent)
      .then(collection => {
        req.body.members = collection;

        next();
      })
      .catch(err => {
        if (err instanceof Error) {
          logger
            .child({ error: err })
            .error("Failed to parse csv returning error to user");

          return res.status(400).json({
            error_code: CSV_FILE_EXCEPTION,
            message: "There seems to be a issue with the csv you are provided"
          });
        }

        return next(err);
      });
  }

  next();
};

export default csvParserMiddleware;
