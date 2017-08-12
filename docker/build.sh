#!/bin/bash

#docker login

docker build -t omsevents-frontend -f Dockerfile.dev .
docker tag omsevents-frontend aegee/omsevents-frontend:dev
docker push aegee/omsevents-frontend:dev