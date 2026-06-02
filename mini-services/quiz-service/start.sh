#!/bin/bash
cd /home/z/my-project/mini-services/quiz-service
while true; do
  bun index.ts 2>&1
  echo "[$(date)] Service crashed, restarting in 2s..." >> /tmp/quiz-ws-restart.log
  sleep 2
done
