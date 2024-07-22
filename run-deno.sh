#!/bin/bash

if [ $# -lt 1 ]; then
  echo "Usage: $0 <url> [--option=value ...]"
  exit 1
fi

url=$1
shift

ts_code=$(curl -s "$url")

if [ $? -ne 0 ]; then
  echo "Failed to fetch TypeScript file from $url"
  exit 1
fi

temp_ts_file=$(mktemp /tmp/temp_ts_file.XXXXXX.ts)

echo "$ts_code" > "$temp_ts_file"

options="$@"

deno run --allow-net "$temp_ts_file" $options

rm "$temp_ts_file"
