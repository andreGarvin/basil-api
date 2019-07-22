#!/bin/sh

# constant
GIT_SHA=$(git rev-parse --short HEAD)

APP_NAME=pivotlms-api
USER_LOGIN=
BRANCH=dev


while test $# -gt 0; do
  case "$1" in
    -b  | --branch )
      shift

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
  -u  | --user-login )
      shift

      # checking if the user login was provided
      if [ -z "$1" ]
      then
        echo "Please provide a user login to login into docker registry"
        exit 1
      else
        USER_LOGIN=$1
      fi
    ;;
  --password-stdin )
      # reading stdin from pipe for --password-stdin
      read API_KEY;
    ;;
  esac
  shift
done

# configuring the variables
case $BRANCH in
  master )
    HOST=$PROD_HOST
    NODE_ENV=production
    APP_NAME=pivotlms-api
    ;;
  dev | * )
    NODE_ENV=dev
    HOST=$DEV_HOST
    BRANCH=$BRANCH
    APP_NAME=$APP_NAME
    ;;
esac

SERVICE="$APP_NAME-$BRANCH"

echo $API_KEY > apikey

cat apikey | docker login --password-stdin --username=$USER_LOGIN registry.heroku.com

printf "\n"

docker tag $SERVICE:$GIT_SHA registry.heroku.com/$SERVICE/web

docker push registry.heroku.com/$SERVICE/web