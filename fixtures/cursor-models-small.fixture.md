# Cursor models parser fixture

## Models

| Model                                                  | Provider  | Input | Cache write | Cache read | Output | Notes                                           |
| ------------------------------------------------------ | --------- | ----- | ----------- | ---------- | ------ | ----------------------------------------------- |
| [Claude Opus 5](https://www.anthropic.com/claude/opus) | Anthropic | $5    | $6.25       | $0.5       | $25    | Requires Max Mode on legacy request-based plans |
| Hidden Model                                           | Anthropic | $3    | $3.75       | $0.3       | $15    | Hidden by default                               |
| Cache Dash                                             | Cursor    | $1    | -           | $0.1       | $5     | Plain row with dash cache write                 |
| Grok 4.6                                               | Cursor    | $2    | -           | $0.5       | $6     | Jointly trained by Cursor and SpaceXAI          |
| Duplicate Name                                         | OpenAI    | $0.5  | -           | $0.1       | $5     | First occurrence                                |
| Duplicate Name                                         | OpenAI    | $2    | -           | $0.2       | $10    | Duplicate row                                   |
| Bad Row                                                | Only      | Four  | Cells       |

## Plans

| Plan      | Price   | Other Models usage included | Cursor Models           |
| --------- | ------- | --------------------------- | ----------------------- |
| **Pro**   | $20/mo  | $20                         | Generous included usage |
| **Ultra** | $200/mo | $400                        | Generous included usage |
