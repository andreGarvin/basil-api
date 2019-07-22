import * as express from "express";
const router = express.Router();

import * as joi from "joi";

// module
import * as registry from "./index";

// middleware
import apiAuthenticationMiddleware from "../middleware/api-authentication";

// utils
import returnInt from "../../common/utils/return-int";

// error codes
import { VALIDATION_EXCEPTION } from "../../common/error-codes";

router.post("/register", apiAuthenticationMiddleware, (req, res, next) => {
  const schema = joi.object().keys({
    domain: joi
      .string()
      // regex for checking if the dmoain is a "valid" email domain
      .regex(/@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+/gi)
      .optional()
      .error(([err]) => "the domain must be a valid email domain"),

    name: joi
      .string()
      .required()
      .error(
        ([err]) => "You must provide the name of the school you are registering"
      ),

    admins: joi
      .array()
      .items(joi.string().optional())
      .error(([err]) => {
        if (err.type === "array.min") {
          return "You must provide at least 1 admin to add the school to the registry";
        }

        return err;
      })
      .min(1)
      .max(30)
  });

  const { error } = joi.validate(req.body, schema, { abortEarly: false });
  if (error) {
    return res.status(400).json({
      error_code: VALIDATION_EXCEPTION,
      message:
        "There seems to be issue with the provided configure for registering",
      errors: error.details.map(err => {
        delete err.context.label;
        delete err.path;
        delete err.type;
        return err;
      })
    });
  }

  const { name, domain = "", admins } = req.body;
  return registry
    .insert(name, domain, admins)
    .then(school_id => res.status(200).json({ school_id }))
    .catch(next);
});

router.get("/search", (req, res, next) => {
  const body = {
    page: req.query.page,
    limit: req.query.limit,
    search: req.query.search
  };

  body.page = returnInt(body.page, 10, 1);

  body.limit = returnInt(body.limit, 10, 15);
  if (body.limit > 15 || body.limit <= 0) {
    body.limit = 15;
  }

  const schema = joi.object().keys({
    page: joi.number().optional(),
    limit: joi.number().optional(),
    search: joi
      .string()
      .optional()
      .allow("")
  });

  const { error } = joi.validate(body, schema);
  if (error) {
    return res.status(400).json({
      error_code: VALIDATION_EXCEPTION,
      message: "There seems to be issue with searching for schools",
      errors: error.details.map(err => {
        delete err.context.label;
        delete err.path;
        delete err.type;
        return err;
      })
    });
  }

  return registry
    .searchRegistry(body.search, body.page, body.limit)
    .then(response => res.status(200).json(response))
    .catch(next);
});

export default router;
