import * as express from "express";

const router = express.Router();

import * as joi from "joi";

// user module
import * as user from "./index";

// middlewares
import profileExistMiddleware from "./middleware/profile-exist";
import isBlockedUserMiddleware from "./middleware/user-blocked";
import profilePhotoUploadMiddleware from "./middleware/multer";

// utils
import {
  joiValidateResponse,
  ValidationJsonResponse
} from "../../common/utils/validation-response";
import returnInt from "../../common/utils/return-int";

// request schemas
import { updateProfileSchema, userSearchSchema } from "./request-schema";

router.get("/:user_id/profile/info", (req, res, next) => {
  return user
    .getUserInfo(req.state.user, req.params.user_id)
    .then(userInfo => res.status(200).json(userInfo))
    .catch(next);
});

router.patch("/profile/info", (req, res, next) => {
  const { error } = joi.validate(req.body, updateProfileSchema, {
    abortEarly: false
  });
  if (error) {
    return res.status(400).json(
      ValidationJsonResponse({
        errors: joiValidateResponse(error.details)
      })
    );
  }

  return user
    .updateUserInfo(req.state.user, req.body)
    .then(updatedUserInfo => res.status(200).json(updatedUserInfo))
    .catch(next);
});

router.get(
  "/:user_id/profile/photo",
  profileExistMiddleware,
  isBlockedUserMiddleware,
  (req, res, next) => {
    return user
      .returnStreamOfUserProfilePhoto(req.params.user_id)
      .then(stream => {
        res.pipe(stream);
      })
      .catch(next);
  }
);

router.post(
  "/profile/photo/upload",
  profilePhotoUploadMiddleware,
  (req, res, next) => {
    return user
      .uploadProfilePhoto(req.state.user, req.file)
      .then(() => {
        res.status(200).json({ uploaded: true });
      })
      .catch(next);
  }
);

router.get("/search", (req, res, next) => {
  const body = {
    page: req.query.page,
    limit: req.query.limit,
    search: req.query.search || ""
  };

  if (!body.search && process.env.NODE_ENV !== "test") {
    return res.status(200).json({
      page: 1,
      result: [],
      next_page: -1
    });
  }

  body.page = returnInt(body.page, 10, 1);
  body.limit = returnInt(body.limit, 10, 50);

  const { error } = joi.validate(body, userSearchSchema);
  if (error) {
    return res
      .status(400)
      .json(
        ValidationJsonResponse({ errors: joiValidateResponse(error.details) })
      );
  }

  return user
    .searchForUsers(req.state.user, body.search, body.page, body.limit)
    .then(result => res.status(200).json(result))
    .catch(next);
});

router.post(
  "/:user_id/follow",
  profileExistMiddleware,
  isBlockedUserMiddleware,
  (req, res, next) => {
    return user
      .followUser(req.state.user, req.params.user_id)
      .then(() => {
        res.status(200).json({ followed: true });
      })
      .catch(next);
  }
);

router.delete(
  "/:user_id/unfollow",
  profileExistMiddleware,
  isBlockedUserMiddleware,
  (req, res, next) => {
    return user
      .unFollowUser(req.state.user, req.params.user_id)
      .then(() => {
        res.status(200).json({ unfollowed: true });
      })
      .catch(next);
  }
);

router.get("/:user_id/profile/info/following", (req, res, next) => {
  const body = {
    page: req.query.page,
    limit: req.query.limit,
    search: req.query.search || ""
  };

  body.page = returnInt(body.page, 10, 1);
  body.limit = returnInt(body.limit, 10, 20);

  const { error } = joi.validate(body, userSearchSchema);
  if (error) {
    return res
      .status(400)
      .json(
        ValidationJsonResponse({ errors: joiValidateResponse(error.details) })
      );
  }

  return user
    .getFollowing(
      req.state.user,
      req.params.user_id,
      body.search,
      body.page,
      body.limit
    )
    .then(following => {
      res.status(200).json(following);
    })
    .catch(next);
});

router.get("/:user_id/profile/info/followers", (req, res, next) => {
  const body = {
    page: req.query.page,
    limit: req.query.limit,
    search: req.query.search || ""
  };

  body.page = returnInt(body.page, 10, 1);
  body.limit = returnInt(body.limit, 10, 20);

  const { error } = joi.validate(body, userSearchSchema);
  if (error) {
    return res
      .status(400)
      .json(
        ValidationJsonResponse({ errors: joiValidateResponse(error.details) })
      );
  }

  return user
    .getFollowers(
      req.state.user,
      req.params.user_id,
      body.search,
      body.page,
      body.limit
    )
    .then(following => {
      res.status(200).json(following);
    })
    .catch(next);
});

router.get("/blocked", (req, res, next) => {
  return user
    .getBlockedUsers(req.state.user)
    .then(blockedUsers => res.status(200).json({ blocked_users: blockedUsers }))
    .catch(next);
});

router.post(
  "/:user_id/block",
  profileExistMiddleware,
  isBlockedUserMiddleware,
  (req, res, next) => {
    return user
      .blockUser(req.state.user, req.params.user_id)
      .then(() => {
        res.status(200).json({ blocked: true });
      })
      .catch(next);
  }
);

router.delete(
  "/:user_id/unblock",
  profileExistMiddleware,
  isBlockedUserMiddleware,
  (req, res, next) => {
    return user
      .unBlockUser(req.state.user, req.params.user_id)
      .then(() => {
        res.status(200).json({ unblocked: true });
      })
      .catch(next);
  }
);

export default router;
