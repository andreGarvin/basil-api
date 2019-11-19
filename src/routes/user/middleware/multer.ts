import * as path from "path";

import * as imageType from "image-type";
import * as multer from "multer";

// config
import { MAX_FILE_SIZE } from "../../../config";

// error codes
import { FileError } from "../../../common/error-codes";

const acceptedFileTypes = /.jpg|.jpeg|.png$/;

// multer configuration for csv upload
const multerUploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE
  },
  fileFilter: (
    req: Express.Request,
    file: Express.Multer.File,
    callback: any
  ) => {
    if (!acceptedFileTypes.test(path.extname(file.originalname))) {
      return callback(new Error(FileError.INVALID_FILE_EXCEPTION), false);
    }

    // checking if the file is not empty
    if (file.size === 0) {
      return callback(new Error(FileError.EMPTY_FILE_EXCEPTION), false);
    }

    callback(null, true);
  }
}).single("profile_photo");

// this middleware handle file upload for images
const profilePhotoUploadMiddleware = (req, res, next) => {
  multerUploadMiddleware(req, res, err => {
    if (err) {
      switch (err.code || err.message) {
        case "LIMIT_UNEXPECTED_FILE":
          return res.status(400).json({
            error_code: FileError.INVALID_FIELD_NAME_EXCEPTION,
            message: "field name for the attached file is inccorect"
          });
        case FileError.INVALID_FILE_EXCEPTION:
          return res.status(400).json({
            message: "expected a image",
            error_code: FileError.INVALID_FILE_EXCEPTION
          });
        case FileError.EMPTY_FILE_EXCEPTION:
          return res.status(400).json({
            message: "can not provide empty files",
            error_code: FileError.EMPTY_FILE_EXCEPTION
          });
        default:
          return next(err);
      }
    }

    // checking if the file is actually a image file that is being uploaded
    const fileType = imageType(req.file.buffer);

    // checking if the image file extenison is a accpeted image file type
    const acceptedFileType = fileType
      ? !acceptedFileTypes.test(path.extname(fileType.ext))
      : false;

    if (!fileType || !acceptedFileType) {
      return res.status(400).json({
        message: "expected a image",
        error_code: FileError.INVALID_FILE_EXCEPTION
      });
    }

    return next();
  });
};

export default profilePhotoUploadMiddleware;
