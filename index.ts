import { parseArgs } from "jsr:@std/cli@0.224.0";

function exitWithMessage(message: string): never {
  console.error(`ERROR: ${message}`);
  Deno.exit(1);
}

interface ICUVersion {
  major: string;
  minor: string;
}
const versionRegExp = /^(\d+)\.(\d+)$/;
function parseICUVersion(icuVersionCandidate: string): ICUVersion | undefined {
  const matched = icuVersionCandidate.match(versionRegExp);
  if (matched) {
    return { major: matched[1], minor: matched[2] };
  }
}

interface ICURelease {
  name: string;
  body: string;
  icuVersion: ICUVersion;
}
async function fetchReleaseList(): Promise<ICURelease[]> {
  const url = new URL("https://api.github.com/repos/unicode-org/icu/releases");
  // @ts-expect-error -- why?
  url.search = new URLSearchParams([
    ["per_page", "100"],
  ]);
  const headers = new Headers([
    ["Accepet", "application/vnd.github+json"],
    ["X-GitHub-Api-Version", "2022-11-28"],
  ]);
  const response = await fetch(new Request(url, { headers }));
  const responseJSON = await response.json();

  const icuReleases: ICURelease[] = [];
  for (const { name, body, prerelease } of responseJSON) {
    if (!name.startsWith("ICU") || prerelease)
      continue;
    const icuVersion = parseICUVersion(name.split(" ")[1]);
    if (icuVersion === undefined)
      continue;
    icuReleases.push({ name,  body, icuVersion })
  }
  return icuReleases;
}

function generateReleasesMarkdown(releases: ICURelease[]): string {
  let markdownContent: string = "";

  for (const { name, body } of releases) {
    markdownContent += `# ${name}\n\n`;
    markdownContent += body + '\n\n';
  }

  return markdownContent;
}

function compareICUVersions(
  icuVersionA: ICUVersion,
  icuVersionB: ICUVersion,
): -1 | 0 | 1 {
  const majorA = Number.parseInt(icuVersionA.major, 10);
  const majorB = Number.parseInt(icuVersionB.major, 10);
  if (majorA < majorB) {
    return -1;
  } else if (majorA > majorB) {
    return 1;
  }

  const minorA = Number.parseInt(icuVersionA.minor, 10);
  const minorB = Number.parseInt(icuVersionB.minor, 10);
  if (minorA < minorB) {
    return -1;
  } else if (minorA > minorB) {
    return 1;
  }

  return 0;
}

async function main() {
  const { from, to } = parseArgs(Deno.args, {
    string: ["from", "to"],
  });

  if (from === undefined) {
    exitWithMessage("`--from=version` option is required");
  }
  if (to === undefined) {
    exitWithMessage("`--to=version` option is required");
  }

  const fromICUVersion = parseICUVersion(from);
  if (fromICUVersion === undefined) {
    exitWithMessage(`\`--from=${from}\` is invalid ICU version`);
  }

  const toICUVersion = parseICUVersion(to);
  if (toICUVersion === undefined) {
    exitWithMessage(`\`--to=${to}\` is invalid ICU version`);
  }

  if (compareICUVersions(fromICUVersion, toICUVersion) !== -1) {
    exitWithMessage(`\`--from=${from}\` must be less thatn \`--to=${to}\``);
  }

  const releases = (await fetchReleaseList()).toSorted((a, b) => compareICUVersions(a.icuVersion, b.icuVersion));

  const fromReleaseIndex = releases.findIndex((release) => compareICUVersions(release.icuVersion, fromICUVersion) === 0);
  if (fromReleaseIndex === -1)
      exitWithMessage(`\`--from=${from}\` not found`);
  const toReleaseIndex = releases.findIndex((release) => compareICUVersions(release.icuVersion, toICUVersion) === 0);
  if (toReleaseIndex === -1)
      exitWithMessage(`\`--to=${to}\` not found`);

  const slicedReleases = releases.slice(fromReleaseIndex, toReleaseIndex + 1);

  const markdownContent = generateReleasesMarkdown(slicedReleases);

  console.log(markdownContent);
}

main();
