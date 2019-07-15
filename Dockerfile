FROM node:10.15.0-alpine as base
WORKDIR /app

# setting environmental variables
ARG GIT_SHA
ENV GIT_SHA=$GIT_SHA
ARG HOST
ENV HOST=$HOST

# installing dependencies
FROM base AS dependencies
COPY . .
RUN npm set progress=false
RUN npm install --production
RUN cp -R node_modules prod_node_modules
RUN npm install

# building the project
FROM dependencies AS build
COPY . .
RUN npm run build

FROM base AS release
# settuing up folder
COPY --from=dependencies /app/prod_node_modules node_modules
COPY --from=dependencies /app/package.json package.json
COPY --from=dependencies /app/templates templates/
COPY --from=dependencies /app/images images/
COPY --from=build /app/build build/

# exposing the container port
EXPOSE 8080

CMD [ "npm", "start" ]
