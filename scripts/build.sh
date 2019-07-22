#!/bin/bash

# constant
GIT_SHA=$(git rev-parse --short HEAD)

DEV_HOST=https://pivotlms-api-dev.herokuapp.com
PROD_HOST=https://pivotlms-api.herokuapp.com

# variables with default values
APP_NAME=pivotlms-api
HOST=$DEV_HOST
NODE_ENV=dev
BRANCH=dev


while test $# -gt 0; do
  case "$1" in
    -b  | --branch )
      shift
      BRANCH=$1

      if [ -z "$1" ]
      then
        BRANCH=$BRANCH
      else
        BRANCH=$1
      fi
    ;;
  -a  | --app )
      shift

      if [ -z "$1" ]
      then
        APP_NAME=$APP_NAME
      else
        APP_NAME=$1
      fi
    ;;
  esac
  shift
done

# configuring the variables
case $BRANCH in
  master )
    HOST=$PROD_HOST
    NODE_ENV=production
    ;;
  dev | * )
    NODE_ENV=dev
    HOST=$DEV_HOST
    APP_NAME=$APP_NAME
    ;;
esac

# # building docker image
docker build \
  -t $APP_NAME-$BRANCH:$GIT_SHA \
  --build-arg HOST=$HOST \
  --build-arg GIT_SHA=$GIT_SHA \
  --build-arg NODE_ENV=$NODE_ENV \
  --build-arg APP_NAME=$APP_NAME-$BRANCH \
  .