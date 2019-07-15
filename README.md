# Pivot api: This is the backend api for pivot

This readme encapsulates how to setup and start the backend api for local development

## Perquisites

- Node version `10.15.0>=`
- Mongo version `3.6.2>=`

## Scripts

- `npm test`: runs all integration and unit tests
- `npm run build`: trans-compile the typescript project
- `npm start`: starts the service in a production setting
- `npm run start:dev`: starts the service in development mode
- `npm run build:watch`: trans-compile the typescript project on every save made in the `.src` folder

## Getting started

- run `npm i` or `npm install` to install all the packages needed for this service

- copy the contents in the `.env.sample` into your `.env` file. **WARNING: DO NOT COMMIT YOUR `.env` FILE TO HISTORY!!!**

## Documentation

- This service JSDOC comments for internal code document along with leveraging typescript for type safety at runtime

- For api documentation we are using swagger for documenting all api endpoints

## Testing

For testing this service will be using ava test runner/framework
