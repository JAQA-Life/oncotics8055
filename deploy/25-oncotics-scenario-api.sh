#!/bin/sh
set -eu
: "${SCENARIO_PROXY_SECRET:?Set SCENARIO_PROXY_SECRET}"
envsubst '${SCENARIO_PROXY_SECRET}' < /etc/nginx/scenario-api.conf.template > /etc/nginx/scenario-api.conf
chmod 600 /etc/nginx/scenario-api.conf
