#!/bin/sh

APP_NAME=pivotlms-api
BRANCH=dev
SERVICE=

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
    APP_NAME=pivotlms-api
    SERVICE=$APP_NAME
    ;;
  dev | * )
    APP_NAME=$APP_NAME
    SERVICE="$APP_NAME-$BRANCH"
    ;;
esac



IMAGE_NAME=registry.heroku.com/$SERVICE/web

IMAGE_ID=$(docker inspect $IMAGE_NAME --format={{.Id}})

curl -n -X PATCH https://api.heroku.com/apps/$SERVICE/formation \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Accept: application/vnd.heroku+json; version=3.docker-releases" \
  -d '{ "updates": [ { "type": "web", "docker_image": '\"$IMAGE_ID\"' } ] }'
  
echo "deployed $IMAGE_ID"