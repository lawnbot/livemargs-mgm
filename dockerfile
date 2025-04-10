# Build stage
FROM node:23-slim AS build

# Set the working directory
WORKDIR /app

# Copy the package.json and package-lock.json files
COPY package*.json ./

# Install the dependencies
RUN npm install

# Copy the rest of the code
COPY . .

# Build Typescript Code
RUN npm run build

FROM node:23-slim AS production

WORKDIR /app

COPY package*.json .

RUN npm ci --only=production

COPY --from=build /app/dist ./dist

# Expose the port that the app listens on
EXPOSE 3000

# Define the command to run the app
CMD ["node", "dist/server.js"]