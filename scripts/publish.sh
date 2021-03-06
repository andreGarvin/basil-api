#!/bin/sh

# constant
GIT_SHA=$(git rev-parse --short HEAD)

APP_NAME=pivotlms-api
USER_LOGIN=
BRANCH=dev

CREATE=false

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
  --create )
      CREATE=true
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
    SERVICE=$APP_NAME
    APP_NAME=pivotlms-api
    ;;
  dev | * )
    APP_NAME=$APP_NAME
    SERVICE="$APP_NAME-$BRANCH"
    ;;
esac

echo $API_KEY > apikey

cat apikey | docker login --password-stdin --username=$USER_LOGIN registry.heroku.com

if [ "$CREATE" = "true" ]
then

  if [ "${#SERVICE}" = "30" ]
  then
    echo "The name of the new service is too long"
    exit 1
  fi

  curl -n -X POST https://api.heroku.com/teams/apps \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $API_KEY" \
    -H "Accept: application/vnd.heroku+json; version=3" \
    -d '{ "name": '\"$SERVICE\"', "stack": "container", "region": "us", "team": "pivotlms", "personal": false }'

  printf "\nCreated $SERVICE\n\n"
fi

printf "\nPushing $SERVICE:$GIT_SHA image to registry\n\n"


printf "\n"

docker tag $SERVICE:$GIT_SHA registry.heroku.com/$SERVICE/web

docker push registry.heroku.com/$SERVICE/web