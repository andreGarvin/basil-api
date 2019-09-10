import * as path from "path";

import * as multer from "multer";

// config
import { MAX_FILE_SIZE } from "../../../../config";

// error codes
import { FileError } from "../../../../common/error-codes";

// multer configuration for csv upload
export default multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE
  },
  fileFilter: (req, file, callback) => {
    if (!/.csv$/.test(path.extname(file.originalname))) {
      return callback(new Error(FileError.INVALID_FILE_EXCEPTION), false);
    }

    // checking if the file is not empty
    if (file.size === 0) {
      return callback(new Error(FileError.EMPTY_FILE_EXCEPTION), false);
    }

    callback(null, true);
  }
}).single("roaster");
