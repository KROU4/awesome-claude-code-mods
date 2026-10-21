#!/usr/bin/env bash
# Checks the `catalog` artifact of the Sync workflow before anything from it lands in main or on the
# site. The build job that wrote it reads contributors' code (validate, clone), so the files are
# checked here with bash and jq only, against the checkout of main (the current directory):
#   - registry.json, marketplace.json and data/*.json are JSON;
#   - data/ holds only the files the generator writes;
#   - data/maintainers.json only gains logins: an id the catalog recorded never changes;
#   - every marketplace plugin is a catalog entry, with exactly the source its mod.json gives;
#   - registry.json names this repository and marketplace, and lists catalog entries only;
#   - the READMEs change only between their generated markers.
# Usage: scripts/verify-catalog-artifact.sh <artifact dir>   (exit 1 on the first problem)
set -euo pipefail

src="${1:?usage: verify-catalog-artifact.sh <artifact dir>}"
slug="${GITHUB_REPOSITORY:-KROU4/claude-code-mod-showroom}"
market_name="mod-showroom"

fail() {
  echo "verify-catalog-artifact: $*" >&2
  exit 1
}

for f in registry.json .claude-plugin/marketplace.json README.md README.en.md data/github.json data/maintainers.json; do
  test -f "$src/$f" || fail "$f is missing from the artifact"
done
for f in registry.json .claude-plugin/marketplace.json data/github.json data/maintainers.json; do
  jq -e . "$src/$f" >/dev/null 2>&1 || fail "$f is not valid JSON"
done

# data/: only what scripts/enrich.mjs, analyze.mjs and the research job write.
unexpected="$(cd "$src/data" && find . \( -type f -o -type l \) | grep -vE '^\./(github|maintainers)\.json$|^\./analysis/[a-z0-9-]+\.json$|^\./research/[A-Za-z0-9._-]+\.json$' || true)"
test -z "$unexpected" || fail "unexpected files in data/: $(echo "$unexpected" | head -5 | tr '\n' ' ')"
links="$(cd "$src" && find . -type l | head -5)"
test -z "$links" || fail "symbolic links in the artifact: $links"
for f in "$src"/data/analysis/*.json "$src"/data/research/*.json; do
  test -e "$f" || continue
  jq -e . "$f" >/dev/null 2>&1 || fail "${f#"$src"/} is not valid JSON"
done

# data/maintainers.json: integer ids only, and every recorded login keeps its id.
if [ -f data/maintainers.json ]; then
  jq -e -n --slurpfile old data/maintainers.json --slurpfile new "$src/data/maintainers.json" '
    ($new[0] | type == "object")
    and ($new[0] | to_entries | all(.value | type == "number" and . == floor and . > 0))
    and ($old[0] | to_entries | all(.value == $new[0][.key]))
  ' >/dev/null || fail "data/maintainers.json changes or drops an id the catalog had recorded"
fi

# marketplace.json: our name, and each plugin's source exactly as its mods/<name>/mod.json says
# (the same mapping as scripts/lib/marketplace.mjs marketplaceSource()).
jq -e --arg name "$market_name" '.name == $name and (.plugins | type == "array")' "$src/.claude-plugin/marketplace.json" >/dev/null \
  || fail "marketplace.json is not the $market_name marketplace"
while IFS= read -r plugin; do
  name="$(jq -r '.name' <<<"$plugin" | tr -d '\r')"
  [[ "$name" =~ ^[a-z0-9]([a-z0-9-]{0,48}[a-z0-9])?$ ]] || fail "marketplace plugin name $(jq -c '.name' <<<"$plugin") is not a catalog name"
  entry="mods/$name/mod.json"
  test -f "$entry" || fail "marketplace plugin $name has no $entry on main"
  jq -e --slurpfile e "$entry" '
    def pin($s): (if $s.ref then {ref: $s.ref} else {} end) + (if $s.sha then {sha: $s.sha} else {} end);
    def expected($e): ($e.source) as $s
      | if $s.type == "hosted" then "./mods/\($e.name)/plugin"
        elif $s.type == "github" then (if $s.path then {source: "git-subdir", url: $s.repo, path: $s.path} else {source: "github", repo: $s.repo} end) + pin($s)
        elif $s.type == "git" then (if $s.path then {source: "git-subdir", url: $s.url, path: $s.path} else {source: "url", url: $s.url} end) + pin($s)
        else null end;
    ($e[0].name == .name) and (expected($e[0]) as $want | $want != null and .source == $want)
  ' <<<"$plugin" >/dev/null || fail "marketplace plugin $name does not install from the source in $entry"
done < <(jq -c '.plugins[]' "$src/.claude-plugin/marketplace.json" | tr -d '\r')

# registry.json: this repository and marketplace, catalog entries only, and each mod installs from
# where its entry says.
jq -e --arg slug "$slug" --arg name "$market_name" '
  .version == 1
  and .repo.url == "https://github.com/\($slug)"
  and .marketplace.name == $name
  and .marketplace.repo == $slug
  and .marketplace.addCommand == "/plugin marketplace add \($slug)"
  and (.mods | type == "array")
' "$src/registry.json" >/dev/null || fail "registry.json does not describe $slug and its $market_name marketplace"
while IFS=$'\t' read -r name repo; do
  [[ "$name" =~ ^[a-z0-9]([a-z0-9-]{0,48}[a-z0-9])?$ ]] || fail "registry.json lists a mod named $name"
  entry="mods/$name/mod.json"
  test -f "$entry" || fail "registry.json lists $name, which has no $entry on main"
  want="$(jq -r --arg slug "$slug" 'if .source.type == "marketplace" then .source.marketplace else $slug end' "$entry" | tr -d '\r')"
  test "$repo" = "$want" || fail "registry.json installs $name from $repo instead of $want"
done < <(jq -r '.mods[] | [.name, .install.marketplaceRepo] | @tsv' "$src/registry.json" | tr -d '\r')

# READMEs: only the generated blocks (mods list, count) may differ from main.
strip() {
  sed -E 's/<!-- count:start -->.*<!-- count:end -->/<!-- count -->/' "$1" | sed '/<!-- mods:start -->/,/<!-- mods:end -->/d'
}
for f in README.md README.en.md; do
  cmp -s <(strip "$f") <(strip "$src/$f") || fail "$f changes outside its generated blocks"
done

echo "verify-catalog-artifact: the catalog artifact checks out"
