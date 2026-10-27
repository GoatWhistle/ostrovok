#!/usr/bin/env bash
set -u
evidence="$(cd "$(dirname "$0")" && pwd)"
target="$evidence/e16-regression"
node=/tmp/hotel-node24/bin/node
mkdir -p "$target/shots"
docker exec -i hotel-evolution-backend-1 python - < "$evidence/seed-h03-check.py" > "$target/seed-h03.json" 2>&1
docker exec -i hotel-evolution-backend-1 python - < "$evidence/seed-h07-check.py" > "$target/seed-h07.json" 2>&1
checks=(
  check-e18-sequence check-e18-submit check-e18-fallback check-e18-keyboard
  check-e09-flow check-e10-flow check-e10-scroll check-e11-location check-e13-place
  check-h04-outcomes check-h06-dismissal check-h07-live
)
: > "$target/summary.txt"
for name in "${checks[@]}"; do
  sed \
    -e "s#'/tmp/e18-#'$target/e18-#g" \
    -e "s#'/tmp/evolution-\\([a-z0-9]*\\)'#'$target/\\1'#g" \
    -e "s#const out=root+'/work/frontend-evolution/evidence'#const out='$target'#" \
    -e "s#const out='/home/ikhail_horokhorin/projects/o-hack-sochi/work/frontend-evolution/evidence'#const out='$target'#" \
    -e "s#const out = __dirname#const out = '$target'#" \
    -e "s#__dirname + '/#'$evidence/#g" \
    -e "s#\`\${out}/e12-conversation.json\`#'$evidence/e12-conversation.json'#g" \
    -e "s#out+'/e12-conversation.json'#'$evidence/e12-conversation.json'#g" \
    -e 's#hasText: "взрослых"#hasText: "Вместимость"#g' \
    -e 's#hasText: "питомц"#hasText: "животн"#g' \
    -e 's#text.includes("питомц")#text.includes("животн")#g' \
    -e 's#page.getByRole("button", { name: "Неверно, исправить" })#page.getByRole("complementary", { name: "Сведения об отеле" }).getByRole("button", { name: "Изменить", exact: true })#g' \
    -e "s#queue.locator('li button').last()#queue.locator('li button[aria-current=\"true\"]')#g" \
    "$evidence/$name.cjs" > "$target/$name.cjs"
  mkdir -p "$target/e13" "$target/h06" "$target/h07"
  if [[ $name == check-h04-outcomes || $name == check-h06-dismissal ]]; then
    docker exec -i hotel-evolution-backend-1 python - < "$evidence/seed-h03-check.py" > "$target/seed-$name.json" 2>&1
  fi
  started=$(date +%s)
  timeout 900 "$node" "$target/$name.cjs" > "$target/$name.log" 2>&1
  code=$?
  echo "$name exit=$code seconds=$(( $(date +%s) - started ))" | tee -a "$target/summary.txt"
done
