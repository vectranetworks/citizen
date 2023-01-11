# build stage
FROM node:16 as build
ARG TARGETPLATFORM
WORKDIR /citizen

COPY package.json .
COPY package-lock.json .
RUN npm install

COPY . .

RUN case "$TARGETPLATFORM" in \
      "linux/arm64") npm run build:linux-arm && mv dist/citizen-linux-a64 /tmp/citizen;; \
      "linux/amd64") npm run build:linux && mv dist/citizen-linux-x64 /tmp/citizen ;; \
      esac;

# final stage
FROM bitnami/minideb as prod

LABEL maintainer="outsideris@gmail.com"
LABEL org.opencontainers.image.source = "https://github.com/outsideris/citizen"

COPY --from=build /tmp/citizen /usr/local/bin/citizen

WORKDIR /citizen

ENV CITIZEN_DB_DIR ./data
ENV CITIZEN_STORAGE file
ENV CITIZEN_STORAGE_PATH /path/to/store
#ENV CITIZEN_AWS_S3_BUCKET BUCKET_IF_STORAGE_IS_S3
#ENV AWS_ACCESS_KEY_ID YOUR_AWS_KEY_IF_STORAGE_IS_S3
#ENV AWS_SECRET_ACCESS_KEY YOUR_AWS_SECRET_KEY_IF_STORAGE_IS_S3
ENV NODE_ENV=production

EXPOSE 3000

CMD citizen server
