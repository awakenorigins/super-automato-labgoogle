#!/usr/bin/env bash
# Free the yt-forever profile: stop keeper + controller + chrome bound to it.
P1="yt-forever-keeper"
P2="yt_login_controller"
P3="user-data-dir=/root/.openclaw/workspace/youtube-cli/yt-forever-profile"
for pat in "$P1" "$P2"; do
  for p in $(pgrep -f "$pat"); do
    [ "$p" != "$$" ] && [ "$p" != "$PPID" ] && kill -KILL "$p" 2>/dev/null
  done
done
for p in $(pgrep -f "$P3"); do
  [ "$p" != "$$" ] && [ "$p" != "$PPID" ] && kill -KILL "$p" 2>/dev/null
done
sleep 2
rm -f /root/.openclaw/workspace/youtube-cli/yt-forever-profile/Singleton* 2>/dev/null
echo "freed"
