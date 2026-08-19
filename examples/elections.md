# Elections prompt recipes

## 2024 legislative overview

Prompt:

```text
Summarize the 2024 legislative election results in La Réunion by constituency.
Compare round 1 and round 2 where available, and list winners with turnout.
```

Expected tool flow:

- `reunion_get_legislative_2024_round1`
- `reunion_get_legislative_2024_round2`

## Historical comparison

Prompt:

```text
Compare 2022 legislative results and 2024 legislative results in Réunion.
Focus on turnout, leading candidates, and constituency-level shifts.
```

Expected tool flow:

- `reunion_get_legislative_2022_round1`
- `reunion_get_legislative_2022_round2`
- `reunion_get_legislative_2024_round1`
- `reunion_get_legislative_2024_round2`

