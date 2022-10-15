# How to release

This is documenting the release process.

## Update package.json and tag

Update the `version` from <package.json>.
Then commit and tag:

```sh
git commit -a -m ":bookmark: MAJOR.MINOR.PATCH"
git tag -a MAJOR.MINOR.PATCH -m ":bookmark: MAJOR.MINOR.PATCH"
```

Push everything including tags:

```sh
git push
git push --tags
```

## Publish to npm

Publication to npm happens automatically from GitHub Actions on tag push.
Alternatively it can be done manually via:

```sh
yarn build
npm publish
```
