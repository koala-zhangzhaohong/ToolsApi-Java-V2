# Dependency Updates

Updated on 2026-08-14.

## Backend

| Dependency | Previous | Updated |
| --- | --- | --- |
| MyBatis-Plus | 3.5.16 | 3.5.17 |
| PageHelper Spring Boot Starter | 4.1.0 | 4.1.1 |
| Javassist | 3.30.2-GA | 3.32.0-GA |
| lz4-java | 1.10.1 | 1.11.2 |
| Fastjson2 | 2.0.62 | 2.0.64 |
| Bouncy Castle | 1.84 | 1.85 |
| Hutool | 5.8.46 | 5.8.47 |
| Spring Boot Admin Client | 4.1.0 | 4.1.2 |
| Commons Collections | 4.5.0 | 4.6.0 |
| GraalVM Polyglot / JavaScript | 25.0.3 | 25.2.4 |

Maven compiler and Surefire plugins were checked and already use the latest
stable releases. The reported Surefire 3.6.0-M1 update is a milestone release
and was not applied.

## Frontend

| Dependency | Previous lock version | Updated |
| --- | --- | --- |
| React / React DOM | 18.3.1 | 19.2.8 |
| Ant Design | 5.29.3 | 6.6.0 |
| Ant Design Icons | 5.6.1 | 6.3.2 |
| React Router DOM | 6.30.4 | 7.18.2 |
| hls.js | 1.6.16 | 1.7.0 |
| Vite | 6.4.3 | 8.2.1 |
| Vite React plugin | 4.7.0 | 6.0.5 |
| TypeScript | 5.7.3 | 5.9.3 |
| ESLint | 9.39.5 | 10.8.1 |
| typescript-eslint | 8.66.0 | 8.67.0 |
| React Hooks ESLint plugin | 5.2.0 | 7.1.1 |
| React Refresh ESLint plugin | 0.4.26 | 0.5.4 |
| globals | 15.15.0 | 17.11.0 |

React Router 7 removed the obsolete `BrowserRouter.future` flags. React 19
also changed untyped `ReactElement.props` to `unknown`, so the image preview
toolbar now narrows its known props locally.

The React Hooks plugin now enables React Compiler rules in its recommended
configuration. Compiler-specific rules are explicitly disabled until the
state/ref architecture is migrated in a dedicated change. Core Hooks rules
remain enabled.

## Signature Service

| Dependency | Previous | Updated |
| --- | --- | --- |
| axios | 1.15.0 | 1.19.0 |
| Express | 5.0.0 | 5.2.1 |

Both npm and Yarn lock files were regenerated from the current manifest.

## Deferred

- TypeScript 7.0.2 builds the project, but typescript-eslint 8.67.0 explicitly
  does not support TypeScript 7. TypeScript 5.9.3 is the current usable target.
- MySQL Connector/J 26.7.0 uses a new version line and was not mixed into the
  low-risk dependency batch. It should be evaluated with database integration
  tests.
- Maven reports `commons-beanutils` version `20030211.134440` as newer than
  1.11.0 due to version ordering. That artifact is an old timestamp release and
  must not replace 1.11.0.

## Verification

- `mvn -B clean verify -DskipTests=false`
- `mvn -B -pl tools-service -am test -DskipTests=false`
- `pnpm build`
- `pnpm lint`
- `pnpm peers check`
- Signature service HTTP smoke test on `/kugou/v1`
