# -- DEV DOCKERFILE --
# -- DO NOT USE IN PRODUCTION! --

FROM node:20-alpine
LABEL maintainer "requarks.io"

RUN apk add yarn g++ make cmake python3 --no-cache && \
    mkdir -p /wiki

WORKDIR /wiki

ENV dockerdev 1
ENV DEVDB postgres

EXPOSE 3000

CMD ["tail", "-f", "/dev/null"]
